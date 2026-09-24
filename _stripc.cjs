const fs = require("fs");
const f = "site/index.html";
let s = fs.readFileSync(f, "utf8");
const a = s.indexOf('<script type="x-deleted"');
if (a < 0) { console.log("marker not found"); process.exit(1); }
const b = s.indexOf("</script>", a) + "</script>".length;
fs.writeFileSync(f, s.slice(0, a) + s.slice(b).trimStart());
console.log("removed " + (b - a) + " chars of dead code");
