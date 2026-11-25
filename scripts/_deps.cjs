const fs = require('fs');
process.chdir(require("path").join(__dirname, ".."));
const pals = fs.readFileSync('site/pals.js', 'utf8');
const ranch = fs.readFileSync('site/ranch.js', 'utf8');
const spriteText = fs.readFileSync('site/sprite-text.js', 'utf8');
for (const [name, src] of [['pals.js', pals], ['ranch.js', ranch], ['sprite-text.js', spriteText]]) {
  try { new Function(src); }
  catch (e) { console.error(`FAIL ${name} syntax: ${e.message}`); process.exit(2); }
}
const want = ['SPECIES','RARITY_COLOR','RARITY_NAME','LEG','WING_F','SPR','ACCS','FACES',
  'sprite','sprImg','wingImg','jellyImg','animProf','shapeVar','faceSet','hexRgb','mixRgb',
  'mixHex','makeHybrid','drawAccRaw','rng','spIndex','SILH','SHAPES','EYE_TPL','LEG_SPR'];
const missing = [];
for (const w of want) {
  const inPals = new RegExp('\\b(function|const|let|var)\\s+' + w + '\\b').test(pals);
  const used = new RegExp('\\b' + w + '\\b').test(ranch);
  console.log(w.padEnd(14), 'pals:', inPals ? 'Y' : '-', '| used:', used ? 'Y' : '-',
    (used && !inPals) ? '  <<< MISSING' : '');
  if (used && !inPals) missing.push(w);
}
if (missing.length) process.exit(2);
console.log('SITE JS GREEN (syntax + shared dependencies)');
