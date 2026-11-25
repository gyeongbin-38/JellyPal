const fs = require("fs"), path = require("path");
const SRC = "C:/dev/mini/typet", DST = "C:/build/typet";
const files = [
  "src-tauri/src/lib.rs", "src-tauri/Cargo.toml", "src-tauri/tauri.conf.json",
  "src/main.js", "src/index.html", "src/styles.css",
];
for (const f of files) {
  const s = path.join(SRC, f), d = path.join(DST, f);
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.copyFileSync(s, d);
  const same = fs.readFileSync(s).equals(fs.readFileSync(d));
  console.log(f, same ? "OK" : "MISMATCH!");
}
console.log("async check:", fs.readFileSync(path.join(DST, "src-tauri/src/lib.rs"), "utf8").includes("async fn redeem_bound"));
