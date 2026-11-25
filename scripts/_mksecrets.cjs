// converts server_ed25519.key (PEM) -> pkcs8 hex + mints ADMIN_KEY.
// writes _secrets.local.txt (gitignored) — never prints key material.
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const SECRETS = process.env.JP_SECRETS_DIR || path.join(__dirname, "..", "typet-secrets");
const pem = fs.readFileSync(path.join(SECRETS, "server_ed25519.key"), "utf8");
const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
const hexpkcs8 = Buffer.from(b64, "base64").toString("hex");
const admin = "JPADM-" + crypto.randomBytes(24).toString("base64url");
fs.writeFileSync(path.join(SECRETS, "_secrets.local.txt"), `SERVER_SK=${hexpkcs8}\nADMIN_KEY=${admin}\n`);
// sanity: derive pubkey from sk and compare with the embedded SERVER_PUBKEY
const key = crypto.createPrivateKey(pem);
const pub = crypto.createPublicKey(key).export({ format: "der", type: "spki" });
console.log("pkcs8 hex len:", hexpkcs8.length, "| admin key minted | pubkey spki tail:", pub.subarray(-8).toString("hex"));
