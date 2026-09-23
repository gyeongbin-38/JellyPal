// Jellypal shop backend — Cloudflare Worker + KV.
//
// Identity model: each install owns a random uid ("JP" + 24 base32 chars,
// generated client-side). The DB only ever stores sha256(uid) — no emails,
// no machine fingerprints, nothing reversible.
//
// Money flows:
//   A) code path (itch.io keys etc.) — the buyer gets a JELLYPAL-* code
//      minted offline by codes.cjs. /redeem verifies the seller signature,
//      binds the code to this uid's hash so it can't be shared, and returns
//      a signed grant the app credits immediately.
//   B) direct purchase path (Stripe etc.) — a checkout webhook (or the
//      seller's grant.cjs / any /admin/grant caller) writes a pending grant
//      under grant:{uidHash}:{nonce}. The app polls /claim, verifies each
//      grant's Ed25519 signature against the embedded SERVER pubkey, credits
//      the jelly, then /ack deletes it. A lost ack just re-sends; the client
//      dedupes by nonce.
//
// Keys: SERVER_SK (Ed25519 pkcs8 hex) signs grants and lives ONLY in
// `wrangler secret`. The seller code key never touches this server — a
// compromised worker can still not mint codes.
//
// KV layout:
//   user:{uidHash}        -> {created, codes, granted}   (the "user DB")
//   code:{sha256(code)}   -> uidHash                     (one-owner binding)
//   grant:{uidHash}:{nonce} -> {pack, at}                (pending until ack)

const SELLER_PK = new Uint8Array([
  0x09, 0x6f, 0xfd, 0x17, 0xaf, 0x68, 0x85, 0x4c, 0x92, 0x9c, 0xb7, 0xfe, 0xff, 0x81, 0x4a, 0x6a,
  0x40, 0xcc, 0xd5, 0x00, 0xc7, 0x49, 0xc5, 0x05, 0xf3, 0x5d, 0x55, 0xb2, 0x81, 0x35, 0x42, 0xac,
]);
const GEMS = { A: 250, B: 500, C: 1000, D: 2500 };
const B32C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const UID_RE = /^JP[A-Z2-7]{24}$/;

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const hexToBytes = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

function b32dec(s) {
  let acc = 0, bits = 0;
  const out = [];
  for (const c of s) {
    const v = B32C.indexOf(c);
    if (v < 0) return new Uint8Array(0);
    acc = (acc << 5) | v; bits += 5;
    if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
function b32enc(buf) {
  let out = "", acc = 0, bits = 0;
  for (const x of buf) {
    acc = (acc << 8) | x; bits += 8;
    while (bits >= 5) { out += B32C[(acc >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += B32C[(acc << (5 - bits)) & 31];
  return out;
}
const rand8 = () => b32enc(crypto.getRandomValues(new Uint8Array(5)));

async function uidHash(uid) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(uid)));
}
async function sha(s) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

let _sellerKey = null;
async function sellerKey() {
  return (_sellerKey ??= await crypto.subtle.importKey("raw", SELLER_PK, "Ed25519", false, ["verify"]));
}
async function serverKey(env) {
  return await crypto.subtle.importKey("pkcs8", hexToBytes(env.SERVER_SK), "Ed25519", false, ["sign"]);
}

// verify a JELLYPAL-<pack>-<nonce8>-<sig> code against the seller pubkey
async function verifySellerCode(code) {
  const m = /^JELLYPAL-([A-D])-([A-Z2-7]{8})-([A-Z2-7]+)$/.exec(code);
  if (!m) return null;
  const [, pack, nonce, sigs] = m;
  const sig = b32dec(sigs);
  if (sig.length !== 64) return null;
  const ok = await crypto.subtle.verify(
    "Ed25519", await sellerKey(), sig, enc.encode(`JP2:${pack}:${nonce}`)
  );
  return ok ? { pack, gems: GEMS[pack] } : null;
}

// grant = "JP2G:<pack>:<nonce>:<tag>" signed by the server key; tag =
// uid[2..10] binds it to one install
async function signGrant(env, pack, nonce, uid) {
  const tag = uid.slice(2, 10);
  const sig = await crypto.subtle.sign(
    "Ed25519", await serverKey(env), enc.encode(`JP2G:${pack}:${nonce}:${tag}`)
  );
  return { pack, nonce, tag, sig: b32enc(new Uint8Array(sig)) };
}

async function redeem(req, env) {
  const { uid, code } = await req.json().catch(() => ({}));
  if (!UID_RE.test(uid || "") || typeof code !== "string" || code.length > 200)
    return J({ error: "bad request" }, 400);
  const uh = await uidHash(uid);
  const v = await verifySellerCode(code.toUpperCase().trim());
  if (!v) return J({ error: "bad code" });
  const cKey = `code:${await sha(code.toUpperCase().trim())}`;
  const bound = await env.DB.get(cKey);
  if (bound && bound !== uh) return J({ error: "code already claimed" });
  if (!bound) await env.DB.put(cKey, uh);
  const uKey = `user:${uh}`;
  const u = (await env.DB.get(uKey, "json")) || { created: Date.now(), codes: 0, granted: 0 };
  u.codes++; u.granted += v.gems;
  await env.DB.put(uKey, JSON.stringify(u));
  return J({ grant: await signGrant(env, v.pack, rand8(), uid) });
}

async function claim(req, env) {
  const { uid } = await req.json().catch(() => ({}));
  if (!UID_RE.test(uid || "")) return J({ error: "bad request" }, 400);
  const uh = await uidHash(uid);
  const list = await env.DB.list({ prefix: `grant:${uh}:` });
  const grants = [];
  for (const k of list.keys.slice(0, 20)) {
    const g = await env.DB.get(k.name, "json");
    if (g && GEMS[g.pack]) grants.push(await signGrant(env, g.pack, k.name.split(":")[2], uid));
  }
  return J({ grants });
}

async function ack(req, env) {
  const { uid, nonces } = await req.json().catch(() => ({}));
  if (!UID_RE.test(uid || "") || !Array.isArray(nonces)) return J({ error: "bad request" }, 400);
  const uh = await uidHash(uid);
  await Promise.all(
    nonces.slice(0, 50).map((n) => (/^[A-Z2-7]{8}$/.test(n) ? env.DB.delete(`grant:${uh}:${n}`) : null))
  );
  return J({ ok: true });
}

// seller-side tool: grant a pack to a uid (or uidHash) — used by grant.cjs
// for manual sales/support, and by the stripe webhook internally
async function putGrant(env, uh, pack) {
  const nonce = rand8();
  await env.DB.put(`grant:${uh}:${nonce}`, JSON.stringify({ pack, at: Date.now() }));
  return nonce;
}
async function adminGrant(req, env) {
  if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY)
    return J({ error: "no" }, 403);
  const { uid, uidHash: uhIn, pack } = await req.json().catch(() => ({}));
  const uh = typeof uhIn === "string" && /^[0-9a-f]{64}$/.test(uhIn) ? uhIn
    : UID_RE.test(uid || "") ? await uidHash(uid) : null;
  if (!uh || !GEMS[pack]) return J({ error: "bad request" }, 400);
  return J({ ok: true, nonce: await putGrant(env, uh, pack) });
}

// Stripe webhook: checkout.session.completed -> pending grant. configure the
// Payment Link with ?client_reference_id=<uid> (the app's MY ID). the pack is
// read from session metadata, else from PRICE_<cents> vars (payment links
// don't propagate their own metadata to the session) — e.g. [vars]
// PRICE_299 = "A", PRICE_499 = "B" in wrangler.toml.
async function stripe(req, env) {
  if (!env.STRIPE_WHSEC) return J({ error: "not configured" }, 501);
  const body = await req.text();
  const sigH = req.headers.get("stripe-signature") || "";
  const t = /t=(\d+)/.exec(sigH)?.[1];
  const v1 = /v1=([0-9a-f]+)/i.exec(sigH)?.[1];
  if (!t || !v1) return J({ error: "bad sig" }, 400);
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(env.STRIPE_WHSEC), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`)));
  if (mac !== v1.toLowerCase()) return J({ error: "bad sig" }, 400);
  const ev = JSON.parse(body);
  if (ev.type !== "checkout.session.completed") return J({ ok: true });
  const s = ev.data?.object || {};
  const uid = s.client_reference_id || s.metadata?.uid;
  const pack = s.metadata?.pack || env[`PRICE_${s.amount_total}`];
  if (!UID_RE.test(uid || "") || !GEMS[pack]) return J({ error: "no uid/pack on session" }, 422);
  return J({ ok: true, nonce: await putGrant(env, await uidHash(uid), pack) });
}

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    try {
      if (req.method === "GET" && p === "/health") return J({ ok: true });
      if (req.method !== "POST") return J({ error: "not found" }, 404);
      if (p === "/redeem") return await redeem(req, env);
      if (p === "/claim") return await claim(req, env);
      if (p === "/ack") return await ack(req, env);
      if (p === "/admin/grant") return await adminGrant(req, env);
      if (p === "/stripe") return await stripe(req, env);
      return J({ error: "not found" }, 404);
    } catch {
      return J({ error: "server busy" }, 500);
    }
  },
};
