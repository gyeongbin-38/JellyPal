// extract the inline stripe-wiring <script> from index.html and syntax-check it
const fs = require("fs");
const h = fs.readFileSync("site/index.html", "utf8");
const m = h.match(/<script>\s*(\/\* -+ Stripe[\s\S]*?)<\/script>/);
if (!m) { console.error("NO INLINE SCRIPT FOUND"); process.exit(1); }
fs.writeFileSync("_payinline.js", m[1]);
require("child_process").execSync("node --check _payinline.js", { stdio: "inherit" });
fs.unlinkSync("_payinline.js");
// sanity: myid field, packbuy anchors, PAY_LINKS present
for (const s of ['id="myid"', 'data-pack="A"', 'data-pack="D"', "PAY_LINKS", "client_reference_id"])
  if (!h.includes(s)) { console.error("MISSING: " + s); process.exit(1); }
console.log("INLINE_OK");
