const fs = require("fs");
const p = process.env.APPDATA + "/com.jellypal.app/state.json";
const s = fs.statSync(p);
console.log("mtime :", s.mtime.toISOString());
console.log("now   :", new Date().toISOString());
const j = JSON.parse(fs.readFileSync(p, "utf8"));
console.log("savedAt:", new Date(j.savedAt).toISOString());
