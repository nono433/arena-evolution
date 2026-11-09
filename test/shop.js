// Test de la forge côté serveur : les améliorations modifient réellement les statistiques.
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');
const name = 'Shop' + Math.floor(Math.random() * 9999);
let prof, step = 0; const out = [];
const send = o => ws.send(JSON.stringify(o));
const wait = ms => new Promise(r => setTimeout(r, ms));
ws.on('open', () => send({ t: 'login', n: name, p: 'secret', cls: 'ranger', hue: 10 }));
ws.on('message', async d => {
  const m = JSON.parse(d);
  if (m.t === 'err') out.push('ERR ' + m.m);
  if (m.t === 'prof') prof = m.p;
  if (m.t === 'welcome' && !step) {
    step = 1; await wait(500);
    const s0 = { ...prof.st };
    const offer = prof.shop.findIndex(i => i && i.buy <= prof.gold);
    out.push('gold start ' + prof.gold);
    out.push('shop: ' + prof.shop.map(i => i && `${i.name}(${i.rar}) ${i.buy}`).join(' | '));
    if (offer >= 0) {
      const it = prof.shop[offer]; send({ t: 'buy', i: offer }); await wait(150);
      out.push(`acheté ${it.name}; inv=${prof.inv.length}`);
      send({ t: 'equip', id: it.id }); await wait(150);
      out.push(`équipé: ${prof.equip[it.slot] && prof.equip[it.slot].name}; stats ${JSON.stringify(prof.st).slice(0, 80)}`);
      send({ t: 'upg', id: it.id }); await wait(150);
      out.push(`item niv ${prof.equip[it.slot] && prof.equip[it.slot].lvl}`);
    }
    send({ t: 'learn', id: 'dash' }); await wait(150); send({ t: 'learn', id: 'shield' }); await wait(150);
    out.push('skills ' + JSON.stringify(Object.fromEntries(Object.entries(prof.skills).map(([k, v]) => [k, v.lv]))) + ' bar ' + JSON.stringify(prof.bar) + ' ess ' + prof.ess);
    send({ t: 'reroll' }); await wait(150);
    console.log(out.join('\n')); process.exit(0);
  }
});
