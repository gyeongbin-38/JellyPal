const fs = require("fs");
const s = fs.readFileSync(process.env.APPDATA + "/com.jellypal.desktop/state.json", "utf8");
const j = JSON.parse(s);
console.log("uid:", JSON.stringify(j.uid));
console.log("claimed:", JSON.stringify(j.claimed));
console.log("savedAt:", new Date(j.savedAt).toISOString());
console.log("jelly:", j.jelly);
