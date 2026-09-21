// dev helper: unlock every species + accessory in the test save.
// Run while jellypal.exe is NOT running (it persists over the file otherwise).
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync("C:\\dev\\mini\\typet\\src\\main.js", "utf8");
// species entries: name is Capitalized ("Sprout"); accs are ALL-CAPS ("CAP")
const species = [...src.matchAll(/\{ id: "([a-z]+)", name: "[A-Z][a-z]+"/g)].map((m) => m[1]);
const accs = [...src.matchAll(/\{ id: "([a-z]+)", name: "[A-Z]+"/g)]
  .map((m) => m[1]).filter((id) => !species.includes(id));

const file = path.join(process.env.APPDATA, "com.jellypal.app", "state.json");
let s = {};
try { s = JSON.parse(fs.readFileSync(file, "utf8")); } catch { console.log("no existing save, creating"); }

const hyb = (s.owned || []).filter((id) => id.startsWith("hyb"));
s.owned = [...species, ...hyb];
s.accOwned = accs;
s.jelly = 99999;
s.seen = true;
s.active = "spidr"; // headline feature of the current batch
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(s));
console.log(`unlocked ${species.length} species + ${accs.length} accs, jelly=99999, active=${s.active}`);
