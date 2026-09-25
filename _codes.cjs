// gem-code chain check: proves the three ends of the signed-code system
// actually line up — seller key -> embedded pubkey -> minted code format.
//   node _codes.cjs   (needs seller_ed25519.key from `node codes.cjs keygen`)
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");

let pass = 0, fail = 0;
const check = (n, ok, extra = "") => {
  console.log((ok ? "PASS " : "FAIL ") + n + (extra ? "  (" + extra + ")" : ""));
  ok ? pass++ : fail++;
};

const path = require("path");
const SECRETS = process.env.JP_SECRETS_DIR || path.join(__dirname, "..", "typet-secrets");
const KEY = path.join(SECRETS, "seller_ed25519.key");
check("seller key exists", fs.existsSync(KEY),
  "run `node codes.cjs keygen` if missing");
const priv = crypto.createPrivateKey(fs.readFileSync(KEY));
const pubDer = crypto.createPublicKey(priv).export({ format: "der", type: "spki" });
const pubHex = Buffer.from(pubDer.slice(-32)).toString("hex").toUpperCase();

// the Rust binary must embed THIS key — parse GEM_PUBKEY out of lib.rs
const rs = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const m = rs.match(/GEM_PUBKEY: \[u8; 32\] = \[([\s\S]*?)\]/);
check("GEM_PUBKEY block found in lib.rs", !!m);
const emb = m && m[1].match(/0x([0-9A-Fa-f]{2})/g)
  .map((h) => h.slice(2).toUpperCase()).join("");
check("embedded pubkey == seller pubkey", emb === pubHex,
  `emb=${(emb || "").slice(0, 16)}… key=${pubHex.slice(0, 16)}…`);

// mint a real code, then verify the signature cryptographically in-node —
// this mirrors what the Rust verify_gem_code command does
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const b32d = (s) => {
  let acc = 0, bits = 0; const out = [];
  for (const ch of s) {
    acc = (acc << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
};
const out = execSync("node codes.cjs B 1", { encoding: "utf8" });
const code = (out.match(/JELLYPAL-[A-D]-[A-Z2-7]{8}-[A-Z2-7]+/) || [""])[0];
check("minted code has the signed format", !!code, out.trim().split("\n").pop());
const p = code.split("-");
check("signature is a full 64-byte ed25519 sig", b32d(p[3]).length === 64,
  `len=${b32d(p[3]).length}`);
const ok = crypto.verify(null, Buffer.from(`JP2:${p[1]}:${p[2]}`),
  crypto.createPublicKey(priv), b32d(p[3]).slice(0, 64));
check("minted code verifies cryptographically", ok);

// forgery attempts: pack swap, nonce swap, truncation — all must fail
const forged = code.replace("JELLYPAL-B", "JELLYPAL-D");
const fp = forged.split("-");
const fok = crypto.verify(null, Buffer.from(`JP2:${fp[1]}:${fp[2]}`),
  crypto.createPublicKey(priv), b32d(fp[3]).slice(0, 64));
check("pack-swapped code fails", !fok);
const np = code.split("-"); np[2] = "AAAAAAAA";
const nok = crypto.verify(null, Buffer.from(`JP2:${np[1]}:${np[2]}`),
  crypto.createPublicKey(priv), b32d(np[3]).slice(0, 64));
check("nonce-swapped code fails", !nok);
const tok = crypto.verify(null, Buffer.from(`JP2:${p[1]}:${p[2]}`),
  crypto.createPublicKey(priv), b32d(p[3]).slice(0, 63));
check("truncated signature fails", !tok);

// the strongest check: run the verifier compiled INTO the shipped exe.
// skipped automatically when no release binary exists yet
const exe = "src-tauri/target/release/jellypal.exe";
if (fs.existsSync(exe)) {
  // exit code is the oracle: 0 = VALID, 1 = INVALID. (stdout only reaches
  // a real console — piped runs just get the status)
  const run = (c) => {
    try { execSync(`"${exe}" --verify-code ${c}`, { stdio: "pipe" }); return 0; }
    catch (e) { return e.status ?? 1; }
  };
  check("shipped exe accepts a minted code", run(code) === 0, `exit=${run(code)}`);
  check("shipped exe rejects the pack-swap", run(forged) === 1, `exit=${run(forged)}`);
} else {
  console.log("SKIP exe check (no release binary yet)");
}

console.log(`=== codes: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
