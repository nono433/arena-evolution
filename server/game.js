// Boucle de jeu autoritative : joueurs, monstres, projectiles, combat, progression.
const S = require('../shared/world');
const C = require('./config');
const Items = require('./items');
const Acc = require('./accounts');
const { genWorld } = require('./world');
const AI = require('./monsters');

const DT = 1 / 30;
const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };
const R1 = n => Math.round(n * 10) / 10;

const POOL = {
  weak: { foret: ['slime', 'slime', 'slime', 'bat'], lave: ['bat', 'bat', 'slime'], glace: ['bat', 'slime'], marais: ['slime', 'slime', 'bat'] },
  mid: { foret: ['skeleton', 'brute'], lave: ['brute', 'brute', 'skeleton'], glace: ['skeleton', 'skeleton', 'brute'], marais: ['brute', 'skeleton'] },
  elite: { foret: ['ogre', 'wraith'], lave: ['ogre', 'ogre', 'wraith'], glace: ['wraith', 'wraith', 'ogre'], marais: ['wraith', 'ogre'] }
};
const ZONE_BONUS = { foret: 0, marais: 1, glace: 2, lave: 3 };
const DROP_CHANCE = { weak: 0.02, mid: 0.06, elite: 0.35, boss: 1 };

class Game {
  constructor() {
    this.world = genWorld();
    this.col = S.makeCollider(this.world.obstacles);
    this.players = new Map(); this.monsters = new Map();
    this.projs = []; this.hazards = []; this.drops = []; this.events = [];
    this.nid = 1; this.tick = 0; this.time = 0;
    this.spawnT = 1; this.bossT = 75; this.bossIdx = 0;
    this.defs = C.clientDefs();
    this.timer = setInterval(() => this.update(DT), DT * 1000);
  }

  event(e) { this.events.push(e); }
  feed(m, c) { this.events.push({ e: 'feed', g: 1, m, c }); }
  send(p, o) { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(o)); }
  inSanct(e) { return Math.hypot(e.x - S.CX, e.y - S.CY) < S.SANCT_R; }

  // ───────── Joueurs ─────────
  addPlayer(ws, acc) {
    for (const o of this.players.values()) if (o.acc === acc) { this.removePlayer(o, true); }
    acc.last = Date.now();
    const p = {
      isP: true, id: this.nid++, ws, acc, name: acc.name, r: 16, vx: 0, vy: 0, kx: 0, ky: 0,
      in: { mx: 0, my: 0, a: 0, ad: 0, atk: false }, atkCd: 0, dodgeCd: 0, cds: {}, cdTot: {},
      fx: { invuln: 3, shield: 0, shT: 0, hot: 0, hotT: 0, burn: 0, burnT: 0, slow: 1, slowT: 0, stun: 0 },
      dash: null, dead: false, combatT: 99, streak: 0, moving: false, burnAcc: 0, st: null, hp: 1, x: S.CX, y: S.CY, a: 0, deathT: 0, killer: ''
    };
    this.players.set(p.id, p);
    if (!acc.shop) acc.shop = Items.genShop(acc.level);
    p.st = Items.derive(acc); p.hp = p.st.maxHp;
    this.placeSpawn(p);
    this.send(p, { t: 'welcome', id: p.id, world: { w: S.W, h: S.H, obstacles: this.world.obstacles, lairs: this.world.lairs }, defs: this.defs });
    this.sendProfile(p);
    this.feed(`${p.name} a rejoint l'arène`, '#9ad');
    if (process.env.AE_TEST) { // mode test : un monstre de chaque type autour du sanctuaire
      Object.keys(C.MONSTERS).forEach((k, i) => { const a = i / 8 * Math.PI * 2; this.spawnMonster(k, S.CX + Math.cos(a) * 520, S.CY + Math.sin(a) * 520, 3); });
    }
    return p;
  }
  removePlayer(p, silent) {
    this.players.delete(p.id);
    Acc.touch(); Acc.save();
    if (!silent) this.feed(`${p.name} a quitté l'arène`, '#789');
    if (silent && p.ws) { try { p.ws.close(); } catch (e) { } }
  }
  placeSpawn(p) {
    const sp = this.world.playerSpawns[Math.floor(Math.random() * this.world.playerSpawns.length)];
    p.x = sp.x; p.y = sp.y;
  }
  recalc(p) {
    const old = p.st.maxHp;
    p.st = Items.derive(p.acc);
    p.hp = Math.min(p.st.maxHp, p.hp + Math.max(0, p.st.maxHp - old));
  }
  profile(p) {
    const a = p.acc, stats = {};
    for (const k in C.STATS) stats[k] = { lv: a.stats[k], cost: a.stats[k] >= C.STATS[k].max ? null : C.statCost(k, a.stats[k]) };
    const skills = {};
    for (const id in C.SKILLS) {
      const lv = a.skills[id] || 0;
      skills[id] = { lv, cost: lv === 0 ? C.SKILLS[id].unlock : lv >= C.SKILLS[id].maxLv ? null : C.skillUpgradeCost(lv) };
    }
    const fmt = it => it && { ...it, stats: Items.itemStats(it), up: it.lvl >= Items.MAX_ITEM_LVL ? null : Items.upgradeCost(it), sell: Items.sellPrice(it), buy: Items.buyPrice(it) };
    const equip = {}; for (const s of C.SLOTS) equip[s] = fmt(a.equip[s]);
    return {
      name: a.name, cls: a.cls, hue: a.hue, level: a.level, gold: Math.floor(a.gold), ess: a.ess, stats, skills, bar: a.bar, equip,
      inv: a.inv.map(fmt), shop: a.shop.map(fmt), rerollCost: 40 + 25 * a.rerolls, invMax: 40,
      st: p.st, pk: a.pk, mk: a.mk, deaths: a.deaths, best: a.best, xpNext: C.xpNext(a.level)
    };
  }
  sendProfile(p) { this.send(p, { t: 'prof', p: this.profile(p) }); }
  err(p, m) { this.send(p, { t: 'err', m }); }
  ok(p, k, id) { this.send(p, { t: 'ok', k, id }); this.sendProfile(p); Acc.touch(); }
  canShop(p) { return p.dead || this.inSanct(p); }

  heal(p, v) { if (!p.dead) p.hp = Math.min(p.st.maxHp, p.hp + v); }

  giveXp(p, xp) {
    const a = p.acc;
    a.xp += xp * (1 + p.st.xpfind / 100);
    let up = false;
    while (a.level < 99 && a.xp >= C.xpNext(a.level)) {
      a.xp -= C.xpNext(a.level); a.level++; up = true;
    }
    if (up) {
      this.recalc(p); p.hp = p.st.maxHp;
      this.event({ e: 'levelup', x: p.x, y: p.y, i: p.id, l: a.level });
      this.send(p, { t: 'toast', m: `Niveau ${a.level} atteint !`, k: 'level' });
      this.sendProfile(p);
    }
    Acc.touch();
  }
  giveGold(p, g) { p.acc.gold += g * (1 + p.st.goldfind / 100); }

  // ───────── Déplacement ─────────
  move(e, dx, dy) {
    const p = this.col.resolve(e.x + dx, e.y + dy, e.r);
    e.x = p.x; e.y = p.y;
    if (!e.isP) {
      const ddx = e.x - S.CX, ddy = e.y - S.CY, d = Math.hypot(ddx, ddy), lim = S.SANCT_R + e.r;
      if (d < lim) { e.x = S.CX + ddx / (d || 1) * lim; e.y = S.CY + ddy / (d || 1) * lim; }
    }
  }

  // ───────── Dégâts ─────────
  damage(src, tgt, raw, o = {}) {
    if (tgt.dead || tgt.hp <= 0) return 0;
    if (src && src.isP && (src.dead || this.inSanct(src))) return 0;
    if (tgt.isP && (tgt.fx.invuln > 0 || this.inSanct(tgt))) return 0;
    if (tgt.isP && src && src.isP && src === tgt) return 0;
    let dmg = raw, crit = false;
    if (src && src.isP && !o.nocrit && Math.random() * 100 < src.st.crit) { crit = true; dmg *= src.st.critDmg; }
    dmg *= 0.92 + Math.random() * 0.16;
    const def = tgt.isP ? tgt.st.def : tgt.def;
    dmg = Math.max(1, dmg * 50 / (50 + def));
    let absorbed = 0;
    if (tgt.isP && tgt.fx.shield > 0) {
      absorbed = Math.min(tgt.fx.shield, dmg); tgt.fx.shield -= absorbed; dmg -= absorbed;
      if (tgt.fx.shield <= 0) tgt.fx.shT = 0;
    }
    dmg = Math.round(dmg);
    tgt.hp -= dmg;
    tgt.flash = 0.15;
    this.event({ e: 'hit', x: tgt.x, y: tgt.y, v: dmg, c: crit ? 1 : 0, m: tgt.isP ? 1 : 0, a: absorbed > 0 && dmg === 0 ? 1 : 0, i: tgt.id });
    if (src && src.isP) {
      src.combatT = 0;
      if (src.st.lifesteal > 0 && dmg > 0) this.heal(src, dmg * src.st.lifesteal / 100);
      if (!tgt.isP) { tgt.dmgBy[src.id] = (tgt.dmgBy[src.id] || 0) + dmg; tgt.lastHit = src.id; tgt.tgt = src.id; }
    }
    if (tgt.isP) { tgt.combatT = 0; tgt.lastSrc = src; }
    if (o.kb && !(tgt.cat === 'boss')) {
      tgt.kx += Math.cos(o.kb.a) * o.kb.f; tgt.ky += Math.sin(o.kb.a) * o.kb.f;
    }
    if (o.burn) { tgt.fx.burn = o.burn.dps; tgt.fx.burnT = o.burn.t; tgt.fx.burnSrc = src; }
    if (o.stun && tgt.cat !== 'boss') tgt.fx.stun = Math.max(tgt.fx.stun, o.stun);
    if (o.slow) { tgt.fx.slow = o.slow.f; tgt.fx.slowT = o.slow.t; }
    if (tgt.hp <= 0) this.onDeath(tgt, src);
    return dmg;
  }
  // dégâts sur la durée (brûlure)
  dot(tgt, dps, dt, src) {
    if (tgt.dead || tgt.hp <= 0) return;
    if (tgt.isP && (this.inSanct(tgt) || tgt.fx.invuln > 0)) { tgt.fx.burnT = 0; return; }
    tgt.hp -= dps * dt; tgt.burnAcc = (tgt.burnAcc || 0) + dps * dt;
    if (tgt.burnAcc >= Math.max(2, dps * 0.5)) {
      this.event({ e: 'hit', x: tgt.x, y: tgt.y, v: Math.round(tgt.burnAcc), c: 0, m: tgt.isP ? 1 : 0, f: 1, i: tgt.id });
      tgt.burnAcc = 0;
    }
    if (tgt.hp <= 0) this.onDeath(tgt, src);
  }
  coneHit(src, a, range, arc, dmg, o) {
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - src.x, p.y - src.y);
      if (d > range + p.r) continue;
      if (angDiff(Math.atan2(p.y - src.y, p.x - src.x), a) <= arc / 2 + Math.atan2(p.r, Math.max(d, 1))) this.damage(src, p, dmg, o);
    }
  }

  onDeath(t, src) {
    if (t.isP) return this.playerDied(t, src);
    if (!this.monsters.has(t.id)) return;
    this.monsters.delete(t.id);
    const T = C.MONSTERS[t.type];
    this.event({ e: 'mdie', x: t.x, y: t.y, k: t.type, r: t.r });
    let total = 0; for (const k in t.dmgBy) total += t.dmgBy[k];
    const scale = 1 + 0.25 * (t.level - 1);
    const killer = t.lastHit ? this.players.get(t.lastHit) : null;
    for (const k in t.dmgBy) {
      const p = this.players.get(+k); if (!p) continue;
      const share = total > 0 ? t.dmgBy[k] / total : 0;
      const xp = T.xp * scale * share, gold = rnd(T.gold[0], T.gold[1]) * (1 + 0.15 * (t.level - 1)) * share;
      this.giveXp(p, xp); this.giveGold(p, gold);
      p.acc.mk++;
      let ess = 0;
      if (T.essN) { if (share >= 0.2) ess = Math.round(rnd(T.essN[0], T.essN[1])); }
      else if (p === killer && Math.random() < T.ess) ess = 1;
      if (ess) p.acc.ess += ess;
      this.send(p, { t: 'loot', xp: Math.round(xp), gold: Math.round(gold), ess });
    }
    if (killer && Math.random() < 0.14) this.drops.push({ id: this.nid++, type: 'hp', x: t.x, y: t.y, life: 20 });
    if (Math.random() < DROP_CHANCE[t.cat]) {
      const slots = C.SLOTS, slot = slots[Math.floor(Math.random() * 5)];
      const min = t.cat === 'boss' ? 2 : t.cat === 'elite' ? 1 : 0;
      const w = t.cat === 'boss' ? [0, 0, 45, 40, 15] : t.cat === 'elite' ? [0, 55, 32, 11, 2] : [60, 28, 9, 2.5, 0.5];
      const it = Items.genItem(slot, Items.rollRarity(w, min), Math.max(1, Math.floor(t.level / 3) + 1));
      this.drops.push({ id: this.nid++, type: 'item', x: t.x, y: t.y, life: 60, item: it, owner: killer ? killer.id : 0, ownerT: 8 });
    }
    if (t.cat === 'boss') this.feed(`${T.name} a été terrassé${killer ? ' par ' + killer.name : ''} !`, '#ffd24a');
    if (t.cat === 'boss') this.bossT = this.players.size === 1 ? 100 : 180;
  }

  playerDied(p, src) {
    p.dead = true; p.hp = 0; p.deathT = this.time; p.dash = null; p.fx.burnT = 0; p.fx.shield = 0; p.fx.hotT = 0;
    p.acc.deaths++; p.acc.best = Math.max(p.acc.best, p.streak); p.streak = 0;
    this.event({ e: 'die', x: p.x, y: p.y, i: p.id });
    let kname = 'les ténèbres';
    if (src && src.isP) {
      kname = src.name; const a = src.acc, v = p.acc;
      const gold = 30 + v.level * 10 + Math.floor(v.gold * 0.05);
      v.gold = Math.max(0, v.gold - Math.floor(v.gold * 0.05));
      this.giveXp(src, 40 + v.level * 14); this.giveGold(src, gold); a.ess += 2 + Math.floor(v.level / 6);
      a.pk++; src.streak++; a.best = Math.max(a.best, src.streak);
      this.heal(src, src.st.maxHp * 0.15); this.sendProfile(src);
      if (Math.random() < 0.3) this.drops.push({ id: this.nid++, type: 'item', x: p.x, y: p.y, life: 60, item: Items.genItem(C.SLOTS[Math.floor(Math.random() * 5)], Items.rollRarity([50, 30, 14, 5, 1]), Math.max(1, Math.floor(v.level / 3) + 1)), owner: src.id, ownerT: 6 });
      this.send(src, { t: 'loot', xp: 40 + v.level * 14, gold, ess: 2 + Math.floor(v.level / 6) });
      this.feed(`${src.name} a vaincu ${p.name}${src.streak >= 3 ? ` (série de ${src.streak} !)` : ''}`, '#ff8a6a');
    } else if (src && src.type) {
      kname = C.MONSTERS[src.type].name;
      this.feed(`${p.name} a été vaincu par ${kname}`, '#ff8a6a');
    } else this.feed(`${p.name} a succombé à ses blessures`, '#ff8a6a');
    p.killer = kname;
    p.acc.shop = Items.genShop(p.acc.level); p.acc.rerolls = 0;
    this.send(p, { t: 'died', by: kname });
    this.sendProfile(p);
    Acc.touch(); Acc.save();
  }

  respawn(p) {
    if (!p.dead || this.time - p.deathT < 1.2) return;
    p.dead = false; this.recalc(p); p.hp = p.st.maxHp; this.placeSpawn(p);
    p.fx.invuln = 3; p.kx = p.ky = 0; p.atkCd = 0.3;
    this.event({ e: 'spawn', x: p.x, y: p.y, i: p.id });
  }

  // ───────── Attaques & compétences ─────────
  attack(p) {
    const W = C.WEAPONS[p.st.kind] || C.WEAPONS.sword, a = p.in.a;
    p.atkCd = W.cd / p.st.as; p.combatT = 0;
    const dmg = p.st.dmg * W.mult, cs = Math.cos(a), sn = Math.sin(a);
    if (W.proj) {
      this.addProj({ team: 'p', owner: p, x: p.x + cs * 18, y: p.y + sn * 18, a, speed: W.speed, r: W.pr, dmg, life: W.range / W.speed, kind: W.proj });
      this.event({ e: 'swing', i: p.id, a, k: p.st.kind, x: p.x, y: p.y });
      return;
    }
    this.event({ e: 'swing', i: p.id, a, k: p.st.kind, x: p.x, y: p.y, rg: W.range, arc: W.arc });
    p.kx += cs * 110; p.ky += sn * 110;
    const half = W.arc * Math.PI / 360;
    const test = t => {
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      if (d > W.range + t.r) return false;
      return angDiff(Math.atan2(dy, dx), a) <= half + Math.atan2(t.r, Math.max(d, 1));
    };
    for (const m of [...this.monsters.values()]) if (test(m)) this.damage(p, m, dmg, { kb: { a, f: 160 } });
    for (const q of [...this.players.values()]) if (q !== p && !q.dead && test(q)) this.damage(p, q, dmg, { kb: { a, f: 160 } });
  }

  dodge(p) {
    if (p.dead || p.dodgeCd > 0 || p.fx.stun > 0 || p.dash) return;
    let mx = p.in.mx, my = p.in.my; const l = Math.hypot(mx, my);
    let a = l > 0.1 ? Math.atan2(my, mx) : p.in.a;
    p.dash = { t: 0.2, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, mult: 0 };
    p.fx.invuln = Math.max(p.fx.invuln, 0.26);
    p.dodgeCd = 1.1 * (1 - p.st.cdr / 100);
    this.event({ e: 'dash', x: p.x, y: p.y, a, i: p.id });
  }

  cast(p, slot) {
    if (p.dead || p.fx.stun > 0) return;
    const id = p.acc.bar[slot]; if (!id) return;
    const lv = p.acc.skills[id]; if (!lv || (p.cds[id] || 0) > 0) return;
    const P = C.SKILLS[id].lv(lv), a = p.in.a, st = p.st;
    const cd = P.cd * (1 - st.cdr / 100);
    p.cds[id] = cd; p.cdTot[id] = cd; p.combatT = 0;
    if (id === 'dash') {
      p.dash = { t: 0.2, vx: Math.cos(a) * P.dist / 0.2, vy: Math.sin(a) * P.dist / 0.2, mult: P.mult, hit: new Set() };
      p.fx.invuln = Math.max(p.fx.invuln, 0.3);
      this.event({ e: 'dash', x: p.x, y: p.y, a, i: p.id, s: 1 });
    } else if (id === 'fireball') {
      this.addProj({ team: 'p', owner: p, x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, a, speed: 560, r: 14, dmg: st.dmg * P.mult, life: 1.0, kind: 'fire', exp: P.rad, burn: P.burn ? { dps: st.dmg * 0.35, t: 3 } : null });
      this.event({ e: 'cast', x: p.x, y: p.y, i: p.id, s: 'fireball', a });
    } else if (id === 'shockwave') {
      this.nova(p, p.x, p.y, P.rad, st.dmg * P.mult, { kb: true, stun: P.stun ? 0.9 : 0 });
    } else if (id === 'heal') {
      p.fx.hot = st.maxHp * P.pct / 3; p.fx.hotT = 3;
      this.event({ e: 'heal', x: p.x, y: p.y, i: p.id });
    } else if (id === 'teleport') {
      const d = Math.min(P.range, Math.max(60, p.in.ad));
      this.event({ e: 'tele', x: p.x, y: p.y, k: 'player' });
      const r = this.col.resolve(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, p.r);
      p.x = r.x; p.y = r.y; p.fx.invuln = Math.max(p.fx.invuln, 0.2);
      this.event({ e: 'tele', x: p.x, y: p.y, k: 'player' });
      if (P.mult) this.nova(p, p.x, p.y, 110, st.dmg * P.mult, { kb: true, quiet: true });
    } else if (id === 'shield') {
      p.fx.shield = st.maxHp * P.pct; p.fx.shT = P.dur;
      this.event({ e: 'shield', x: p.x, y: p.y, i: p.id });
    }
  }

  nova(p, x, y, r, dmg, o) {
    this.event({ e: 'nova', x, y, r, i: p.id, q: o.quiet ? 1 : 0 });
    const hitT = t => {
      const dx = t.x - x, dy = t.y - y, d = Math.hypot(dx, dy);
      if (d > r + t.r) return;
      this.damage(p, t, dmg, { kb: o.kb ? { a: Math.atan2(dy, dx), f: 420 } : null, stun: o.stun });
    };
    for (const m of [...this.monsters.values()]) hitT(m);
    for (const q of [...this.players.values()]) if (q !== p && !q.dead) hitT(q);
  }

  // ───────── Projectiles & zones de danger ─────────
  addProj(o) {
    this.projs.push({ id: this.nid++, vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed, hit: new Set(), ...o });
  }
  addHazard(h) { this.hazards.push({ id: this.nid++, tot: h.t, ...h }); }

  explode(pr) {
    this.event({ e: 'boom', x: pr.x, y: pr.y, r: pr.exp, k: pr.kind });
    const o = { burn: pr.burn, kb: null };
    const each = t => {
      const dx = t.x - pr.x, dy = t.y - pr.y;
      if (Math.hypot(dx, dy) < pr.exp + t.r) this.damage(pr.owner, t, pr.dmg, { burn: pr.burn, kb: { a: Math.atan2(dy, dx), f: 220 } });
    };
    if (pr.team === 'p') { for (const m of [...this.monsters.values()]) each(m); for (const q of [...this.players.values()]) if (q !== pr.owner && !q.dead) each(q); }
    else for (const q of [...this.players.values()]) if (!q.dead) each(q);
  }

  updateProjs(dt) {
    const keep = [];
    for (const pr of this.projs) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      let dead = pr.life <= 0;
      if (!dead && this.col.hit(pr.x, pr.y, Math.min(pr.r, 6))) dead = true;
      if (!dead) {
        const targets = pr.team === 'p' ? [...this.monsters.values(), ...[...this.players.values()].filter(q => q !== pr.owner)] : [...this.players.values()];
        for (const t of targets) {
          if (t.dead || pr.hit.has(t.id + (t.isP ? 'p' : 'm'))) continue;
          if (Math.hypot(t.x - pr.x, t.y - pr.y) < pr.r + t.r) {
            if (t.isP && (this.inSanct(t) || t.fx.invuln > 0)) continue;
            if (pr.exp) { dead = true; break; }
            this.damage(pr.owner, t, pr.dmg, { burn: pr.burn, kb: { a: Math.atan2(pr.vy, pr.vx), f: 130 } });
            pr.hit.add(t.id + (t.isP ? 'p' : 'm'));
            dead = true; break;
          }
        }
      }
      if (dead) { if (pr.exp) this.explode(pr); else this.event({ e: 'pop', x: pr.x, y: pr.y, k: pr.kind }); }
      else keep.push(pr);
    }
    this.projs = keep;
  }

  updateHazards(dt) {
    const keep = [];
    for (const h of this.hazards) {
      h.t -= dt;
      if (h.t > 0) { keep.push(h); continue; }
      this.event({ e: 'boom', x: h.x, y: h.y, r: h.r, k: h.kind });
      for (const p of [...this.players.values()]) {
        if (p.dead) continue;
        const dx = p.x - h.x, dy = p.y - h.y;
        if (Math.hypot(dx, dy) < h.r + p.r) this.damage(h.owner, p, h.dmg, { kb: { a: Math.atan2(dy, dx), f: 380 }, burn: h.burn ? { dps: h.dmg * 0.12, t: 2.5 } : null });
      }
    }
    this.hazards = keep;
  }

  updateDrops(dt) {
    const keep = [];
    for (const d of this.drops) {
      d.life -= dt; if (d.ownerT > 0) d.ownerT -= dt;
      let taken = false;
      if (d.life > 0) {
        for (const p of this.players.values()) {
          if (p.dead) continue;
          if (d.type === 'item' && d.owner && d.ownerT > 0 && d.owner !== p.id) continue;
          const dx = p.x - d.x, dy = p.y - d.y, dist = Math.hypot(dx, dy);
          if (dist < 120 && (d.type === 'item' || p.hp < p.st.maxHp)) { d.x += dx / (dist || 1) * 260 * dt; d.y += dy / (dist || 1) * 260 * dt; }
          if (dist < 34) {
            if (d.type === 'hp') { if (p.hp >= p.st.maxHp) continue; this.heal(p, p.st.maxHp * 0.25); this.event({ e: 'heal', x: p.x, y: p.y, i: p.id, s: 1 }); taken = true; }
            else if (p.acc.inv.length < 40) { p.acc.inv.push(d.item); this.send(p, { t: 'toast', m: `Objet obtenu : ${d.item.name}`, k: 'item', r: d.item.rar }); this.sendProfile(p); taken = true; }
            else { const g = Items.sellPrice(d.item); p.acc.gold += g; this.send(p, { t: 'toast', m: `Inventaire plein — ${d.item.name} vendu (+${g} or)`, k: 'item', r: d.item.rar }); taken = true; }
            if (taken) { Acc.touch(); break; }
          }
        }
      }
      if (!taken && d.life > 0) keep.push(d);
    }
    this.drops = keep;
  }

  // ───────── Apparition des monstres ─────────
  summon(type, near) {
    const a = Math.random() * 6.28, p = this.col.resolve(near.x + Math.cos(a) * 90, near.y + Math.sin(a) * 90, 16);
    return this.spawnMonster(type, p.x, p.y, near.level);
  }
  spawnMonster(type, x, y, ml) {
    const T = C.MONSTERS[type], n = this.players.size;
    const hpMul = (1 + 0.18 * (ml - 1)) * (T.cat === 'boss' ? 1 + 0.6 * (n - 1) : 1);
    const m = {
      isP: false, id: this.nid++, type, cat: T.cat, name: T.name, level: ml, x, y, r: T.r,
      hp: T.hp * hpMul, maxHp: T.hp * hpMul, dmg: T.dmg * (1 + 0.08 * (ml - 1)), def: T.def * (1 + 0.1 * (ml - 1)), speed: T.spd,
      home: { x, y }, tgt: null, act: null, cd: rnd(0.5, 1.5), fx: { stun: 0, slow: 1, slowT: 0, burn: 0, burnT: 0 },
      kx: 0, ky: 0, a: Math.random() * 6.28, dmgBy: {}, lastHit: null, wander: { x, y, t: 0 }, flash: 0, t: Math.random() * 10, burnAcc: 0
    };
    this.monsters.set(m.id, m);
    return m;
  }
  updateSpawner(dt) {
    const alive = [...this.players.values()];
    const n = alive.length;
    if (!n) { if (this.monsters.size) { this.monsters.clear(); this.projs = []; this.hazards = []; } return; }
    this.spawnT -= dt; if (this.spawnT > 0) return;
    this.spawnT = 0.6;
    const solo = n === 1;
    const caps = solo ? { weak: 14, mid: 8, elite: 2, boss: 1 } : { weak: 5 + 2 * n, mid: 3 + n, elite: 1 + Math.floor(n / 3) + (n >= 2 ? 1 : 0), boss: 1 };
    const counts = { weak: 0, mid: 0, elite: 0, boss: 0 };
    for (const m of this.monsters.values()) counts[m.cat]++;
    const fighters = alive.filter(p => !p.dead);
    if (!fighters.length) return;
    if (counts.boss === 0) {
      this.bossT -= 0.6;
      if (this.bossT <= 0) {
        const kind = ['golem', 'dragon'][this.bossIdx++ % 2], lair = this.world.lairs[kind];
        const lvl = Math.max(1, Math.round(Math.max(...fighters.map(p => p.acc.level)) * 0.8)) + 2;
        this.spawnMonster(kind, lair.x, lair.y, lvl);
        this.feed(`⚠ ${C.MONSTERS[kind].name} est apparu dans ${S.ZONE_NAMES[S.zoneAt(lair.x, lair.y)]} !`, '#ffd24a');
        this.event({ e: 'alert', g: 1, m: `${C.MONSTERS[kind].name} est apparu !` });
        this.bossT = solo ? 100 : 180;
      }
    }
    for (let k = 0; k < 2; k++) {
      const maxLv = Math.max(...fighters.map(p => p.acc.level));
      const need = ['weak', 'mid', 'elite'].filter(c => counts[c] < caps[c] && (c !== 'mid' || maxLv >= 2) && (c !== 'elite' || maxLv >= 4));
      if (!need.length) break;
      const w = need.map(c => (caps[c] - counts[c]) / caps[c] * { weak: 3, mid: 2, elite: 0.6 }[c]);
      let r = Math.random() * w.reduce((a, b) => a + b, 0), cat = need[0];
      for (let i = 0; i < need.length; i++) { if (r < w[i]) { cat = need[i]; break; } r -= w[i]; }
      const pts = this.world.monsterSpawns.filter(sp => {
        let mn = 1e9; for (const p of fighters) mn = Math.min(mn, Math.hypot(p.x - sp.x, p.y - sp.y));
        return mn > 600 && mn < 2000;
      });
      if (!pts.length) break;
      const sp = pts[Math.floor(Math.random() * pts.length)];
      const type = POOL[cat][sp.zone][Math.floor(Math.random() * POOL[cat][sp.zone].length)];
      let near = fighters[0], nd = 1e9;
      for (const p of fighters) { const d = Math.hypot(p.x - sp.x, p.y - sp.y); if (d < nd) { nd = d; near = p; } }
      const ml = Math.max(1, Math.round(near.acc.level * 0.7)) + ZONE_BONUS[sp.zone] + (cat === 'elite' ? 1 : 0);
      this.spawnMonster(type, sp.x, sp.y, ml);
      counts[cat]++;
    }
  }

  // ───────── Mise à jour ─────────
  updatePlayer(p, dt) {
    const fx = p.fx;
    if (p.dead) return;
    p.atkCd -= dt; p.dodgeCd -= dt; p.combatT += dt;
    for (const k in p.cds) if (p.cds[k] > 0) p.cds[k] -= dt;
    fx.invuln -= dt;
    if (fx.shT > 0) { fx.shT -= dt; if (fx.shT <= 0) fx.shield = 0; }
    if (fx.hotT > 0) { fx.hotT -= dt; this.heal(p, fx.hot * dt); }
    if (fx.burnT > 0) { fx.burnT -= dt; this.dot(p, fx.burn, dt, fx.burnSrc); if (p.dead) return; }
    if (fx.slowT > 0) fx.slowT -= dt;
    if (fx.stun > 0) fx.stun -= dt;
    let vx = 0, vy = 0;
    p.moving = false;
    if (p.dash) {
      vx = p.dash.vx; vy = p.dash.vy; p.dash.t -= dt;
      if (p.dash.mult) {
        for (const m of [...this.monsters.values()]) if (!p.dash.hit.has(m.id) && Math.hypot(m.x - p.x, m.y - p.y) < m.r + p.r + 22) { p.dash.hit.add(m.id); this.damage(p, m, p.st.dmg * p.dash.mult, { kb: { a: Math.atan2(vy, vx), f: 200 } }); }
        for (const q of [...this.players.values()]) if (q !== p && !q.dead && !p.dash.hit.has('p' + q.id) && Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + 22) { p.dash.hit.add('p' + q.id); this.damage(p, q, p.st.dmg * p.dash.mult, { kb: { a: Math.atan2(vy, vx), f: 200 } }); }
      }
      if (p.dash.t <= 0) p.dash = null;
    } else if (fx.stun <= 0) {
      let mx = p.in.mx, my = p.in.my; const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      const sp = p.st.spd * (fx.slowT > 0 ? fx.slow : 1);
      vx = mx * sp; vy = my * sp; p.moving = l > 0.1;
    }
    vx += p.kx; vy += p.ky;
    const f = Math.exp(-9 * dt); p.kx *= f; p.ky *= f;
    this.move(p, vx * dt, vy * dt);
    p.vx = vx; p.vy = vy;
    p.a = p.in.a;
    if (p.hp < p.st.maxHp) {
      let r = p.st.regen;
      if (p.combatT > 5) r += p.st.maxHp * 0.012;
      if (this.inSanct(p)) r += p.st.maxHp * 0.15;
      p.hp = Math.min(p.st.maxHp, p.hp + r * dt);
    }
    if (p.in.atk && p.atkCd <= 0 && fx.stun <= 0 && !p.dash && !this.inSanct(p)) this.attack(p);
  }

  update(dt) {
    this.tick++; this.time += dt;
    for (const p of this.players.values()) this.updatePlayer(p, dt);
    for (const m of [...this.monsters.values()]) { if (this.monsters.has(m.id)) AI.update(this, m, dt); }
    // séparation douce des monstres
    const ms = [...this.monsters.values()];
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i], b = ms[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d < min && d > 0.01) { const push = (min - d) * 0.35; this.move(a, -dx / d * push, -dy / d * push); this.move(b, dx / d * push, dy / d * push); }
    }
    this.updateProjs(dt); this.updateHazards(dt); this.updateDrops(dt);
    this.updateSpawner(dt);
    if (this.tick % 2 === 0) this.broadcast();
    if (this.tick % 30 === 0) this.sendBoard();
    this.events = [];
  }

  // ───────── Réseau ─────────
  flags(p) {
    const f = p.fx;
    return (f.shield > 0 ? 1 : 0) | (f.burnT > 0 ? 2 : 0) | (f.invuln > 0 ? 4 : 0) | (f.slowT > 0 ? 8 : 0) | (f.stun > 0 ? 16 : 0) | (f.hotT > 0 ? 32 : 0) | (p.dash ? 64 : 0);
  }
  broadcast() {
    for (const p of this.players.values()) {
      const X = p.x, Y = p.y, near = e => Math.abs(e.x - X) < 1500 && Math.abs(e.y - Y) < 1000;
      const ps = [], ms = [], pr = [], hz = [], dr = [];
      for (const q of this.players.values()) {
        if (q === p || q.dead || !near(q)) continue;
        const eq = q.acc.equip;
        ps.push({ i: q.id, n: q.name, x: R1(q.x), y: R1(q.y), a: R1(q.a), h: Math.round(q.hp), H: q.st.maxHp, l: q.acc.level, c: q.acc.cls, u: q.acc.hue, w: q.st.kind, f: this.flags(q), mv: q.moving ? 1 : 0, e: [eq.helmet ? eq.helmet.rar : -1, eq.armor ? eq.armor.rar : -1, eq.boots ? eq.boots.rar : -1, eq.accessory ? eq.accessory.rar : -1, eq.weapon ? eq.weapon.rar : 0] });
      }
      for (const m of this.monsters.values()) {
        if (!near(m)) continue;
        ms.push({ i: m.id, k: m.type, x: R1(m.x), y: R1(m.y), a: R1(m.a), h: Math.round(m.hp), H: Math.round(m.maxHp), l: m.level, s: m.act ? m.act.k : 0, p: m.act && m.act.dur ? Math.min(1, R1(m.act.t / m.act.dur)) : 0, st: m.fx.stun > 0 ? 1 : 0, bn: m.fx.burnT > 0 ? 1 : 0 });
      }
      for (const q of this.projs) if (near(q)) pr.push({ i: q.id, k: q.kind, x: R1(q.x), y: R1(q.y), a: R1(Math.atan2(q.vy, q.vx)), r: q.r });
      for (const h of this.hazards) if (near(h)) hz.push({ i: h.id, x: Math.round(h.x), y: Math.round(h.y), r: h.r, t: R1(h.t), T: R1(h.tot), k: h.kind });
      for (const d of this.drops) if (near(d)) dr.push({ i: d.id, t: d.type, x: Math.round(d.x), y: Math.round(d.y), r: d.item ? d.item.rar : 0, n: d.item ? d.item.name : '' });
      const ev = this.events.filter(e => e.g || (Math.abs(e.x - X) < 1600 && Math.abs(e.y - Y) < 1100));
      const bar = p.acc.bar.map(id => id ? { id, r: R1(Math.max(0, p.cds[id] || 0)), t: R1(p.cdTot[id] || 1) } : null);
      const me = {
        x: R1(p.x), y: R1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), a: R1(p.a), hp: Math.round(p.hp), H: p.st.maxHp, xp: Math.floor(p.acc.xp), xn: C.xpNext(p.acc.level), lv: p.acc.level,
        gold: Math.floor(p.acc.gold), ess: p.acc.ess, bar, dcd: R1(Math.max(0, p.dodgeCd)), dT: 1.1, sh: Math.round(p.fx.shield), f: this.flags(p), dead: p.dead ? 1 : 0,
        sanct: this.inSanct(p) ? 1 : 0, shopOk: this.canShop(p) ? 1 : 0, sp: Math.round(p.st.spd), streak: p.streak, rt: p.dead ? Math.max(0, R1(1.2 - (this.time - p.deathT))) : 0, atkT: R1(Math.max(0, p.atkCd)),
        eq: [p.acc.equip.helmet ? p.acc.equip.helmet.rar : -1, p.acc.equip.armor ? p.acc.equip.armor.rar : -1, p.acc.equip.boots ? p.acc.equip.boots.rar : -1, p.acc.equip.accessory ? p.acc.equip.accessory.rar : -1, p.acc.equip.weapon ? p.acc.equip.weapon.rar : 0], w: p.st.kind
      };
      this.send(p, { t: 'snap', n: this.tick, me, p: ps, m: ms, pr, hz, dr, ev, np: this.players.size });
    }
  }
  sendBoard() {
    const rows = [...this.players.values()].map(p => ({ i: p.id, n: p.name, l: p.acc.level, k: p.acc.pk, mk: p.acc.mk, pw: p.st.power, s: p.streak, d: p.acc.deaths, x: Math.round(p.x), y: Math.round(p.y), c: p.acc.cls, u: p.acc.hue, dead: p.dead ? 1 : 0, sc: Acc.score(p.acc) }));
    rows.sort((a, b) => b.sc - a.sc);
    for (const p of this.players.values()) this.send(p, { t: 'board', rows });
  }

  // ───────── Actions du joueur ─────────
  handle(p, m) {
    const a = p.acc;
    switch (m.t) {
      case 'in': {
        const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
        p.in.mx = num(m.mx, -1, 1); p.in.my = num(m.my, -1, 1); p.in.a = num(m.a, -7, 7); p.in.ad = num(m.ad, 0, 3000); p.in.atk = !!m.atk;
        return;
      }
      case 'ping': return this.send(p, { t: 'pong', c: m.c });
      case 'getprof': return this.sendProfile(p);
      case 'dodge': return this.dodge(p);
      case 'skill': return this.cast(p, m.s | 0);
      case 'respawn': return this.respawn(p);
    }
    // actions de la forge (uniquement morts ou au sanctuaire)
    if (!this.canShop(p)) return this.err(p, 'Retournez au Sanctuaire (centre) pour dépenser vos ressources.');
    switch (m.t) {
      case 'up': {
        const k = m.k, S0 = C.STATS[k]; if (!S0) return;
        if (a.stats[k] >= S0.max) return this.err(p, 'Niveau maximum atteint.');
        const cost = C.statCost(k, a.stats[k]);
        if (a.gold < cost) return this.err(p, "Pas assez d'or.");
        a.gold -= cost; a.stats[k]++; this.recalc(p); return this.ok(p, 'stat', k);
      }
      case 'buy': {
        const it = a.shop[m.i | 0]; if (!it) return;
        const price = Items.buyPrice(it);
        if (a.inv.length >= 40) return this.err(p, 'Inventaire plein.');
        if (a.gold < price) return this.err(p, "Pas assez d'or.");
        a.gold -= price; a.inv.push(it); a.shop[m.i | 0] = null; return this.ok(p, 'buy', it.id);
      }
      case 'reroll': {
        const cost = 40 + 25 * a.rerolls;
        if (a.gold < cost) return this.err(p, "Pas assez d'or.");
        a.gold -= cost; a.rerolls++; a.shop = Items.genShop(a.level); return this.ok(p, 'reroll');
      }
      case 'equip': {
        const i = a.inv.findIndex(x => x.id === m.id); if (i < 0) return;
        const it = a.inv[i], old = a.equip[it.slot];
        a.equip[it.slot] = it; a.inv.splice(i, 1); if (old) a.inv.push(old);
        this.recalc(p); return this.ok(p, 'equip', it.id);
      }
      case 'unequip': {
        const it = a.equip[m.slot]; if (!it) return;
        if (a.inv.length >= 40) return this.err(p, 'Inventaire plein.');
        a.equip[m.slot] = null; a.inv.push(it); this.recalc(p); return this.ok(p, 'unequip');
      }
      case 'sell': {
        const i = a.inv.findIndex(x => x.id === m.id); if (i < 0) return;
        a.gold += Items.sellPrice(a.inv[i]); a.inv.splice(i, 1); return this.ok(p, 'sell');
      }
      case 'upg': {
        let it = a.inv.find(x => x.id === m.id);
        if (!it) for (const s of C.SLOTS) if (a.equip[s] && a.equip[s].id === m.id) it = a.equip[s];
        if (!it) return;
        if (it.lvl >= Items.MAX_ITEM_LVL) return this.err(p, 'Équipement au niveau maximum.');
        const cost = Items.upgradeCost(it);
        if (a.gold < cost) return this.err(p, "Pas assez d'or.");
        a.gold -= cost; it.lvl++; this.recalc(p); return this.ok(p, 'upg', it.id);
      }
      case 'learn': {
        const id = m.id, S0 = C.SKILLS[id]; if (!S0) return;
        const lv = a.skills[id] || 0;
        if (lv >= S0.maxLv) return this.err(p, 'Compétence au niveau maximum.');
        const cost = lv === 0 ? S0.unlock : C.skillUpgradeCost(lv);
        if (a.ess < cost) return this.err(p, "Pas assez d'essence.");
        a.ess -= cost; a.skills[id] = lv + 1;
        if (lv === 0 && !a.bar.includes(id)) { const f = a.bar.indexOf(null); if (f >= 0) a.bar[f] = id; }
        return this.ok(p, 'skill', id);
      }
      case 'slot': {
        const s = m.s | 0; if (s < 0 || s > 3) return;
        if (m.id === null) { a.bar[s] = null; return this.ok(p, 'slot'); }
        if (!a.skills[m.id]) return;
        const prev = a.bar.indexOf(m.id);
        if (prev >= 0) a.bar[prev] = a.bar[s];
        a.bar[s] = m.id; return this.ok(p, 'slot');
      }
    }
  }
}

module.exports = { Game };
