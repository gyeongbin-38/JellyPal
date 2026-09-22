const fs = require("fs");
const p = process.env.APPDATA + "/com.jellypal.app/state.json";
const raw = fs.readFileSync(p, "utf8");
const s = JSON.parse(raw);
console.log("keys:", Object.keys(s).join(","));
console.log("pals:", JSON.stringify(s.pals).slice(0, 400));
for (const k of ["bowl","cushion","box","plant","music","mirror","mat","jar","egg","ball"]) {
  if (s[k] !== undefined) console.log(k, "=", JSON.stringify(s[k]).slice(0, 200));
}
console.log("pet:", s.petX, s.petY, "home:", s.petHome);
console.log("file size:", raw.length, "mtime:", fs.statSync(p).mtime.toISOString());
