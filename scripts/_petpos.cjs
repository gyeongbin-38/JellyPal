const fs = require("fs");
const s = JSON.parse(fs.readFileSync(process.env.APPDATA + "/com.jellypal.app/state.json", "utf8"));
console.log("petX:", s.petX, "petY:", s.petY, "petSp:", s.petSp);
console.log("savedAt:", new Date(s.savedAt || 0).toISOString());
for (const p of s.pals || []) console.log("pal:", p.sp, "x:", p.x, "y:", p.y);
console.log("props:", s.props ? Object.keys(s.props).join(",") : "none");
