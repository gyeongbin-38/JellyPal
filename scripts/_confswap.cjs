// swaps icon paths in tauri.conf.json between repo-relative and an ASCII
// temp copy (windres chokes on the non-ASCII project path). "to" = ascii|repo
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..");
const conf = path.join(dir, "src-tauri", "tauri.conf.json");
const ico = path.join(dir, "src-tauri", "icons", "icon.ico");
const tmp = "C:/dev/icon.ico";
const mode = process.argv[2] || "ascii";
fs.mkdirSync("C:/dev", { recursive: true });
if (mode === "ascii") fs.copyFileSync(ico, tmp);
let s = fs.readFileSync(conf, "utf8");
if (mode === "ascii") {
  s = s.replace(/"icons\/icon\.ico"/g, JSON.stringify(tmp));
  s = s.replace(/"icons\/icon\.icns"/g, JSON.stringify(tmp));
} else {
  s = s.split(JSON.stringify(tmp)).join('"icons/icon.ico"');
  // fix any icns that also got pointed at the ico temp
  s = s.replace(/("icon"\s*:\s*\[[^\]]*)"icons\/icon\.ico"(\s*,\s*)"icons\/icon\.ico"/, '$1"icons/icon.ico"$2"icons/icon.icns"');
}
fs.writeFileSync(conf, s);
console.log(mode, "->", (s.match(/icon[^",]*/g) || []).slice(0, 4));
