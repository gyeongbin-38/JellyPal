// gem-pack redeem code minter — sell these on itch/Gumroad/Stripe.
// Codes are Ed25519-SIGNED: the app ships only the PUBLIC key (in the
// Rust binary), so even fully unpacking the exe can never mint a code.
// The private key lives in seller_ed25519.key — KEEP IT OFFLINE, it's
// gitignored. Lose it and you can never mint codes for shipped builds.
//
// usage:
//   node codes.cjs keygen          -> create seller_ed25519.key + print
//                                     the pubkey hex to embed in lib.rs
//   node codes.cjs <pack> <count> [outfile] -> mint codes; every code is
//       self-verified before printing (a corrupt key gets caught here,
//       not in a buyer's inbox). outfile writes one code per line.
//   node codes.cjs verify <code>   -> self-test a minted code
//   node codes.cjs pubkey          -> reprint the pubkey hex from the key
//
// packs: A=250 B=500 C=1000 D=2500 gems (must match GEM_AMOUNTS in lib.rs)
// code:  JELLYPAL-<pack>-<nonce8>-<sig> where sig is base32(ed25519 sig
//        of "JP2:<pack>:<nonce>") — unique per code, unforgeable offline.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const GEM_PACKS = { A: 250, B: 500, C: 1000, D: 2500 };
const KEY_FILE = path.join(__dirname, "seller_ed25519.key");
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32(buf) {
  let out = "", bits = 0, acc = 0;
  for (const b of buf) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(acc >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

function keygen() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(KEY_FILE, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
  const raw = publicKey.export({ format: "der", type: "spki" });
  return raw.slice(-32); // SPKI DER: last 32 bytes are the raw key
}

function loadKey() {
  if (!fs.existsSync(KEY_FILE)) return null;
  return crypto.createPrivateKey(fs.readFileSync(KEY_FILE));
}

function pubHexFromKey(priv) {
  const raw = crypto.createPublicKey(priv).export({ format: "der", type: "spki" });
  return Buffer.from(raw.slice(-32)).toString("hex").toUpperCase();
}

const op = (process.argv[2] || "").toLowerCase();

if (op === "keygen") {
  if (fs.existsSync(KEY_FILE)) {
    console.error("seller_ed25519.key already exists — refusing to overwrite");
    process.exit(1);
  }
  const raw = keygen();
  console.log("wrote seller_ed25519.key — back it up OFFLINE, never ship it\n");
  console.log("paste this into lib.rs GEM_PUBKEY:");
  console.log(raw.toString("hex").toUpperCase().match(/.{1,2}/g).map((h) => "0x" + h).join(", "));
  process.exit(0);
}

if (op === "pubkey") {
  const priv = loadKey();
  if (!priv) { console.error("no seller_ed25519.key — run keygen first"); process.exit(1); }
  console.log(pubHexFromKey(priv).match(/.{1,2}/g).map((h) => "0x" + h).join(", "));
  process.exit(0);
}

if (op === "verify") {
  const priv = loadKey();
  if (!priv) { console.error("no seller_ed25519.key — run keygen first"); process.exit(1); }
  const code = (process.argv[3] || "").toUpperCase().trim();
  const m = code.match(/^JELLYPAL-([A-D])-([A-Z2-7]{8})-([A-Z2-7]+)$/);
  if (!m) { console.log("BAD FORMAT"); process.exit(1); }
  const [, pack, nonce, sigs] = m;
  // base32 decode the signature
  let acc = 0, bits = 0; const bytes = [];
  for (const ch of sigs) {
    acc = (acc << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { bytes.push((acc >> (bits - 8)) & 255); bits -= 8; }
  }
  const sig = Buffer.from(bytes.slice(0, 64));
  const ok = sig.length === 64 &&
    crypto.verify(null, Buffer.from(`JP2:${pack}:${nonce}`),
      crypto.createPublicKey(priv), sig);
  console.log(ok ? `VALID — pack ${pack} = ${GEM_PACKS[pack]} gems` : "INVALID");
  process.exit(ok ? 0 : 1);
}

// mint mode
const pack = op.toUpperCase();
const count = Math.max(1, parseInt(process.argv[3] || "1", 10) || 1);
const outFile = process.argv[4] || null;
if (!GEM_PACKS[pack]) {
  console.error("usage: node codes.cjs keygen | pubkey | verify <code> | <pack A-D> <count> [outfile]");
  process.exit(1);
}
const priv = loadKey();
if (!priv) { console.error("no seller_ed25519.key — run `node codes.cjs keygen` first"); process.exit(1); }
const pub = crypto.createPublicKey(priv);
const codes = [];
let bad = 0;
for (let i = 0; i < count; i++) {
  const nonce = b32(crypto.randomBytes(5)); // 5 bytes -> exactly 8 base32 chars
  const msg = Buffer.from(`JP2:${pack}:${nonce}`);
  const sig = crypto.sign(null, msg, priv);
  // never ship a code the app would reject — self-verify against the pubkey
  if (!crypto.verify(null, msg, pub, sig)) { bad++; continue; }
  codes.push(`JELLYPAL-${pack}-${nonce}-${b32(sig)}`);
}
if (bad) console.error(`WARNING: ${bad} code(s) failed self-verify and were dropped`);
if (outFile) {
  fs.writeFileSync(outFile, codes.join("\n") + "\n");
  console.log(`wrote ${codes.length}x ${GEM_PACKS[pack]}-gem codes (pack ${pack}) -> ${outFile}`);
} else {
  console.log(`-- ${codes.length}x ${GEM_PACKS[pack]}-gem codes (pack ${pack}) --`);
  for (const c of codes) console.log(c);
}
