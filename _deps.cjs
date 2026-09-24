const fs = require('fs');
const pals = fs.readFileSync('site/pals.js', 'utf8');
const ranch = fs.readFileSync('site/ranch.js', 'utf8');
const want = ['SPECIES','RARITY_COLOR','RARITY_NAME','LEG','WING_F','SPR','ACCS','FACES',
  'sprite','sprImg','wingImg','jellyImg','animProf','shapeVar','faceSet','hexRgb','mixRgb',
  'mixHex','makeHybrid','drawAccRaw','rng','spIndex','SILH','SHAPES','EYE_TPL','LEG_SPR'];
for (const w of want) {
  const inPals = new RegExp('\\b(function|const|let|var)\\s+' + w + '\\b').test(pals);
  const used = new RegExp('\\b' + w + '\\b').test(ranch);
  console.log(w.padEnd(14), 'pals:', inPals ? 'Y' : '-', '| used:', used ? 'Y' : '-',
    (used && !inPals) ? '  <<< MISSING' : '');
}
// any bare `sprite(` calls left with single arg?
console.log('single-arg sprite calls:', (ranch.match(/sprite\((?!")[^)]*\)/g) || []));
