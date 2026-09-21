// audit: which species fields (sig/trait/mv) are implemented vs declared
const s = require("fs").readFileSync("src/main.js", "utf8");
const spBlock = s.match(/const SPECIES = \[([\s\S]*?)\n\];/)[1];
// split into species objects by { id:
const chunks = spBlock.split(/\{ id: "/).slice(1).map((c) => '{ id: "' + c);
const species = chunks.map((c) => ({
  id: (c.match(/id: "(\w+)"/) || [])[1],
  name: (c.match(/name: "([^"]+)"/) || [])[1],
  r: +(c.match(/r: (\d)/) || [])[1],
  trait: (c.match(/trait: "(\w+)"/) || [])[1],
  mv: (c.match(/mv: "(\w+)"/) || [])[1],
  sig: (c.match(/sig: "(\w+)"/) || [])[1],
  kr: /kr: "/.test(c),
}));
// find where sig acts are dispatched — look for sigId comparisons
const sigRefs = new Set([...s.matchAll(/sigId === "(\w+)"/g)].map((m) => m[1]));
const sigRefs2 = new Set([...s.matchAll(/sig === "(\w+)"/g)].map((m) => m[1]));
const sigCase = new Set([...s.matchAll(/case "(\w+)"/g)].map((m) => m[1]));
const legKeys = new Set(Object.keys((0, eval)("(" + s.match(/const LEG = (\{[\s\S]*?\n\});/)[1] + ")")));
const traitRefs = new Set([...s.matchAll(/trait === "(\w+)"/g)].map((m) => m[1]));
const traitRefs2 = new Set([...s.matchAll(/\.trait === "(\w+)"/g)].map((m) => m[1]));
const mvRefs = new Set([...s.matchAll(/mv === "(\w+)"/g)].map((m) => m[1]));
console.log("=== LEGENDARY (r=3) ===");
for (const p of species.filter((p) => p.r === 3)) {
  console.log(`${p.id.padEnd(8)} ${p.name.padEnd(8)} trait=${(p.trait || "-").padEnd(8)} mv=${(p.mv || "-").padEnd(8)} sig=${(p.sig || "-").padEnd(10)} LEG=${legKeys.has(p.id) ? "Y" : "MISSING"} sigImpl=${sigRefs.has(p.sig) || sigRefs2.has(p.sig) || sigCase.has(p.sig) ? "Y" : "?"}`);
}
console.log("\n=== ALL sig values vs implementations ===");
const allSigs = [...new Set(species.filter((p) => p.sig).map((p) => p.sig))];
for (const sg of allSigs) {
  const impl = sigRefs.has(sg) || sigRefs2.has(sg) || sigCase.has(sg);
  const owners = species.filter((p) => p.sig === sg).map((p) => `${p.id}(r${p.r})`).join(",");
  console.log(`${sg.padEnd(12)} impl=${impl ? "Y" : "MISSING"}  <- ${owners}`);
}
console.log("\n=== ALL trait values vs implementations ===");
const allTraits = [...new Set(species.filter((p) => p.trait).map((p) => p.trait))];
for (const tr of allTraits) {
  const impl = traitRefs.has(tr) || traitRefs2.has(tr) || s.includes(`"${tr}"`);
  const owners = species.filter((p) => p.trait === tr).map((p) => `${p.id}(r${p.r})`).join(",");
  console.log(`${tr.padEnd(12)} refd=${impl ? "Y" : "n"}  <- ${owners}`);
}
console.log("\n=== ALL mv values vs implementations ===");
const allMvs = [...new Set(species.filter((p) => p.mv).map((p) => p.mv))];
for (const mv of allMvs) {
  const owners = species.filter((p) => p.mv === mv).map((p) => `${p.id}(r${p.r})`).join(",");
  console.log(`${mv.padEnd(12)} refd=${mvRefs.has(mv) ? "Y" : "n"}  <- ${owners}`);
}
console.log("\n=== species without sig (r>=2) ===");
for (const p of species.filter((p) => p.r >= 2 && !p.sig)) console.log(`${p.id}(r${p.r}) ${p.name}`);
console.log("\n=== LEG keys ===", [...legKeys].join(","));
