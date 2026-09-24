// live E2E against the deployed worker — real minted code + admin grant path.
const crypto = require("crypto");
const fs = require("fs");

const BASE = "https://api.jellypal.fun";
const code = fs.readFileSync("_livetest_code.txt", "utf8").trim();
const uid = "JPLIVEE2ETESTABCDEFGHIJ2XYZ".slice(0, 26);
const uidB = "JP" + "Q".repeat(24);

const secrets = {};
for (const line of fs.readFileSync("_secrets.local.txt", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0) secrets[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

// app-side server pubkey from lib.rs (same check the shipped exe performs)
const lib = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const pm = lib.match(/SERVER_PUBKEY[^=]*=\s*\[([^\]]+)\]/);
if (!pm) { console.error("SERVER_PUBKEY not found in lib.rs"); process.exit(1); }
const pubBytes = Buffer.from(pm[1].split(",").map((s) => parseInt(s.trim(), 16)));
const serverPub = crypto.createPublicKey({
  key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pubBytes]),
  format: "der", type: "spki",
});

const B32C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32dec = (s) => {
  let acc = 0, bits = 0; const out = [];
  for (const c of s) {
    const v = B32C.indexOf(c); if (v < 0) return null;
    acc = (acc << 5) | v; bits += 5;
    if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
};

const post = async (p, body, headers = {}) => {
  const r = await fetch(BASE + p, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const verifyGrant = (g, forUid) => {
  const sig = b32dec(g.sig || "");
  return sig && sig.length === 64 && g.tag === forUid.slice(2, 10) &&
    crypto.verify(null, Buffer.from(`JP2G:${g.pack}:${g.nonce}:${g.tag}`), serverPub, sig);
};

let pass = 0, fail = 0;
const t = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log((ok ? "PASS" : "FAIL") + " " + name + (extra ? " — " + String(extra).slice(0, 140) : ""));
};

(async () => {
  const h = await fetch(BASE + "/health").then((r) => r.json()).catch(() => null);
  t("health", h && h.ok === true);

  let r = await post("/redeem", { code, uid });
  t("redeem real code", r.status === 200 && r.json && r.json.grant, JSON.stringify(r.json).slice(0, 100));
  const g1 = r.json && r.json.grant;
  t("redeem grant sig verifies (app pubkey)", g1 && verifyGrant(g1, uid));
  t("redeem grant is pack A", g1 && g1.pack === "A");

  r = await post("/redeem", { code, uid });
  t("same code same uid re-redeem rejected", r.status !== 200 || (r.json && r.json.error));

  r = await post("/redeem", { code, uid: uidB });
  t("same code different uid rejected", r.status !== 200 || (r.json && r.json.error));

  r = await post("/redeem", { code: "JELLYPAL-Z-ZZZZZZZZ-ZZZ", uid });
  t("forged code rejected", r.status !== 200 || (r.json && r.json.error));

  r = await post("/redeem", { code, uid: "not-a-uid" });
  t("bad uid rejected", r.status === 400);

  // admin path: pending grant -> claim -> verify -> ack
  r = await post("/admin/grant", { uid, pack: "B" });
  t("admin grant w/o key rejected", r.status === 403);

  r = await post("/admin/grant", { uid, pack: "B" }, { "x-admin-key": secrets.ADMIN_KEY });
  t("admin grant with key", r.status === 200 && r.json && r.json.ok === true);
  const adminNonce = r.json && r.json.nonce;

  // KV is eventually consistent — retry claim until the grant is visible
  let grants = [], g2 = null;
  for (let i = 0; i < 14 && !g2; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    r = await post("/claim", { uid });
    grants = (r.json && r.json.grants) || [];
    g2 = grants.find((g) => g.nonce === adminNonce);
  }
  t("claim returns admin grant", !!g2, `grants=${grants.length}`);
  t("admin grant sig verifies (app pubkey)", g2 && verifyGrant(g2, uid));

  r = await post("/ack", { uid, nonces: [adminNonce] });
  t("ack accepted", r.status === 200 && r.json && r.json.ok === true);

  r = await post("/claim", { uid });
  const grants2 = (r.json && r.json.grants) || [];
  t("acked grant gone from claim", !grants2.some((g) => g.nonce === adminNonce));

  r = await post("/claim", { uid: uidB });
  t("unknown uid claims nothing", r.status === 200 && !(r.json && r.json.grants || []).length);

  console.log(`\n=== live e2e: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
