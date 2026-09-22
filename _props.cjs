const fs = require('fs');
const s = JSON.parse(fs.readFileSync(process.env.APPDATA + '/com.jellypal.app/state.json', 'utf8'));
console.log(JSON.stringify(s.props, null, 1));
console.log('petHome:', s.petHome);
console.log('active:', s.active, 'pals:', (s.pals || []).length);
