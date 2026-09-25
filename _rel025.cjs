const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { execSync } = require("child_process");
const TGT = "C:/build/typet/src-tauri/target/release", dl = "site/dl";
const setup = path.join(TGT, "bundle/nsis/Jellypal_0.2.5_x64-setup.exe");
for (const f of [setup, path.join(TGT, "jellypal.exe"), path.join(TGT, "WebView2Loader.dll")])
  if (!fs.existsSync(f)) { console.log("MISSING", f); process.exit(1); }
fs.copyFileSync(setup, path.join(dl, "Jellypal_0.2.5_x64-setup.exe"));
const zip = path.join(dl, "jellypal-0.2.5-win.zip");
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execSync(`tar -a -c -f "${zip}" -C "${TGT}" jellypal.exe WebView2Loader.dll`);
const h = f => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const sh = h(path.join(dl, "Jellypal_0.2.5_x64-setup.exe")), zh = h(zip);
console.log("setup", sh); console.log("zip", zh);
for (const f of fs.readdirSync(dl)) if (f.includes("0.2.4")) { fs.unlinkSync(path.join(dl, f)); console.log("removed", f); }
let html = fs.readFileSync("site/index.html", "utf8");
html = html.replace(/0\.2\.4/g, "0.2.5");
html = html.replace(/e908e2c3[0-9a-f]+/, sh).replace(/60a6c5ab[0-9a-f]+/, zh);
fs.writeFileSync("site/index.html", html);
console.log("site ok:", /Jellypal_0\.2\.5/.test(html), /e908e2c3/.test(html) ? "STALE" : "hashes fresh");
