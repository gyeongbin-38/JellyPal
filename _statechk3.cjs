const fs = require("fs");
const s = JSON.parse(fs.readFileSync(process.env.APPDATA + "/com.jellypal.app/state.json", "utf8"));
console.log("props:", JSON.stringify(s.props, null, 1));
console.log("fab:", JSON.stringify(s.fab));
console.log("panelPos:", JSON.stringify(s.panelPos));
console.log("bond:", JSON.stringify(s.bond).slice(0, 300));
console.log("hybrids:", (s.hybrids || []).length, "babies:", (s.hybrids || []).filter(h => Date.now() - h.bornAt < 36e5).length);
