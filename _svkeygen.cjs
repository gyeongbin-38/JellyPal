// one-shot: server signing keypair for the jellypal backend.
// pubkey -> embedded in lib.rs (SERVER_PUBKEY) and the worker.
// privkey -> server_ed25519.key (gitignored) -> `wrangler secret put`.
const c = require("crypto");
const fs = require("fs");
if (fs.existsSync("server_ed25519.key")) { console.log("already exists"); process.exit(0); }
const { privateKey, publicKey } = c.generateKeyPairSync("ed25519");
fs.writeFileSync("server_ed25519.key", privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
const raw = publicKey.export({ format: "der", type: "spki" }).slice(-32);
console.log("pubkey hex for lib.rs SERVER_PUBKEY:");
console.log(raw.toString("hex").toUpperCase().match(/.{1,2}/g).map((h) => "0x" + h).join(", "));
console.log("privkey seed hex for wrangler secret (first 32 bytes of pkcs8):");
const der = privateKey.export({ format: "der", type: "pkcs8" });
console.log(Buffer.from(der.slice(-32)).toString("hex"));
