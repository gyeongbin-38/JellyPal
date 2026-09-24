const fs = require('fs');
let s = fs.readFileSync('site/ranch.js', 'utf8');
const R = (re, b, tag) => { let n = 0; s = s.replace(re, () => { n++; return b; }); console.log(tag, n); };

R(/sprite\(p\.spIdx\)/g, 'idleOf(p.spIdx)', 'sprite(spIdx)');
R(/spr\.w\b/g, 'spr.width', 'spr.w');
R(/spr\.h\b/g, 'spr.height', 'spr.h');

/* resolve blink overlay into a local face, then draw the face sprite */
R(/  ctx\.save\(\); ctx\.translate\(p\.x, p\.y \+ hov\);/,
  '  const face = (p.blink && (p.face === 0 || p.face === 1 || p.face === 2)) ? 3 : p.face;\n' +
  '  ctx.save(); ctx.translate(p.x, p.y + hov);', 'face resolve');
R(/ctx\.drawImage\(off, -spr\.width \/ 2 \| 0, -spr\.height \/ 2 \| 0\);/,
  'ctx.drawImage(sprOf(p.spIdx, face), -spr.width / 2 | 0, -spr.height / 2 | 0);', 'pal draw');

/* remove the whole tail offscreen block (dead drawPal pipeline) */
R(/\n  \/\* ---------- paint pal sprite into offscreen ---------- \*\/[\s\S]*?drawPal\(octx, p\.spIdx, 0, 0, face, true\);\n/, '\n', 'offscreen block');

R(/drawPal\(g, i, 0, 0, dc\.t > 0 \? face : 0, true\);/,
  'const fi = sprOf(i, dc.t > 0 ? face : 0); g.drawImage(fi, -fi.width / 2 | 0, -fi.height | 0);', 'dexreact');
R(/const im = sprite\(i\);/g, 'const im = idleOf(i);', 'dex im');
R(/sprite\(SPECIES\.findIndex\(s => s\.id === \(ICO_PAL\[k\] \|\| k\)\)\)/g,
  'idleOf(SPECIES.findIndex(s => s.id === (ICO_PAL[k] || k)))', 'ico im');

fs.writeFileSync('site/ranch.js', s);
console.log('left: drawPal', (s.match(/drawPal/g) || []).length,
  'sprite(p.spIdx)', (s.match(/sprite\(p\.spIdx\)/g) || []).length,
  'spr.w', (s.match(/spr\.w\b/g) || []).length,
  'octx', (s.match(/octx/g) || []).length,
  'sprite(i)', (s.match(/[^eO]sprite\(i\)/g) || []).length);
