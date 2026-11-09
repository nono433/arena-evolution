// Interfaces : forge (améliorations), classement, connexion.
const UI = (() => {
  const $ = id => document.getElementById(id);
  let P = null, defs = null, tab = 'stats', sel = null, canShop = false, send = () => { }, pendingFx = null, open = false;
  const LABEL = { dmg: 'Dégâts', hp: 'PV', def: 'Défense', spd: 'Vitesse', as: "Vit. d'attaque", regen: 'Régén.', crit: 'Critique' };
  const SUF = { dmg: '', hp: '', def: '', spd: '%', as: '%', regen: '/s', crit: '%' };
  const SLOT_ICON = { helmet: '🪖', armor: '🛡', boots: '👢', accessory: '💍' };
  const CLS_ICON = { warrior: '⚔️', mage: '🪄', ranger: '🏹' };
  const fmt = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function itemHTML(it, o = {}) {
    if (!it) return `<div class="item empty">${o.label || 'Vide'}</div>`;
    const R = defs.rarities[it.rar];
    const icon = it.slot === 'weapon' ? defs.weapons[it.kind].icon : SLOT_ICON[it.slot];
    const lines = Object.entries(it.stats).map(([k, v]) => `<div class="is">${LABEL[k]} +${fmt(v)}${SUF[k]}</div>`).join('');
    const bon = it.bonus.map(b => `<div class="ib">✦ ${defs.bonuses[b.k].name} +${fmt(b.v)}${defs.bonuses[b.k].unit}</div>`).join('');
    return `<div class="item rar${it.rar} ${o.sel ? 'sel' : ''}" style="--rc:${R.color}" ${o.act ? `data-act="${o.act}" data-id="${it.id}" data-i="${o.i ?? ''}"` : ''} data-fx="${it.id}">
      <span class="il">Niv ${it.lvl}</span><div class="ir">${R.name} · ${icon} ${it.slot === 'weapon' ? defs.weapons[it.kind].name : defs.slotNames[it.slot]}</div><div class="in">${esc(it.name)}</div>${lines}${bon}${o.extra || ''}</div>`;
  }
  const findItem = id => {
    if (!P || !id) return null;
    for (const s of defs.slots) if (P.equip[s] && P.equip[s].id === id) return { it: P.equip[s], where: 'equip' };
    const i = P.inv.find(x => x.id === id); return i ? { it: i, where: 'inv' } : null;
  };
  const btn = (act, label, attrs = '', cls = '', dis = false) => `<button class="btn small ${cls}" data-act="${act}" ${attrs} ${dis ? 'disabled' : ''}>${label}</button>`;

  function renderStats() {
    const st = P.st;
    const cur = {
      hp: st.maxHp + ' PV', dmg: fmt(st.dmg), def: fmt(st.def), spd: Math.round(st.spd / 230 * 100) + ' %', as: fmt(st.as) + '×', regen: fmt(st.regen) + ' PV/s', crit: fmt(st.crit) + ' %'
    };
    let h = '<div class="grid2"><div>';
    if (!canShop) h += '<div class="note warn">🔒 Retournez au Sanctuaire central pour dépenser vos ressources (ou attendez votre prochaine mort).</div>';
    for (const k in defs.stats) {
      const d = defs.stats[k], s = P.stats[k], pips = 20, on = Math.round(s.lv / d.max * pips);
      const can = canShop && s.cost !== null && P.gold >= s.cost;
      h += `<div class="stat" data-fx="stat-${k}"><div><b>${d.name}</b><small>${d.txt} par niveau</small></div>
        <div><b>${cur[k]}</b><small>Niveau ${s.lv} / ${d.max}</small><div class="pips">${Array.from({ length: pips }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div></div>
        ${s.cost === null ? '<span class="cost">MAX</span>' : btn('up', `Améliorer · 🪙 <span class="cost">${s.cost}</span>`, `data-k="${k}"`, can ? 'gold' : '', !can)}</div>`;
    }
    h += `</div><div class="sum"><h3>${esc(P.name)} · Niveau ${P.level}</h3>
      <div><span>Puissance</span><span>${st.power}</span></div><div><span>Vie maximale</span><span>${st.maxHp}</span></div><div><span>Dégâts de base</span><span>${fmt(st.dmg)}</span></div>
      <div><span>Défense (réduction)</span><span>${fmt(st.def)} (−${Math.round(st.def / (50 + st.def) * 100)} %)</span></div><div><span>Vitesse</span><span>${Math.round(st.spd)}</span></div>
      <div><span>Vitesse d'attaque</span><span>${fmt(st.as)}×</span></div><div><span>Régénération</span><span>${fmt(st.regen)} /s</span></div>
      <div><span>Critique</span><span>${fmt(st.crit)} % (×${fmt(st.critDmg)})</span></div><div><span>Vol de vie</span><span>${fmt(st.lifesteal)} %</span></div>
      <div><span>Bonus or / XP</span><span>+${fmt(st.goldfind)} % / +${fmt(st.xpfind)} %</span></div><div><span>Réduction de recharge</span><span>${fmt(st.cdr)} %</span></div>
      <div><span>Victoires JcJ</span><span>${P.pk}</span></div><div><span>Monstres vaincus</span><span>${P.mk}</span></div><div><span>Morts · meilleure série</span><span>${P.deaths} · ${P.best}</span></div>
    </div></div>`;
    return h;
  }

  function renderEquip() {
    let h = `<div class="eqgrid"><div><div class="slots">`;
    for (const s of defs.slots) {
      const it = P.equip[s];
      h += `<div class="slot"><div class="sn">${defs.slotNames[s]}</div>${itemHTML(it, { act: 'sel', sel: it && it.id === sel, label: 'Aucun équipement' })}</div>`;
    }
    h += `</div></div><div>`;
    const f = findItem(sel);
    if (f) {
      const it = f.it, cmp = f.where === 'inv' ? P.equip[it.slot] : null;
      let cm = '';
      if (cmp) {
        const keys = new Set([...Object.keys(it.stats), ...Object.keys(cmp.stats)]);
        cm = '<div style="margin-top:8px;font-size:13px"><b>Comparé à l\'équipé :</b> ' + [...keys].map(k => { const d = (it.stats[k] || 0) - (cmp.stats[k] || 0); return `<span class="delta ${d >= 0 ? 'up' : 'down'}">${LABEL[k]} ${d >= 0 ? '+' : ''}${fmt(d)}${SUF[k]}</span>`; }).join(' · ') + '</div>';
      } else if (f.where === 'inv') cm = '<div style="margin-top:8px;font-size:13px;color:var(--dim)">Emplacement vide.</div>';
      const upOk = canShop && it.up !== null && P.gold >= it.up;
      h += `<div class="detail"><div style="max-width:300px">${itemHTML(it)}</div>${cm}<div class="dact">
        ${f.where === 'inv' ? btn('equip', 'Équiper', `data-id="${it.id}"`, 'gold', !canShop) : btn('unequip', 'Déséquiper', `data-slot="${it.slot}"`, '', !canShop)}
        ${it.up === null ? '<span class="cost">Niveau max</span>' : btn('upg', `Améliorer (niv ${it.lvl + 1}) · 🪙 ${it.up}`, `data-id="${it.id}"`, upOk ? 'gold' : '', !upOk)}
        ${f.where === 'inv' ? btn('sell', `Vendre · 🪙 ${it.sell}`, `data-id="${it.id}"`, '', !canShop) : ''}</div></div>`;
    } else h += '<div class="note">Sélectionnez un objet pour le comparer, l\'équiper, l\'améliorer ou le vendre.</div>';
    h += `<div style="margin:6px 0 8px;color:var(--dim);font-size:13px">Inventaire (${P.inv.length}/${P.invMax})</div><div class="invgrid">`;
    if (!P.inv.length) h += '<div class="note" style="grid-column:1/-1">Inventaire vide. Les monstres élites et les boss laissent tomber des coffres ; la boutique propose aussi de l\'équipement.</div>';
    for (const it of P.inv) h += itemHTML(it, { act: 'sel', sel: it.id === sel });
    return h + '</div></div></div>';
  }

  function renderSkills() {
    let h = '';
    if (!canShop) h += '<div class="note warn">🔒 Retournez au Sanctuaire central pour apprendre ou améliorer des compétences.</div>';
    h += `<div class="note">Compétences actives : touches <b>1</b> à <b>4</b>. L'essence 💎 est obtenue sur les élites, les boss et les joueurs vaincus (parfois sur les autres monstres).</div><div class="skills">`;
    for (const id in defs.skills) {
      const d = defs.skills[id], s = P.skills[id], lv = s.lv;
      const slotIdx = P.bar.indexOf(id), can = canShop && s.cost !== null && P.ess >= s.cost;
      h += `<div class="skill ${lv ? '' : 'locked'}" data-fx="skill-${id}"><div class="sh"><div class="ic">${d.icon}</div><div style="flex:1"><h4>${d.name}</h4>
        <div class="pips">${Array.from({ length: d.maxLv }, (_, i) => `<i class="${i < lv ? 'on' : ''}" style="width:14px"></i>`).join('')}</div></div>
        ${s.cost === null ? '<span class="cost">MAX</span>' : btn('learn', `${lv ? 'Améliorer' : 'Apprendre'} · 💎 ${s.cost}`, `data-id="${id}"`, can ? 'gold' : '', !can)}</div>
        <p>${d.desc}</p>${lv ? `<div class="cur">Niv ${lv} : ${d.lvs[lv - 1].txt}</div>` : ''}${lv && lv < d.maxLv ? `<div class="nx">→ Niv ${lv + 1} : ${d.lvs[lv].txt}</div>` : ''}${!lv ? `<div class="nx">Niv 1 : ${d.lvs[0].txt}</div>` : ''}
        ${lv ? `<div class="slotsel">Emplacement : ${[0, 1, 2, 3].map(i => `<button class="${slotIdx === i ? 'on' : ''}" data-act="slot" data-id="${id}" data-s="${i}" ${canShop ? '' : 'disabled'}>${i + 1}</button>`).join('')}${slotIdx >= 0 ? `<button data-act="unslot" data-s="${slotIdx}" ${canShop ? '' : 'disabled'} title="Retirer">✕</button>` : ''}</div>` : ''}</div>`;
    }
    return h + '</div>';
  }

  function renderShop() {
    let h = '';
    if (!canShop) h += '<div class="note warn">🔒 La boutique n\'est accessible qu\'au Sanctuaire central ou après une mort.</div>';
    h += `<div class="note">L'étal est renouvelé à chaque mort. Plus vous montez en niveau, meilleur est l'équipement proposé.</div><div class="shop">`;
    P.shop.forEach((it, i) => {
      if (!it) { h += '<div class="item empty" style="display:flex;align-items:center;justify-content:center;min-height:120px">Vendu</div>'; return; }
      const ok = canShop && P.gold >= it.buy && P.inv.length < P.invMax;
      h += itemHTML(it, { extra: `<div class="price"><span>🪙 ${it.buy}</span>${btn('buy', 'Acheter', `data-i="${i}"`, ok ? 'gold' : '', !ok)}</div>` });
    });
    return h + `</div><div style="margin-top:16px">${btn('reroll', `🎲 Renouveler l'étal · 🪙 ${P.rerollCost}`, '', '', !canShop || P.gold < P.rerollCost)}</div>`;
  }

  function render() {
    if (!P || !open) return;
    const body = $('f-body'), keep = body.scrollTop;
    body.innerHTML = { stats: renderStats, equip: renderEquip, skills: renderSkills, shop: renderShop }[tab]();
    body.scrollTop = keep;
    $('f-lvl').textContent = P.level; $('f-gold').textContent = P.gold; $('f-ess').textContent = P.ess;
    $('f-state').textContent = canShop ? '' : '— lecture seule hors du Sanctuaire';
    document.querySelectorAll('#f-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  }

  // ───── effets visuels ─────
  const fxc = $('fx'), fxg = fxc.getContext('2d');
  let parts = [], fxRun = false;
  function burst(x, y, color, n = 36, spd = 260) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = spd * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.7 + Math.random() * 0.6, max: 1.3, c: color, sz: 2 + Math.random() * 4 }); }
    if (!fxRun) { fxRun = true; fxc.width = innerWidth; fxc.height = innerHeight; let last = performance.now(); const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; fxg.clearRect(0, 0, fxc.width, fxc.height); parts = parts.filter(p => p.life > 0); for (const p of parts) { p.life -= dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; fxg.globalAlpha = Math.max(0, p.life / p.max); fxg.fillStyle = p.c; fxg.shadowColor = p.c; fxg.shadowBlur = 8; fxg.fillRect(p.x, p.y, p.sz, p.sz); } fxg.globalAlpha = 1; if (parts.length) requestAnimationFrame(loop); else { fxRun = false; fxg.clearRect(0, 0, fxc.width, fxc.height); } }; requestAnimationFrame(loop); }
  }
  function applyFx(p) {
    if (!p) return;
    const el = document.querySelector(`[data-fx="${p.id}"]`) || document.querySelector(`[data-fx="${p.k}-${p.id}"]`) || document.querySelector(`[data-fx="stat-${p.id}"]`) || document.querySelector(`[data-fx="skill-${p.id}"]`);
    let color = '#ffd24a';
    if (p.k === 'skill') color = '#7be0ff';
    if (el) {
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, color, 40);
      burst(r.left + r.width / 2, r.top + r.height / 2, '#fff', 14, 160);
    } else burst(innerWidth / 2, innerHeight / 2, color, 30);
    ['f-gold', 'f-ess'].forEach(i => { const c = $(i).parentElement; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); });
  }

  // ───── classement ─────
  function boardHTML(rows, lastCol, me) {
    let h = `<div class="tr h"><span>#</span><span>Héros</span><span>Niv</span><span>Puiss.</span><span>JcJ</span><span>Monstres</span><span>${lastCol === 'score' ? 'Score' : 'Série'}</span></div>`;
    rows.forEach((r, i) => {
      const nm = r.n || r.name;
      h += `<div class="tr ${me && nm === me ? 'me' : ''}"><span class="rk">${i + 1}</span><span>${CLS_ICON[r.c || r.cls] || ''} ${esc(nm)}</span><span>${r.l || r.level}</span><span>${r.pw ?? r.power}</span><span>${r.k ?? r.pk}</span><span>${r.mk}</span><span>${lastCol === 'score' ? r.score : (r.s ?? r.best)}</span></div>`;
    });
    return h || '<div class="note">Aucun héros pour l\'instant.</div>';
  }

  return {
    init(sendFn, d) { send = sendFn; defs = d; },
    setDefs(d) { defs = d; },
    setProfile(p) { P = p; render(); if (pendingFx) { const f = pendingFx; pendingFx = null; applyFx(f); } },
    ok(k, id) { pendingFx = { k, id }; },
    get profile() { return P; },
    setCanShop(v) { if (v !== canShop) { canShop = v; render(); } },
    isOpen() { return open; },
    openForge() { open = true; $('menu').hidden = false; render(); },
    closeForge() { open = false; $('menu').hidden = true; },
    err(m) { const el = $('f-msg'); el.textContent = m; clearTimeout(el._t); el._t = setTimeout(() => el.textContent = '', 2500); },
    boardHTML, esc, CLS_ICON,
    bind() {
      $('f-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; render(); });
      $('f-body').addEventListener('click', e => {
        const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
        const a = t.dataset.act;
        if (a === 'sel') { sel = sel === t.dataset.id ? null : t.dataset.id; render(); }
        else if (a === 'up') send({ t: 'up', k: t.dataset.k });
        else if (a === 'buy') send({ t: 'buy', i: +t.dataset.i });
        else if (a === 'reroll') send({ t: 'reroll' });
        else if (a === 'equip') { send({ t: 'equip', id: t.dataset.id }); }
        else if (a === 'unequip') send({ t: 'unequip', slot: t.dataset.slot });
        else if (a === 'sell') { send({ t: 'sell', id: t.dataset.id }); sel = null; }
        else if (a === 'upg') send({ t: 'upg', id: t.dataset.id });
        else if (a === 'learn') send({ t: 'learn', id: t.dataset.id });
        else if (a === 'slot') send({ t: 'slot', id: t.dataset.id, s: +t.dataset.s });
        else if (a === 'unslot') send({ t: 'slot', id: null, s: +t.dataset.s });
      });
    }
  };
})();
