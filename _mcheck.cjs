const fs = require('fs');
const h = fs.readFileSync('site/index.html', 'utf8');
const r = fs.readFileSync('site/ranch.js', 'utf8');
console.log('mot:', h.includes('id="mot"'), '| safe:', h.includes('id="safe"'),
  '| 1.7MB:', h.includes('1.7 MB'), '| packbuy:', h.includes('packbuy'),
  '| navdl:', h.includes('navdl'), '| dexid:', h.includes('id="dex"'));
console.log('ranch: dex-sel', r.includes('getElementById("dex")'), '| data-ico', r.includes('dataset.ico'),
  '| leg-obj', r.includes('leg.starburst'), '| paused', r.includes('paused = !paused'));
