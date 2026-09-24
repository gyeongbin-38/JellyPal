const h = require('fs').readFileSync('site/index.html', 'utf8');
for (const k of ['id="feed"', 'dexfilter', 'id="dexmore"', 'data-lico', 'recta', 'trust', 'window-demo'])
  console.log(k.padEnd(14), h.includes(k));
