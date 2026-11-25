const fs = require('fs');
process.chdir(require("path").join(__dirname, ".."));
const h = fs.readFileSync('site/index.html', 'utf8');
const r = fs.readFileSync('site/ranch.js', 'utf8');
const checks = {
  motion: h.includes('id="mot"'),
  hashes: h.includes('id="safe"'),
  sizeCopy: (h.match(/1\.7 MB/g) || []).length >= 3 && h.includes('2.1 MB zip') && !h.includes('1.6 MB'),
  packBuy: h.includes('packbuy'),
  navDownload: h.includes('navdl'),
  dexCanvas: h.includes('id="dex"'),
  ranchDex: r.includes('getElementById("dex")'),
  ranchIcons: r.includes('dataset.ico'),
  legendaryFx: r.includes('leg.starburst'),
  pauseToggle: r.includes('paused = !paused'),
};
for (const [name, ok] of Object.entries(checks)) console.log(ok ? 'PASS' : 'FAIL', name);
if (Object.values(checks).some((ok) => !ok)) process.exit(2);
console.log(`SITE SURFACE GREEN (${Object.keys(checks).length}/${Object.keys(checks).length})`);
