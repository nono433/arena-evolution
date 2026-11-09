// Bot de test : se connecte, cherche des monstres, attaque, meurt, améliore.
const WebSocket = require('ws');
const name = process.argv[2] || 'Bot' + Math.floor(Math.random() * 999);
const secs = +process.argv[3] || 40;
const ws = new WebSocket('ws://localhost:3000');
let me, prof, snaps = 0, kills = 0, died = 0, lastSnap, log = [];
ws.on('open', () => ws.send(JSON.stringify({ t: 'login', n: name, p: 'secret', cls: 'warrior', hue: 200 })));
ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.t === 'loginerr') { console.log('LOGIN ERR', m.m); process.exit(1); }
  if (m.t === 'prof') prof = m.p;
  if (m.t === 'err') log.push('err:' + m.m);
  if (m.t === 'loot') kills++;
  if (m.t === 'died') { died++; log.push('died by ' + m.by); }
  if (m.t === 'snap') {
    snaps++; lastSnap = m;
    const s = m.me;
    // cible : monstre le plus proche
    let best = null, bd = 1e9;
    for (const e of m.m) { const dd = Math.hypot(e.x - s.x, e.y - s.y); if (dd < bd) { bd = dd; best = e; } }
    if (s.dead) { ws.send(JSON.stringify({ t: 'respawn' })); return; }
    if (best) {
      const a = Math.atan2(best.y - s.y, best.x - s.x);
      ws.send(JSON.stringify({ t: 'in', mx: bd > 70 ? Math.cos(a) : 0, my: bd > 70 ? Math.sin(a) : 0, a, ad: bd, atk: bd < 120 }));
      if (snaps % 20 === 0) ws.send(JSON.stringify({ t: 'skill', s: 0 }));
    } else ws.send(JSON.stringify({ t: 'in', mx: 1, my: 0.3, a: 0, ad: 100, atk: false }));
  }
});
setTimeout(() => {
  console.log(JSON.stringify({ name, snaps, kills, died, level: lastSnap && lastSnap.me.lv, hp: lastSnap && lastSnap.me.hp, gold: lastSnap && lastSnap.me.gold, monstersSeen: lastSnap && lastSnap.m.length, players: lastSnap && lastSnap.np, log: log.slice(0, 6), profKeys: prof && Object.keys(prof).length }));
  process.exit(0);
}, secs * 1000);
