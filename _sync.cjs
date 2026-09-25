const fs = require("fs");
const map = [
  ["src-tauri/src/lib.rs", "C:/build/typet/src-tauri/src/lib.rs"],
  ["src-tauri/tauri.conf.json", "C:/build/typet/src-tauri/tauri.conf.json"],
  ["src-tauri/Cargo.toml", "C:/build/typet/src-tauri/Cargo.toml"],
  ["src/main.js", "C:/build/typet/src/main.js"],
];
for (const [a, b] of map) { fs.copyFileSync(a, b); console.log("staged", b); }
const files = ["src-tauri/tauri.conf.json", "src-tauri/Cargo.toml", "site/version.txt", "src/main.js"];
for (const f of files) {
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/0\.2\.4/g, "0.2.5"));
  fs.copyFileSync(f, "C:/build/typet/" + f);
  console.log("bumped+staged", f);
}
