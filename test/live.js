const WebSocket = require('ws');
const ws = new WebSocket('wss://arena-evolution.onrender.com');
ws.on('open', () => ws.send(JSON.stringify({ t: 'login', n: 'TestPersist', p: 'secret1', cls: 'mage', hue: 180 })));
ws.on('message', d => { const m = JSON.parse(d); if (m.t === 'welcome') { console.log('connecté, id', m.id); setTimeout(() => { ws.close(); process.exit(0); }, 20000); } if (m.t === 'loginerr') { console.log(m.m); process.exit(1); } });
ws.on('error', e => { console.log('erreur', e.message); process.exit(1); });
