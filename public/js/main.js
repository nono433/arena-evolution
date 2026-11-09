// Client : réseau, entrées, prédiction, rendu, effets.
(() => {
  const $ = id => document.getElementById(id);
  const S = Shared, TAU = Math.PI * 2;
  const cv = $('c'), ctx = cv.getContext('2d');
  const RC = Art.RC;
  const OUT = 'drop-shadow(1px 0 0 #140a18) drop-shadow(-1px 0 0 #140a18) drop-shadow(0 1px 0 #140a18) drop-shadow(0 -1px 0 #140a18) drop-shadow(0 6px 5px rgba(0,0,0,.25))';
  let ws = null, defs = null, bg = null, miniBg = null, col = null, obstacles = [], myId = 0, prof = null, me = null, board = [], npl = 1;
  let pred = null, rtt = 40, shake = 0, hitFlash = 0, lastBarKey = '', lastZone = '', wantRespawn = false, deathT = 0;
  const players = new Map(), monsters = new Map(), projs = new Map();
  let drops = [], hazards = [], parts = [], target = null, targetT = 0;
  const cam = { x: S.CX, y: S.CY, z: 1 };
  const meE = { id: 0, walk: 0, sw: 0, flash: 0, lx: 0, ly: 0, mv: 0 };
  const keys = new Set(); let mouse = { x: 0, y: 0, down: false }, aim = 0, aimDist = 0, dpr = 1, W = 0, H = 0;
  const rand = (a, b) => a + Math.random() * (b - a);
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  // ───────── audio (synthétisé, discret) ─────────
  let actx = null; const lastS = {};
  function sfx(type) {
    try {
      const now = performance.now(); if (now - (lastS[type] || 0) < 60) return; lastS[type] = now;
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, P = { hit: ['square', 240, 110, .09, .05], swing: ['sawtooth', 380, 140, .08, .03], hurt: ['sawtooth', 160, 60, .2, .08], skill: ['sine', 300, 900, .2, .07], level: ['triangle', 400, 1200, .5, .09], boom: ['sawtooth', 120, 40, .3, .09], coin: ['sine', 900, 1400, .1, .05] }[type];
      if (!P) return;
      const o = actx.createOscillator(), g = actx.createGain(); o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
      g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[3]); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + P[3] + .02);
    } catch (e) { }
  }

  // ───────── écrans d'entrée ─────────
  const show = id => { for (const s of ['screen-main', 'screen-login', 'screen-board', 'screen-help']) $(s).hidden = s !== id; };
  let selCls = 'warrior', selHue = 215;
  const HUES = [0, 28, 52, 120, 180, 215, 270, 320];
  const prevs = [];
  function buildLogin() {
    const cp = $('class-pick'); cp.innerHTML = '';
    for (const k in CLASS_DEFS) {
      const d = CLASS_DEFS[k], el = document.createElement('div'); el.className = 'cls' + (k === selCls ? ' on' : ''); el.dataset.k = k;
      el.innerHTML = `<canvas width="64" height="76"></canvas><b>${d.name}</b><small>${d.desc}</small>`;
      el.onclick = () => { selCls = k; document.querySelectorAll('.cls').forEach(c => c.classList.toggle('on', c.dataset.k === k)); };
      cp.appendChild(el); prevs.push({ c: el.querySelector('canvas'), k });
    }
    const hp = $('hue-pick'); hp.innerHTML = '';
    HUES.forEach(h => { const el = document.createElement('div'); el.className = 'hue' + (h === selHue ? ' on' : ''); el.style.background = `hsl(${h},70%,50%)`; el.style.color = `hsl(${h},70%,50%)`; el.onclick = () => { selHue = h; document.querySelectorAll('.hue').forEach(x => x.classList.toggle('on', x === el)); }; hp.appendChild(el); });
    try { const sv = JSON.parse(localStorage.getItem('ae-login') || '{}'); if (sv.n) $('in-name').value = sv.n; } catch (e) { }
  }
  const CLASS_DEFS = { warrior: { name: 'Guerrier', weapon: 'sword', desc: 'Corps à corps. Onde de choc.' }, mage: { name: 'Mage', weapon: 'staff', desc: 'Magie à distance. Boule de feu.' }, ranger: { name: 'Rôdeur', weapon: 'bow', desc: 'Arc et agilité. Ruée.' } };
  function previewLoop(t) {
    if (!$('screen-login').hidden) for (const p of prevs) { const g = p.c.getContext('2d'); g.clearRect(0, 0, 64, 76); Art.hero(g, { x: 32, y: 70, a: 0.4, c: p.k, u: selHue, w: CLASS_DEFS[p.k].weapon, e: [-1, -1, -1, -1, 0], mv: 0, walk: 0, id: 1, f: 0 }, t / 1000); }
    requestAnimationFrame(previewLoop);
  }
  $('b-play').onclick = () => show('screen-login');
  $('b-help').onclick = () => show('screen-help'); $('h-back').onclick = () => show('screen-main');
  $('l-back').onclick = () => show('screen-main'); $('bd-back').onclick = () => show('screen-main');
  $('b-board').onclick = async () => {
    show('screen-board'); $('board-list').innerHTML = '<div class="note">Chargement…</div>';
    try { const r = await (await fetch('/api/leaderboard')).json(); $('board-list').innerHTML = UI.boardHTML(r, 'score'); } catch (e) { $('board-list').innerHTML = '<div class="note">Serveur injoignable.</div>'; }
  };
  $('l-go').onclick = connect;
  $('in-pass').addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
  $('in-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('in-pass').focus(); });

  function connect() {
    const n = $('in-name').value.trim(), p = $('in-pass').value;
    $('login-err').textContent = '';
    if (n.length < 3) return $('login-err').textContent = 'Le nom doit faire au moins 3 caractères.';
    if (p.length < 3) return $('login-err').textContent = 'Mot de passe : 3 caractères minimum.';
    try { localStorage.setItem('ae-login', JSON.stringify({ n })); } catch (e) { }
    sfx('coin');
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => send({ t: 'login', n, p, cls: selCls, hue: selHue });
    ws.onmessage = ev => onMsg(JSON.parse(ev.data));
    ws.onclose = () => { if (myId) $('conn').hidden = false; else $('login-err').textContent = 'Connexion au serveur impossible.'; };
    ws.onerror = () => { };
  }

  // ───────── messages serveur ─────────
  function onMsg(m) {
    switch (m.t) {
      case 'loginerr': $('login-err').textContent = m.m; ws.close(); ws = null; break;
      case 'welcome': startGame(m); break;
      case 'prof': prof = m.p; UI.setProfile(prof); $('h-name').textContent = prof.name; $('h-lvl').textContent = prof.level; buildBar(); break;
      case 'snap': onSnap(m); break;
      case 'board': board = m.rows; if (!$('tabboard').hidden) $('tab-list').innerHTML = UI.boardHTML(board, 'streak', prof && prof.name); break;
      case 'err': UI.err(m.m); toast(m.m, 'err'); break;
      case 'ok': UI.ok(m.k, m.id); sfx('coin'); break;
      case 'toast': toast(m.m, m.k, m.r); if (m.k === 'level') sfx('level'); break;
      case 'loot': sfx('coin'); break;
      case 'died': $('d-by').textContent = 'Terrassé par ' + m.by; $('death').hidden = false; wantRespawn = false; deathT = performance.now(); setTimeout(() => { $('death').hidden = true; if (me && me.dead) openForge(); }, 1700); break;
      case 'pong': rtt = rtt * 0.6 + (performance.now() - m.c) * 0.4; $('h-ping').textContent = Math.round(rtt) + ' ms'; break;
    }
  }
  function startGame(m) {
    defs = m.defs; myId = m.id; obstacles = m.world.obstacles.slice().sort((a, b) => a.y - b.y);
    col = S.makeCollider(m.world.obstacles);
    UI.init(send, defs); UI.bind();
    bg = Art.buildBackground(obstacles);
    miniBg = document.createElement('canvas'); miniBg.width = 200; miniBg.height = 150; const mg = miniBg.getContext('2d'); mg.drawImage(bg, 0, 0, 200, 150);
    for (const o of obstacles) { mg.fillStyle = 'rgba(0,0,0,.35)'; mg.fillRect(o.x / 16 - 1, o.y / 16 - 1, 2, 2); }
    ['screen-main', 'screen-login', 'screen-board', 'screen-help'].forEach(s => $(s).hidden = true);
    $('hud').hidden = false; ctx.imageSmoothingQuality = 'high';
  }

  function toast(msg, k, r) {
    const d = document.createElement('div'); d.className = 'toast ' + (k || ''); d.textContent = msg;
    if (k === 'item') d.style.borderColor = RC[r || 0];
    if (k === 'err') d.style.borderColor = '#ff6a6a';
    $('toasts').appendChild(d); setTimeout(() => d.remove(), 3600);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }

  // ───────── snapshots & interpolation ─────────
  function upsert(map, list, now) {
    for (const it of list) {
      let e = map.get(it.i);
      if (!e) { e = { id: it.i, snaps: [], walk: 0, sw: 0, flash: 0, lx: it.x, ly: it.y, obj: {} }; map.set(it.i, e); }
      e.d = it; e.snaps.push({ t: now, x: it.x, y: it.y, a: it.a }); if (e.snaps.length > 5) e.snaps.shift(); e.seen = now;
    }
    for (const [k, e] of map) if (e.seen !== now) map.delete(k);
  }
  function sample(e, rt) {
    const s = e.snaps, n = s.length;
    if (n === 1 || rt >= s[n - 1].t) return s[n - 1];
    if (rt <= s[0].t) return s[0];
    for (let i = 1; i < n; i++) if (rt <= s[i].t) {
      const a = s[i - 1], b = s[i], k = (rt - a.t) / (b.t - a.t);
      if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 320) return k < 0.5 ? a : b;
      let da = b.a - a.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: a.a + da * k };
    }
    return s[n - 1];
  }
  function onSnap(s) {
    const now = performance.now(); me = s.me; npl = s.np;
    if (!pred) pred = { x: me.x, y: me.y };
    upsert(players, s.p, now); upsert(monsters, s.m, now); upsert(projs, s.pr, now);
    drops = s.dr; hazards = s.hz.map(h => ({ ...h, t0: now, t: h.t }));
    for (const e of s.ev) handleEvent(e);
    UI.setCanShop(!!me.shopOk);
    if (wantRespawn && !me.dead) { wantRespawn = false; UI.closeForge(); }
    $('h-online').textContent = npl;
  }

  // ───────── effets ─────────
  const P = o => parts.push(o);
  function sparks(x, y, c, n, sp, life, g = 0, sz = 3, yo = -24) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (0.3 + Math.random()); P({ k: 'dot', x, y: y + yo, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, life: life * (0.6 + Math.random() * 0.6), max: life, sz: sz * (0.6 + Math.random()), c }); } }
  function ring(x, y, r0, r1, life, c, lw = 4, yo = 0) { P({ k: 'ring', x, y: y + yo, r0, r1, life, max: life, c, lw }); }
  function entOf(i, isP) { return isP ? (i === myId ? meE : players.get(i)) : monsters.get(i); }
  function handleEvent(e) {
    switch (e.e) {
      case 'hit': {
        const mine = e.m === 1 && e.i === myId;
        const c = e.a ? '#8fd8ff' : e.f ? '#ffa040' : e.m ? (mine ? '#ff5050' : '#ff9a9a') : (e.c ? '#ffe14a' : '#ffffff');
        P({ k: 'text', x: e.x + rand(-12, 12), y: e.y - 56, vy: -80, txt: e.a ? 'Absorbé' : String(e.v), life: .9, max: .9, sz: e.c ? 28 : (mine ? 20 : 16), c, crit: e.c });
        sparks(e.x, e.y, e.m ? '#ff4a4a' : (e.c ? '#ffe14a' : '#fff6d0'), e.c ? 12 : 6, 220, .35, 300, 3);
        const en = entOf(e.i, e.m === 1); if (en) en.flash = .12;
        if (mine) { shake = Math.min(16, 4 + e.v / (me.H || 100) * 70); hitFlash = .35; sfx('hurt'); } else if (!e.m && !e.f) sfx('hit');
        if (!e.m && !e.f && monsters.has(e.i)) { target = e.i; targetT = performance.now(); }
        break;
      }
      case 'swing': {
        const en = entOf(e.i, true); if (en) en.sw = .28;
        const col0 = RC[(e.i === myId ? (me.eq[4]) : ((players.get(e.i) || { d: { e: [0, 0, 0, 0, 0] } }).d.e[4])) || 0];
        if (e.rg) P({ k: 'arc', x: e.x, y: e.y - 24, a: e.a, rg: e.rg, arc: e.arc * Math.PI / 180, life: .22, max: .22, c: col0 });
        else { P({ k: 'dot', x: e.x + Math.cos(e.a) * 22, y: e.y - 26 + Math.sin(e.a) * 12, vx: Math.cos(e.a) * 100, vy: Math.sin(e.a) * 100, g: 0, life: .2, max: .2, sz: 6, c: '#fff' }); }
        if (e.i === myId) sfx('swing');
        break;
      }
      case 'dash': {
        for (let i = 0; i < 10; i++) P({ k: 'dot', x: e.x + rand(-8, 8) - Math.cos(e.a) * i * 10, y: e.y - 18 + rand(-14, 6), vx: 0, vy: -10, g: 0, life: .35, max: .35, sz: rand(5, 11), c: e.s ? 'rgba(140,200,255,.55)' : 'rgba(220,220,220,.4)' });
        if (e.i === myId) sfx('swing'); break;
      }
      case 'tele': { const c = e.k === 'wraith' ? '#b88aff' : '#7be0ff'; ring(e.x, e.y, 6, 60, .4, c, 4, -20); sparks(e.x, e.y, c, 18, 200, .5, -100, 4); break; }
      case 'nova': {
        ring(e.x, e.y, 10, e.r, .45, e.q ? '#cfe6ff' : '#ffe8a0', 7, -4); ring(e.x, e.y, 4, e.r * .7, .35, '#fff', 3, -4);
        for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; P({ k: 'dot', x: e.x, y: e.y, vx: Math.cos(a) * e.r * 2.2, vy: Math.sin(a) * e.r * 1.2, g: 0, life: .4, max: .4, sz: 6, c: 'rgba(255,230,160,.8)' }); }
        shake = Math.max(shake, 6); sfx('boom'); break;
      }
      case 'boom': {
        const c = e.k === 'fire' ? ['#ffe08a', '#ff7a1a'] : e.k === 'rock' ? ['#c8c0b0', '#7a7060'] : e.k === 'slam' ? ['#e8d8b0', '#a08860'] : ['#ffd070', '#ff4a1a'];
        ring(e.x, e.y, 8, e.r, .4, c[1], 8, -4); ring(e.x, e.y, 4, e.r * .6, .3, c[0], 4, -4);
        sparks(e.x, e.y, c[0], 14, e.r * 2.4, .6, 200, 5, -6); sparks(e.x, e.y, c[1], 18, e.r * 2, .7, 120, 6, -6);
        if (Math.hypot(e.x - (pred ? pred.x : e.x), e.y - (pred ? pred.y : e.y)) < 600) { shake = Math.max(shake, e.k === 'slam' || e.k === 'meteor' ? 9 : 4); sfx('boom'); }
        break;
      }
      case 'pop': sparks(e.x, e.y, e.k === 'arrow' ? '#e8e0c8' : '#9ad8ff', 5, 120, .25, 0, 2.5); break;
      case 'heal': { for (let i = 0; i < 10; i++) P({ k: 'text', x: e.x + rand(-16, 16), y: e.y - 20 - rand(0, 20), vy: -50, txt: '+', life: .9, max: .9, sz: 18, c: '#6dff9a' }); ring(e.x, e.y, 10, 44, .5, '#6dff9a', 3, -4); break; }
      case 'shield': ring(e.x, e.y, 10, 50, .5, '#8fd8ff', 4, -24); sfx('skill'); break;
      case 'cast': { sparks(e.x + Math.cos(e.a) * 24, e.y, '#ffb040', 8, 160, .3, 0, 4); sfx('skill'); break; }
      case 'levelup': {
        P({ k: 'pillar', x: e.x, y: e.y, life: 1.2, max: 1.2, c: '#ffd24a' }); ring(e.x, e.y, 10, 120, .9, '#ffd24a', 6, -4); ring(e.x, e.y, 10, 80, .7, '#fff', 3, -4);
        for (let i = 0; i < 40; i++) P({ k: 'dot', x: e.x + rand(-24, 24), y: e.y, vx: rand(-40, 40), vy: rand(-260, -80), g: 120, life: rand(.7, 1.4), max: 1.4, sz: rand(2, 5), c: '#ffe08a' });
        P({ k: 'text', x: e.x, y: e.y - 90, vy: -40, txt: 'NIVEAU ' + e.l + ' !', life: 1.8, max: 1.8, sz: 30, c: '#ffd24a', crit: 1 });
        if (e.i === myId) { sfx('level'); } break;
      }
      case 'die': { sparks(e.x, e.y, '#ff6a6a', 22, 260, .8, 200, 4); P({ k: 'text', x: e.x, y: e.y - 60, vy: -30, txt: '💀', life: 1.4, max: 1.4, sz: 34, c: '#fff' }); ring(e.x, e.y, 10, 70, .6, '#ff4a4a', 5, -4); break; }
      case 'mdie': {
        const c = { slime: '#7be07a', bat: '#a66ad0', skeleton: '#efe8d0', brute: '#78b250', wraith: '#a98cff', ogre: '#d6a878', golem: '#a0a6b4', dragon: '#ff7a3a' }[e.k] || '#ccc';
        sparks(e.x, e.y, c, 18 + e.r, 240, .7, 260, 5, -20); ring(e.x, e.y, 6, e.r * 2.2, .4, c, 4, -10);
        if (e.r > 40) { shake = Math.max(shake, 12); ring(e.x, e.y, 10, 220, .8, '#ffd24a', 6, -6); }
        for (let i = 0; i < 4; i++) P({ k: 'dot', x: e.x, y: e.y - 20, vx: rand(-90, 90), vy: rand(-220, -120), g: 600, life: .8, max: .8, sz: 5, c: '#ffd24a' });
        break;
      }
      case 'spawn': ring(e.x, e.y, 10, 90, .7, '#8fd8ff', 5, -4); sparks(e.x, e.y, '#bfe6ff', 24, 160, .9, -140, 3, 0); break;
      case 'breath': P({ k: 'cone', x: e.x, y: e.y - 40, a: e.a, r: e.r, arc: Math.PI * .42, life: .6, max: .6 }); shake = Math.max(shake, 7); break;
      case 'alert': { const a = $('alert'); a.textContent = '⚠ ' + e.m; a.hidden = false; a.style.animation = 'none'; void a.offsetWidth; a.style.animation = ''; clearTimeout(a._t); a._t = setTimeout(() => a.hidden = true, 3300); sfx('boom'); break; }
      case 'feed': { const d = document.createElement('div'); d.textContent = e.m; d.style.color = e.c || '#ddd'; $('feed').appendChild(d); setTimeout(() => d.remove(), 7000); while ($('feed').children.length > 6) $('feed').firstChild.remove(); break; }
    }
  }

  // ───────── entrées ─────────
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const SKILL_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
  const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
  function openForge() { if (!prof) return; send({ t: 'getprof' }); UI.openForge(); $('f-go').textContent = me && me.dead ? "⚔ Retourner dans l'arène" : 'Fermer'; }
  $('f-go').onclick = () => {
    if (me && me.dead) { wantRespawn = true; send({ t: 'respawn' }); const iv = setInterval(() => { if (!me || !me.dead || !wantRespawn) return clearInterval(iv); send({ t: 'respawn' }); }, 250); }
    else UI.closeForge();
  };
  addEventListener('keydown', e => {
    if (typing() || !myId) return;
    if (e.code === 'Tab') { e.preventDefault(); $('tabboard').hidden = false; $('tab-list').innerHTML = UI.boardHTML(board, 'streak', prof && prof.name); return; }
    if (e.code === 'Escape') { if (UI.isOpen() && me && !me.dead) UI.closeForge(); return; }
    if (e.code === 'KeyB' || e.code === 'KeyI') { if (UI.isOpen()) { if (me && !me.dead) UI.closeForge(); } else if (me && $('death').hidden) { openForge(); } return; }
    if (UI.isOpen()) return;
    if (MOVE[e.code]) { keys.add(e.code); e.preventDefault(); }
    else if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) send({ t: 'dodge' }); }
    else if (e.code in SKILL_KEYS) { if (!e.repeat) send({ t: 'skill', s: SKILL_KEYS[e.code] }); }
  });
  addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Tab') $('tabboard').hidden = true; });
  addEventListener('blur', () => { keys.clear(); mouse.down = false; $('tabboard').hidden = true; });
  cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  cv.addEventListener('mousedown', e => { mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 0) mouse.down = true; else if (e.button === 2) send({ t: 'skill', s: 0 }); });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  function moveVec() { let x = 0, y = 0; for (const k of keys) { const m = MOVE[k]; if (m) { x += m[0]; y += m[1]; } } const l = Math.hypot(x, y); return l ? [x / l, y / l] : [0, 0]; }
  setInterval(() => {
    if (!myId || !ws || ws.readyState !== 1) return;
    const [mx, my] = UI.isOpen() ? [0, 0] : moveVec();
    send({ t: 'in', mx, my, a: +aim.toFixed(3), ad: Math.round(aimDist), atk: mouse.down && !UI.isOpen() });
  }, 33);
  setInterval(() => send({ t: 'ping', c: performance.now() }), 2000);

  // ───────── HUD ─────────
  const cache = {};
  function setTxt(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
  function buildBar() {
    if (!prof || !defs) return;
    const key = JSON.stringify(prof.bar) + JSON.stringify(Object.values(prof.skills).map(s => s.lv));
    if (key === lastBarKey) return; lastBarKey = key;
    let h = `<div class="sk dodge" id="sk-d"><span class="key">␣</span>🌀<div class="cd"></div></div>`;
    prof.bar.forEach((id, i) => {
      if (!id) { h += `<div class="sk empty" id="sk-${i}"><span class="key">${i + 1}</span>vide</div>`; return; }
      h += `<div class="sk ready" id="sk-${i}" title="${defs.skills[id].name}"><span class="key">${i + 1}</span>${defs.skills[id].icon}<span class="lv">${prof.skills[id].lv}</span><div class="cd"></div><div class="cdt"></div></div>`;
    });
    $('skillbar').innerHTML = h;
  }
  function updateHud() {
    if (!me) return;
    $('h-hp').style.transform = `scaleX(${Math.max(0, me.hp / me.H)})`; $('h-shield').style.transform = `scaleX(${Math.min(1, me.sh / me.H)})`;
    setTxt('h-hptxt', `${me.hp} / ${me.H}` + (me.sh ? ` (+${me.sh})` : ''));
    $('h-xp').style.transform = `scaleX(${Math.min(1, me.xp / me.xn)})`; setTxt('h-xptxt', `${me.xp} / ${me.xn} XP`);
    setTxt('h-lvl', me.lv); setTxt('h-gold', me.gold); setTxt('h-ess', me.ess); setTxt('h-streak', me.streak >= 2 ? `🔥 série ${me.streak}` : '');
    if (prof && (prof.gold !== me.gold || prof.ess !== me.ess)) { /* le profil est mis à jour à chaque transaction */ }
    for (let i = 0; i < 4; i++) {
      const el = $('sk-' + i), b = me.bar[i]; if (!el || !b) continue;
      const cd = el.querySelector('.cd'), t = el.querySelector('.cdt');
      cd.style.transform = `scaleY(${b.r > 0 ? Math.min(1, b.r / b.t) : 0})`; const txt = b.r > 0 ? b.r.toFixed(b.r < 10 ? 1 : 0) : ''; if (t.textContent !== txt) t.textContent = txt; el.classList.toggle('ready', b.r <= 0);
    }
    const d = $('sk-d'); if (d) { d.querySelector('.cd').style.transform = `scaleY(${me.dcd > 0 ? Math.min(1, me.dcd / me.dT) : 0})`; d.classList.toggle('ready', me.dcd <= 0); }
    const hint = $('hint');
    if (me.sanct && !me.dead && !UI.isOpen()) { hint.hidden = false; hint.textContent = '🛡 Sanctuaire — zone sûre. Appuyez sur B pour ouvrir la Forge'; } else hint.hidden = true;
    const z = S.zoneAt(pred.x, pred.y); if (z !== lastZone) { lastZone = z; setTxt('h-zone', S.ZONE_NAMES[z]); }
  }
  // cible survolée
  function updateTarget(rt) {
    const wm = toWorld(mouse.x, mouse.y); let best = null, bd = 70;
    for (const e of monsters.values()) { const s = sample(e, rt), d = Math.hypot(s.x - wm.x, s.y - 24 - wm.y); const rr = (defs.monsters[e.d.k].r || 20) + 40; if (d < Math.max(bd, 0) && d < rr) { bd = d; best = { t: 'm', e }; } }
    for (const e of players.values()) { const s = sample(e, rt), d = Math.hypot(s.x - wm.x, s.y - 24 - wm.y); if (d < bd) { bd = d; best = { t: 'p', e }; } }
    let info = best;
    if (!info && target && performance.now() - targetT < 2500 && monsters.has(target)) info = { t: 'm', e: monsters.get(target) };
    const el = $('target');
    if (!info) { el.hidden = true; return; }
    el.hidden = false; const d = info.e.d;
    if (info.t === 'm') { const df = defs.monsters[d.k]; setTxt('t-name', df.name); setTxt('t-info', `${defs.catNames[df.cat]} · Niv ${d.l}`); }
    else { setTxt('t-name', d.n); setTxt('t-info', `Joueur · Niv ${d.l}`); }
    $('t-hp').style.transform = `scaleX(${Math.max(0, d.h / d.H)})`;
  }

  // ───────── rendu ─────────
  function resize() { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cam.z = Math.max(0.8, Math.min(1.5, H / 760)); }
  addEventListener('resize', resize); resize();
  const toWorld = (mx, my) => ({ x: cam.x + (mx - W / 2) / cam.z, y: cam.y + (my - H / 2) / cam.z });

  function nameTag(x, y, txt, color, lvl) {
    ctx.font = 'bold 13px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    const t = lvl ? `${txt}  ·  ${lvl}` : txt; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function hpBar(x, y, w, ratio, c1, c2) {
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 7);
    ctx.fillStyle = Art.lin(ctx, x - w / 2, y, x - w / 2, y + 5, [[0, c1], [1, c2]]); ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), 5);
  }
  function telegraph(e, s, t) {
    const d = e.d, p = d.p || 0, a = s.a, al = 0.12 + p * 0.3;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
    const lineT = (len, w) => { ctx.fillStyle = `rgba(255,60,40,${al})`; ctx.fillRect(0, -w / 2, len, w); ctx.strokeStyle = `rgba(255,120,80,${al + .25})`; ctx.lineWidth = 2; ctx.strokeRect(0, -w / 2, len, w); };
    const cone = (r, arc) => { ctx.fillStyle = `rgba(255,${d.k === 'dragon' ? 120 : 60},40,${al})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -arc / 2, arc / 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = `rgba(255,150,100,${al + .25})`; ctx.lineWidth = 2; ctx.stroke(); };
    if (d.s === 'cwind') lineT(d.k === 'dragon' ? 360 : 340, (defs.monsters[d.k].r) * 2);
    else if (d.s === 'shoot') lineT(540, 6);
    else if (d.s === 'throw') lineT(640, 8);
    else if (d.s === 'volley') for (const o of [-0.28, 0, 0.28]) { ctx.save(); ctx.rotate(o); lineT(560, 5); ctx.restore(); }
    else if (d.s === 'breath') cone(430, Math.PI * 0.42);
    else if (d.s === 'swing' && d.k === 'brute') cone(107, Math.PI * 0.7);
    ctx.restore();
  }

  let last = performance.now(), frame = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; frame++;
    if (!me || !bg) return;
    const rt = now - 115, tt = now / 1000;
    // aim
    const wm = toWorld(mouse.x, mouse.y);
    aim = Math.atan2(wm.y + 24 - pred.y, wm.x - pred.x); aimDist = Math.hypot(wm.x - pred.x, wm.y + 24 - pred.y);
    // prédiction
    const [mx, my] = UI.isOpen() ? [0, 0] : moveVec(), f = me.f;
    if (!me.dead) {
      if (!(f & 80) && (mx || my)) { const sp = me.sp * (f & 8 ? 0.6 : 1); const r = col.resolve(pred.x + mx * sp * dt, pred.y + my * sp * dt, 16); pred.x = r.x; pred.y = r.y; }
    }
    const ex = me.x - pred.x, ey = me.y - pred.y, err = Math.hypot(ex, ey), dz = 14 + me.sp * (rtt / 2 + 70) / 1000;
    if (err > 300 || me.dead) { pred.x = me.x; pred.y = me.y; }
    else if (!(mx || my)) { pred.x += ex * Math.min(1, dt * 14); pred.y += ey * Math.min(1, dt * 14); }
    else if (err > dz) { const k = err > 80 ? 0.25 : 0.08; pred.x += ex * k; pred.y += ey * k; }
    // animations du héros
    const mvd = Math.hypot(pred.x - meE.lx, pred.y - meE.ly); meE.walk += mvd * 0.1; meE.mv = mvd > 0.25 ? 1 : 0; meE.lx = pred.x; meE.ly = pred.y;
    meE.sw = Math.max(0, meE.sw - dt); meE.flash = Math.max(0, meE.flash - dt);
    // caméra
    const k = Math.min(1, dt * 9); cam.x += (pred.x - cam.x) * k; cam.y += (pred.y - 20 - cam.y) * k;
    if (Math.abs(cam.x - pred.x) > 700) { cam.x = pred.x; cam.y = pred.y; }
    shake = Math.max(0, shake - dt * 30); hitFlash = Math.max(0, hitFlash - dt * 1.5);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    const Sc = cam.z * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(Sc, 0, 0, Sc, (W / 2 - cam.x * cam.z + sx) * dpr, (H / 2 - cam.y * cam.z + sy) * dpr);
    const vx0 = cam.x - W / 2 / cam.z - 80, vy0 = cam.y - H / 2 / cam.z - 80, vw = W / cam.z + 160, vh = H / cam.z + 160;
    const cx0 = Math.max(0, vx0), cy0 = Math.max(0, vy0), cx1 = Math.min(S.W, vx0 + vw), cy1 = Math.min(S.H, vy0 + vh);
    if (cx1 > cx0 && cy1 > cy0) ctx.drawImage(bg, cx0, cy0, cx1 - cx0, cy1 - cy0, cx0, cy0, cx1 - cx0, cy1 - cy0);
    // sanctuaire animé
    ctx.save(); ctx.translate(S.CX, S.CY); ctx.strokeStyle = `rgba(170,215,255,${0.45 + 0.25 * Math.sin(tt * 2)})`; ctx.lineWidth = 3; ctx.setLineDash([18, 14]); ctx.lineDashOffset = -tt * 20; ctx.beginPath(); ctx.arc(0, 0, S.SANCT_R - 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = Art.rad(ctx, 0, 0, 0, S.SANCT_R, [[0, `rgba(140,200,255,${0.1 + 0.07 * Math.sin(tt * 2)})`], [1, 'rgba(140,200,255,0)']]); ctx.beginPath(); ctx.arc(0, 0, S.SANCT_R, 0, TAU); ctx.fill(); ctx.restore();
    // zones de danger au sol
    for (const h of hazards) { h.t = Math.max(0, h.t - (now - h.t0) / 1000); h.t0 = now; Art.hazard(ctx, h, tt); }
    // télégraphes
    for (const e of monsters.values()) { if (e.d.s && ['cwind', 'shoot', 'throw', 'volley', 'breath', 'swing'].includes(e.d.s)) telegraph(e, sample(e, rt), tt); }
    // butins
    for (const d of drops) if (d.x > vx0 && d.x < vx0 + vw && d.y > vy0 && d.y < vy0 + vh) Art.drop(ctx, d, tt);
    // entités triées
    const list = [];
    for (const o of obstacles) if (o.x > vx0 - 100 && o.x < vx0 + vw + 100 && o.y > vy0 - 40 && o.y < vy0 + vh + 260) list.push({ y: o.y, o });
    for (const e of monsters.values()) { const s = sample(e, rt); const dd = Math.hypot(s.x - e.lx, s.y - e.ly); e.walk += dd * .1; e.lx = s.x; e.ly = s.y; e.flash = Math.max(0, e.flash - dt); list.push({ y: s.y, m: e, s }); }
    for (const e of players.values()) { const s = sample(e, rt); const dd = Math.hypot(s.x - e.lx, s.y - e.ly); e.walk += dd * .1; e.mv = dd > 0.25 ? 1 : 0; e.lx = s.x; e.ly = s.y; e.sw = Math.max(0, e.sw - dt); e.flash = Math.max(0, e.flash - dt); list.push({ y: s.y, p: e, s }); }
    if (!me.dead && prof) list.push({ y: pred.y, me: true });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.o) { const sp = Art.obstacleSprite(it.o); ctx.drawImage(sp.c, it.o.x - sp.ox, it.o.y - sp.oy); }
      else if (it.m) {
        const e = it.m, d = e.d, o = e.obj; o.x = it.s.x; o.y = it.s.y; o.a = it.s.a; o.k = d.k; o.id = e.id; o.s = d.s; o.p = d.p; o.st = d.st; o.bn = d.bn;
        if (e.flash > 0) ctx.filter = 'brightness(2.4) saturate(.5)'; Art.monster(ctx, o, tt); ctx.filter = 'none';
      } else if (it.p) {
        const e = it.p, d = e.d, o = e.obj; o.x = it.s.x; o.y = it.s.y; o.a = it.s.a; o.w = d.w; o.c = d.c; o.u = d.u; o.e = d.e; o.f = d.f; o.mv = e.mv; o.walk = e.walk; o.sw = e.sw; o.id = e.id;
        ctx.filter = (e.flash > 0 ? 'brightness(2.2) ' : '') + OUT; Art.hero(ctx, o, tt); ctx.filter = 'none';
      } else if (it.me) {
        const o = meE.obj || (meE.obj = {}); o.x = pred.x; o.y = pred.y; o.a = aim; o.w = me.w; o.c = prof.cls; o.u = prof.hue; o.e = me.eq; o.f = me.f; o.mv = meE.mv; o.walk = meE.walk; o.sw = meE.sw; o.id = myId;
        ctx.filter = (meE.flash > 0 ? 'brightness(2.2) ' : '') + OUT; Art.hero(ctx, o, tt); ctx.filter = 'none';
      }
    }
    // projectiles
    for (const e of projs.values()) { const s = sample(e, rt); Art.proj(ctx, { x: s.x, y: s.y, a: e.d.a, k: e.d.k, r: e.d.r }, tt); if (frame % 2 === 0 && (e.d.k === 'fire' || e.d.k === 'shadow' || e.d.k === 'bolt')) P({ k: 'dot', x: s.x + rand(-3, 3), y: s.y - 22 + rand(-3, 3), vx: 0, vy: -20, g: 0, life: .3, max: .3, sz: rand(3, 7), c: e.d.k === 'fire' ? 'rgba(255,140,40,.8)' : e.d.k === 'shadow' ? 'rgba(170,100,255,.7)' : 'rgba(130,200,255,.7)' }); }
    // particules
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      const k = p.life / p.max;
      if (p.k === 'dot') { p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
      else if (p.k === 'ring') { const r = p.r0 + (p.r1 - p.r0) * (1 - k); ctx.globalAlpha = k; ctx.strokeStyle = p.c; ctx.lineWidth = p.lw * k + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, TAU); ctx.stroke(); }
      else if (p.k === 'text') { p.y += p.vy * dt; p.vy *= 0.95; ctx.globalAlpha = Math.min(1, k * 2); ctx.font = `${p.crit ? 'italic 900' : '800'} ${p.sz}px Segoe UI, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillStyle = p.c; ctx.fillText(p.txt, p.x, p.y); }
      else if (p.k === 'arc') { const pr = 1 - k; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = k * .9; const r0 = p.rg * 0.45, r1 = p.rg; ctx.fillStyle = Art.lin(ctx, r0, 0, r1, 0, [[0, 'rgba(255,255,255,0)'], [1, p.c === '#b8c0cc' ? 'rgba(255,255,255,.85)' : p.c]]); const a0 = -p.arc / 2 + p.arc * pr * 0.2, a1 = p.arc / 2 * (0.4 + pr * 0.6) + p.arc * 0.1; ctx.beginPath(); ctx.arc(0, 0, r1, -p.arc / 2, a1); ctx.arc(0, 0, r1 * (0.7 + 0.1 * pr), a1, -p.arc / 2, true); ctx.fill(); ctx.restore(); }
      else if (p.k === 'pillar') { ctx.globalAlpha = k * .8; ctx.fillStyle = Art.lin(ctx, 0, p.y - 360, 0, p.y, [[0, 'rgba(255,220,120,0)'], [1, p.c]]); ctx.fillRect(p.x - 26 * k, p.y - 360, 52 * k, 360); }
      else if (p.k === 'cone') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = k; ctx.fillStyle = Art.rad(ctx, 0, 0, 20, p.r, [[0, 'rgba(255,240,160,.95)'], [0.5, 'rgba(255,130,30,.75)'], [1, 'rgba(255,60,10,0)']]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, p.r * (1.05 - k * .1), -p.arc / 2, p.arc / 2); ctx.fill(); ctx.restore(); if (Math.random() < .8) P({ k: 'dot', x: p.x + Math.cos(p.a) * rand(40, p.r), y: p.y + Math.sin(p.a) * rand(40, p.r) + rand(-20, 20), vx: 0, vy: -40, g: -60, life: .5, max: .5, sz: rand(5, 10), c: 'rgba(255,170,50,.8)' }); }
    }
    ctx.globalAlpha = 1;
    // étiquettes
    for (const it of list) {
      if (it.m) {
        const e = it.m, d = e.d, df = defs.monsters[d.k], y = it.s.y - ((e.obj.hh || 50) + 12);
        const big = df.cat === 'elite' || df.cat === 'boss';
        if (d.h < d.H || big) { const w = df.cat === 'boss' ? 110 : df.cat === 'elite' ? 64 : 38; hpBar(it.s.x, y, w, d.h / d.H, big ? '#ff9a5a' : '#ff6b70', big ? '#c4501c' : '#c4262c'); }
        if (big) nameTag(it.s.x, y - 6, df.name, df.cat === 'boss' ? '#ffd24a' : '#d6a2ff', 'Niv ' + d.l);
      } else if (it.p) { const d = it.p.d; hpBar(it.s.x, it.s.y - 82, 44, d.h / d.H, '#6dff9a', '#2aa05a'); nameTag(it.s.x, it.s.y - 88, d.n, '#cfe6ff', 'Niv ' + d.l); }
      else if (it.me) nameTag(pred.x, pred.y - 78, prof.name, '#ffe08a');
    }
    // réticule
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!UI.isOpen()) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9, 0, TAU); ctx.moveTo(mouse.x - 14, mouse.y); ctx.lineTo(mouse.x - 5, mouse.y); ctx.moveTo(mouse.x + 5, mouse.y); ctx.lineTo(mouse.x + 14, mouse.y); ctx.moveTo(mouse.x, mouse.y - 14); ctx.lineTo(mouse.x, mouse.y - 5); ctx.moveTo(mouse.x, mouse.y + 5); ctx.lineTo(mouse.x, mouse.y + 14); ctx.stroke(); }
    // vignette
    const hr = me.hp / me.H, low = hr < 0.3 && !me.dead ? (0.3 - hr) / 0.3 * (0.6 + 0.4 * Math.sin(tt * 6)) : 0, vi = Math.max(low * 0.6, hitFlash * 0.7);
    if (vi > 0.01) { ctx.fillStyle = Art.rad(ctx, W / 2, H / 2, Math.min(W, H) * 0.35, Math.max(W, H) * 0.75, [[0, 'rgba(180,0,0,0)'], [1, `rgba(200,0,0,${vi})`]]); ctx.fillRect(0, 0, W, H); }
    if (me.dead) { ctx.fillStyle = 'rgba(40,0,0,.35)'; ctx.fillRect(0, 0, W, H); }
    updateHud(); updateTarget(rt);
    if (frame % 3 === 0) drawMini(tt);
  }

  const mc = $('mini'), mg = mc.getContext('2d');
  function drawMini(tt) {
    mg.drawImage(miniBg, 0, 0);
    const X = x => x / 16, Y = y => y / 16;
    for (const e of monsters.values()) { const c = { weak: '#9be08a', mid: '#ffae4a', elite: '#c58aff', boss: '#ff4a4a' }[defs.monsters[e.d.k].cat]; mg.fillStyle = c; const big = e.d.k === 'golem' || e.d.k === 'dragon'; mg.beginPath(); mg.arc(X(e.lx), Y(e.ly), big ? 5 + Math.sin(tt * 6) : 2.2, 0, TAU); mg.fill(); }
    for (const r of board) { if (r.i === myId || r.dead) continue; mg.fillStyle = '#6ab8ff'; mg.beginPath(); mg.arc(X(r.x), Y(r.y), 3, 0, TAU); mg.fill(); mg.strokeStyle = '#fff'; mg.lineWidth = 1; mg.stroke(); }
    mg.strokeStyle = 'rgba(255,255,255,.35)'; mg.lineWidth = 1; mg.strokeRect(X(cam.x - W / 2 / cam.z), Y(cam.y - H / 2 / cam.z), W / cam.z / 16, H / cam.z / 16);
    mg.save(); mg.translate(X(pred.x), Y(pred.y)); mg.rotate(aim); mg.fillStyle = '#ffd24a'; mg.beginPath(); mg.moveTo(6, 0); mg.lineTo(-4, -4); mg.lineTo(-2, 0); mg.lineTo(-4, 4); mg.fill(); mg.restore();
  }

  buildLogin(); requestAnimationFrame(previewLoop); requestAnimationFrame(loop);
})();
