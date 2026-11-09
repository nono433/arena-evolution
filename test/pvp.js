// Test PvP : A tue B, B meurt, B réapparaît ; vérifie la synchro et le classement.
const WebSocket = require('ws');
function client(name, cls) {
  const c = { name, snap: null, died: 0, prof: null, ws: new WebSocket('ws://localhost:3000') };
  c.send = o => c.ws.readyState === 1 && c.ws.send(JSON.stringify(o));
  c.ws.on('open', () => c.send({ t: 'login', n: name, p: 'secret', cls, hue: 100 }));
  c.ws.on('message', d => { const m = JSON.parse(d); if (m.t === 'snap') c.snap = m; if (m.t === 'prof') c.prof = m.p; if (m.t === 'died') c.died++; if (m.t === 'loginerr') console.log(name, m.m); });
  return c;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const sfx = Math.floor(Math.random() * 9999);
  const A = client('PvA' + sfx, 'warrior'), B = client('PvB' + sfx, 'mage');
  await wait(1200);
  for (const c of [A, B]) c.send({ t: 'in', mx: 1, my: 0, a: 0, ad: 0, atk: false });
  await wait(2500);
  for (const c of [A, B]) c.send({ t: 'in', mx: 0, my: 0, a: 0, ad: 0, atk: false });
  await wait(400);
  console.log('A', A.snap.me.x, A.snap.me.y, 'sees B?', A.snap.p.some(p => p.n === B.name), '| players online', A.snap.np);
  // A approche B et attaque
  const t0 = Date.now(); let bHp0 = B.snap.me.hp;
  while (Date.now() - t0 < 25000 && !B.died) {
    const a = A.snap.me, b = A.snap.p.find(p => p.n === B.name);
    if (!b) { await wait(100); continue; }
    const ang = Math.atan2(b.y - a.y, b.x - a.x), d = Math.hypot(b.x - a.x, b.y - a.y);
    A.send({ t: 'in', mx: d > 70 ? Math.cos(ang) : 0, my: d > 70 ? Math.sin(ang) : 0, a: ang, ad: d, atk: d < 110 });
    B.send({ t: 'in', mx: 0, my: 0, a: 0, ad: 0, atk: false });
    await wait(33);
  }
  A.send({ t: 'in', mx: 0, my: 0, a: 0, ad: 0, atk: false });
  await wait(1500);
  console.log('B died count', B.died, '| B dead flag', B.snap.me.dead, '| B hp before', bHp0);
  B.send({ t: 'respawn' }); await wait(1800); B.send({ t: 'respawn' }); await wait(600);
  console.log('B after respawn: dead', B.snap.me.dead, 'hp', B.snap.me.hp, 'sanct', B.snap.me.sanct, 'invuln flag', !!(B.snap.me.f & 4));
  console.log('A xp/gold', A.snap.me.xp, A.snap.me.gold, '| A pk', A.prof.pk);
  process.exit(0);
})();
