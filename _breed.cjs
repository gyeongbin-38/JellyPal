const fs = require('fs');
const s = JSON.parse(fs.readFileSync(process.env.APPDATA + '/com.jellypal.app/state.json', 'utf8'));
console.log('owned:', JSON.stringify(s.owned));
console.log('jelly:', s.jelly, 'gems:', s.gems);
console.log('breedReadyAt:', s.breedReadyAt, 'now:', Date.now(), 'cd left(s):', Math.max(0, ((s.breedReadyAt||0)-Date.now())/1000));
console.log('hybrids:', JSON.stringify(s.hybrids));
console.log('stats:', JSON.stringify(s.stats));
