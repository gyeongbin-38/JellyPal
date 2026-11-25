const fs = require("fs");
const p = process.env.APPDATA + "/com.jellypal.app/";
for (const f of ["crash.log", "state.json"]) {
  try { console.log("== " + f); console.log(fs.readFileSync(p + f, "utf8").slice(-2000)); }
  catch (e) { console.log(f + " -> " + e.code); }
}
