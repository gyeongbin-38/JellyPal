const { execSync } = require("child_process"), crypto = require("crypto"), fs = require("fs");
const H = "https://jellypal.fun";
const head = (u) => { try { const r = execSync(`curl -sIL -o nul -w "%{http_code}" "${u}"`, { encoding: "utf8" }).trim(); return r; } catch (e) { return "ERR"; } };
console.log("version.txt:", execSync(`curl -s ${H}/version.txt`, { encoding: "utf8" }).trim());
const files = [
  ["setup", `${H}/dl/Jellypal_0.3.0_x64-setup.exe`, "e0c4dd32855a2d28dff7f7faed6e778813d6aeb4ff449106cc4f9be9abdee563"],
  ["zip", `${H}/dl/jellypal-0.3.0-win.zip`, "cc705a5af7075ca98add3f23be84b201a933342cb49f75d8e7522a6ef0c5d880"],
  ["dmg", `${H}/dl/Jellypal_0.3.0_aarch64.dmg`, "c2dee372e3c2c4effbbfdf3e19b1e7a428c59000700d4e9361554e4eee279a50"],
  ["tgz", `${H}/dl/jellypal-0.3.0-mac.tar.gz`, "075c717b1980fe8a72587acb09aa04629a7deb55c0728c786337443ac35d889f"],
];
for (const [n, u, want] of files) {
  const code = head(u);
  const tmp = `_lv_${n}`;
  execSync(`curl -sL -o ${tmp} "${u}"`);
  const got = crypto.createHash("sha256").update(fs.readFileSync(tmp)).digest("hex");
  console.log(`${n}: HTTP ${code} sha ${got === want ? "MATCH" : "MISMATCH " + got}`);
  fs.unlinkSync(tmp);
}
const html = execSync(`curl -sL ${H}/`, { encoding: "utf8" });
console.log("copy drip:", /You chill\. It drips/.test(html), "| typing gone:", !/snacks on your typing|600 keys = 1 jelly|Input Monitoring/i.test(html), "| ver links:", /0\.3\.0_x64-setup/.test(html));
