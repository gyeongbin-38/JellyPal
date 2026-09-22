const fs = require('fs');
const s = JSON.parse(fs.readFileSync(process.env.APPDATA + '/com.jellypal.app/state.json', 'utf8'));
console.log('active:', s.active);
console.log('pals:', JSON.stringify(s.pals, null, 1));
