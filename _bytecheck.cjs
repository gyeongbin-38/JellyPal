const fs = require("fs");
const needle = Buffer.from("JellypalSingleInstance", "utf8");
for (const p of [
  "C:/Jellypal/jellypal.exe",
  "C:/dev/mini/typet/src-tauri/target/release/jellypal.exe",
]) {
  const b = fs.readFileSync(p);
  console.log(p, b.includes(needle) ? "HAS mutex" : "NO mutex");
}
