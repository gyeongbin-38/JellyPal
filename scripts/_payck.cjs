// Extract the inline checkout wiring from index.html and syntax-check it.
// The provider can change (Stripe -> Gumroad, etc.), so identify the block by
// its PAY_LINKS authority rather than a stale comment heading.
const fs = require("fs");
process.chdir(require("path").join(__dirname, ".."));
const h = fs.readFileSync("site/index.html", "utf8");
const scripts = [...h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const checkout = scripts.find((s) => /\bconst\s+PAY_LINKS\s*=/.test(s));
if (!checkout) { console.error("NO CHECKOUT SCRIPT FOUND"); process.exit(1); }
try { new Function(checkout); } catch (e) {
  console.error("CHECKOUT SCRIPT SYNTAX:", e.message);
  process.exit(1);
}
// Sanity: all pack anchors, provider-neutral links, Gumroad license handling,
// and the UID passthrough fallback for webhook-based providers remain wired.
for (const s of ['id="myid"', 'data-pack="A"', 'data-pack="D"', "PAY_LINKS", "isGumroad", "client_reference_id", "license key"])
  if (!h.includes(s)) { console.error("MISSING: " + s); process.exit(1); }
for (const pack of ["A", "B", "C", "D"])
  if (!new RegExp(`\\b${pack}\\s*:`).test(checkout)) { console.error("MISSING PACK: " + pack); process.exit(1); }
console.log("CHECKOUT WIRING GREEN");
