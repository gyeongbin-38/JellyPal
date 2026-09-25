// end-to-end worker test — runs the real worker.js against an in-memory KV
// stub, mints a real code with the seller key, and verifies grants against
// the same SERVER_PUBKEY bytes the app embeds.
//   node test.cjs
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// reads the gitignored server_ed25519.key — the seed never sits in git.
// SERVER_PK_HEX must match SERVER_PUBKEY in src-tauri/src/lib.rs.
const SERVER_PK_HEX =
  "c9a7c53405174178424a18668cc0c163dba38de7a4b6938b04bf44bb0545ec91";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32 = (buf) => {
  let out = "", acc = 0, bits = 0;
  for (const b of buf) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(acc >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += B32[(acc << (5 - bits)) & 31];
  return out;
};
const b32dec = (s) => {
  let acc = 0, bits = 0; const out = [];
  for (const c of s) {
    acc = (acc << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
};

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log("  ok", name); } else { fail++; console.log("  FAIL", name); } };
const post = (worker, env, p, body, headers = {}) =>
  worker.fetch(new Request("https://x" + p, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }), env);

async function main() {
  const worker = (await import("./worker.js")).default;

  // in-memory KV stub
  const store = new Map();
  const SECRETS = process.env.JP_SECRETS_DIR || path.join(__dirname, "..", "..", "typet-secrets");
  const skDer = crypto.createPrivateKey(
    fs.readFileSync(path.join(SECRETS, "server_ed25519.key"))
  ).export({ format: "der", type: "pkcs8" });
  const env = {
    DB: {
      get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : null),
      put: async (k, v) => void store.set(k, v),
      delete: async (k) => void store.delete(k),
      list: async ({ prefix }) => ({
        keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      }),
    },
    SERVER_SK: Buffer.from(skDer).toString("hex"), // pkcs8 DER hex — same shape as the wrangler secret
    ADMIN_KEY: "test-admin-key",
  };

  // sanity: the key file must pair with the pubkey embedded in lib.rs — if
  // this fails the app will reject every grant the server signs
  const skObj = crypto.createPrivateKey({ key: skDer, format: "der", type: "pkcs8" });
  const derivedPub = crypto.createPublicKey(skObj).export({ format: "der", type: "spki" }).slice(-32);
  ok(Buffer.from(derivedPub).toString("hex") === SERVER_PK_HEX, "server seed pairs with embedded pubkey");

  const verifyGrant = (g, uid) => {
    if (g.tag !== uid.slice(2, 10)) return false;
    const pub = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(SERVER_PK_HEX, "hex")]),
      format: "der", type: "spki",
    });
    return crypto.verify(null, Buffer.from(`JP2G:${g.pack}:${g.nonce}:${g.tag}`), pub, b32dec(g.sig));
  };

  const uidA = "JP" + b32(crypto.randomBytes(15));
  const uidB = "JP" + b32(crypto.randomBytes(15));

  // mint a real code with the seller key
  const sellerPriv = crypto.createPrivateKey(fs.readFileSync(path.join(SECRETS, "seller_ed25519.key")));
  const nonce = b32(crypto.randomBytes(5));
  const sig = crypto.sign(null, Buffer.from(`JP2:B:${nonce}`), sellerPriv);
  const code = `JELLYPAL-B-${nonce}-${b32(sig)}`;

  console.log("redeem:");
  let r = await post(worker, env, "/redeem", { uid: uidA, code });
  let j = await r.json();
  ok(j.grant && j.grant.pack === "B", "valid code -> grant");
  ok(j.grant && verifyGrant(j.grant, uidA), "grant signature verifies against app pubkey");

  r = await post(worker, env, "/redeem", { uid: uidB, code });
  j = await r.json();
  ok(j.error === "code already claimed", "same code, different uid -> refused");

  r = await post(worker, env, "/redeem", { uid: uidA, code });
  j = await r.json();
  ok(j.grant && verifyGrant(j.grant, uidA), "same code, same uid -> idempotent re-grant");

  r = await post(worker, env, "/redeem", { uid: uidA, code: "JELLYPAL-Z-AAAAAAAA-BBBB" });
  j = await r.json();
  ok(j.error === "bad code", "forged code -> refused");

  console.log("admin grant + claim:");
  r = await post(worker, env, "/admin/grant", { uid: uidA, pack: "C" });
  j = await r.json();
  ok(j.error === "no" && r.status === 403, "admin grant without key -> 403");
  r = await post(worker, env, "/admin/grant", { uid: uidA, pack: "C" }, { "x-admin-key": env.ADMIN_KEY });
  j = await r.json();
  ok(j.ok && j.nonce, "admin grant accepted");

  r = await post(worker, env, "/claim", { uid: uidA });
  j = await r.json();
  ok(j.grants.length === 1 && j.grants[0].pack === "C", "claim returns pending grant");
  ok(verifyGrant(j.grants[0], uidA), "claimed grant signature verifies");
  ok(j.grants[0].tag === uidA.slice(2, 10), "grant bound to uid tag");
  const grantNonce = j.grants[0].nonce;

  // uidB can't use uidA's grant
  ok(!verifyGrant(j.grants[0], uidB), "grant rejected under a different uid");

  r = await post(worker, env, "/claim", { uid: uidB });
  j = await r.json();
  ok(j.grants.length === 0, "other uid sees no grants");

  console.log("ack:");
  await post(worker, env, "/ack", { uid: uidA, nonces: [grantNonce] });
  // re-claim after ack -> empty
  r = await post(worker, env, "/claim", { uid: uidA });
  j = await r.json();
  ok(j.grants.length === 0, "acked grant is gone");

  console.log("user db:");
  const uh = [...store.keys()].find((k) => k.startsWith("user:"));
  const u = JSON.parse(store.get(uh));
  ok(u && u.codes === 2 && u.granted === 1000, `user record (codes=${u?.codes}, granted=${u?.granted})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
