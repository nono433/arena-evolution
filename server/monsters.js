// IA des monstres : chaque type a son comportement et ses attaques.
const S = require('../shared/world');
const { MONSTERS } = require('./config');

const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const validTarget = p => !p.dead && Math.hypot(p.x - S.CX, p.y - S.CY) > S.SANCT_R;

function pickTarget(g, m, range) {
  const cur = m.tgt ? g.players.get(m.tgt) : null;
  if (cur && validTarget(cur) && dist(m, cur) < range * 1.6) return cur;
  let best = null, bd = range;
  for (const p of g.players.values()) {
    if (!validTarget(p)) continue;
    const d = dist(m, p);
    if (d < bd) { bd = d; best = p; }
  }
  m.tgt = best ? best.id : null;
  return best;
}
function step(g, m, dx, dy, speed, dt) {
  const d = Math.hypot(dx, dy) || 1;
  const sl = m.fx.slowT > 0 ? m.fx.slow : 1;
  g.move(m, dx / d * speed * sl * dt, dy / d * speed * sl * dt);
}
const actRun = (m, dt) => { m.act.t += dt; return m.act.t >= m.act.dur; };

const AI = {
  slime(g, m, T, dt, t) {
    m.a = angTo(m, t);
    if (m.act) {
      if (actRun(m, dt)) {
        if (dist(m, t) < m.r + t.r + 34) g.damage(m, t, m.dmg, { kb: { a: m.a, f: 240 } });
        m.act = null; m.cd = 1.1;
      }
      return;
    }
    const d = dist(m, t);
    const hop = 0.35 + 0.9 * Math.max(0, Math.sin(m.t * 5 + m.id));
    if (d > m.r + t.r + 20) step(g, m, t.x - m.x, t.y - m.y, m.speed * hop, dt);
    else if (m.cd <= 0) m.act = { k: 'swing', t: 0, dur: 0.35 };
  },

  bat(g, m, T, dt, t) {
    const d = dist(m, t);
    if (m.act) {
      const a = m.act; a.t += dt;
      if (a.k === 'wind') {
        m.a = angTo(m, t);
        if (a.t >= a.dur) m.act = { k: 'dive', t: 0, dur: 0.42, a: m.a, hit: false };
        return;
      }
      if (a.k === 'dive') {
        g.move(m, Math.cos(a.a) * 430 * dt, Math.sin(a.a) * 430 * dt);
        if (!a.hit && dist(m, t) < m.r + t.r + 8) { a.hit = true; g.damage(m, t, m.dmg, { kb: { a: a.a, f: 200 } }); }
        if (a.t >= a.dur) { m.act = null; m.cd = rnd(1.4, 2.4); }
        return;
      }
    }
    m.orb = (m.orb || Math.random() * 6) + dt * 1.8 * (m.id % 2 ? 1 : -1);
    step(g, m, t.x + Math.cos(m.orb) * 170 - m.x, t.y + Math.sin(m.orb) * 130 - m.y, m.speed, dt);
    m.a = angTo(m, t);
    if (m.cd <= 0 && d < 320) m.act = { k: 'wind', t: 0, dur: 0.4 };
  },

  archer(g, m, T, dt, t) {
    const d = dist(m, t); m.a = angTo(m, t);
    if (m.act) {
      if (actRun(m, dt)) {
        g.addProj({ team: 'm', owner: m, x: m.x, y: m.y, a: m.a, speed: 520, r: 8, dmg: m.dmg, life: 1.2, kind: 'arrow' });
        m.act = null; m.cd = rnd(1.6, 2.4);
      }
      return;
    }
    m.strafe = m.strafe || 1;
    if (Math.random() < dt * 0.4) m.strafe *= -1;
    if (d < 210) step(g, m, m.x - t.x, m.y - t.y, m.speed * 1.15, dt);
    else if (d > 400) step(g, m, t.x - m.x, t.y - m.y, m.speed, dt);
    else { const a = m.a + Math.PI / 2 * m.strafe; step(g, m, Math.cos(a), Math.sin(a), m.speed * 0.6, dt); }
    if (m.cd <= 0 && d < 540) m.act = { k: 'shoot', t: 0, dur: 0.6 };
  },

  brute(g, m, T, dt, t) {
    const d = dist(m, t);
    if (m.act) {
      const a = m.act; a.t += dt;
      if (a.k === 'swing') {
        if (a.t >= a.dur) { g.coneHit(m, m.a, 85 + m.r, Math.PI * 0.7, m.dmg, { kb: { a: m.a, f: 300 } }); m.act = null; m.cd = 1.3; }
      } else if (a.k === 'cwind') {
        if (a.t < a.dur * 0.8) a.a = angTo(m, t);
        m.a = a.a;
        if (a.t >= a.dur) m.act = { k: 'charge', t: 0, dur: 0.5, a: a.a, hit: false };
      } else if (a.k === 'charge') {
        g.move(m, Math.cos(a.a) * 480 * dt, Math.sin(a.a) * 480 * dt);
        if (!a.hit && dist(m, t) < m.r + t.r + 6) { a.hit = true; g.damage(m, t, m.dmg * 1.4, { kb: { a: a.a, f: 520 }, stun: 0.4 }); }
        if (a.t >= a.dur) m.act = { k: 'recover', t: 0, dur: 0.8 };
      } else if (a.k === 'recover') {
        if (a.t >= a.dur) { m.act = null; m.cd = 1.5; }
      }
      return;
    }
    m.a = angTo(m, t);
    if (d < m.r + t.r + 55) { if (m.cd <= 0) m.act = { k: 'swing', t: 0, dur: 0.5 }; }
    else {
      step(g, m, t.x - m.x, t.y - m.y, m.speed, dt);
      if (m.cd <= 0 && d > 140 && d < 340 && Math.random() < dt * 1.2) m.act = { k: 'cwind', t: 0, dur: 0.75, a: m.a };
    }
  },

  wraith(g, m, T, dt, t) {
    const d = dist(m, t); m.a = angTo(m, t);
    if (m.act) {
      const a = m.act;
      if (actRun(m, dt)) {
        if (a.k === 'volley') {
          const n = m.hp < m.maxHp * 0.5 ? 5 : 3;
          for (let i = 0; i < n; i++) g.addProj({ team: 'm', owner: m, x: m.x, y: m.y, a: m.a + (i - (n - 1) / 2) * 0.28, speed: 380, r: 11, dmg: m.dmg, life: 1.8, kind: 'shadow' });
          m.cd = rnd(2, 3);
        } else if (a.k === 'blink') {
          g.event({ e: 'tele', x: m.x, y: m.y, k: 'wraith' });
          const ang = Math.random() * 6.28;
          const p = g.col.resolve(t.x + Math.cos(ang) * 260, t.y + Math.sin(ang) * 260, m.r);
          m.x = p.x; m.y = p.y;
          g.event({ e: 'tele', x: m.x, y: m.y, k: 'wraith' });
          m.cd = 0.7;
        }
        m.act = null;
      }
      return;
    }
    if (d < 260) step(g, m, m.x - t.x, m.y - t.y, m.speed, dt);
    else if (d > 400) step(g, m, t.x - m.x, t.y - m.y, m.speed, dt);
    else { m.strafe = m.strafe || 1; if (Math.random() < dt * 0.3) m.strafe *= -1; const a = m.a + Math.PI / 2 * m.strafe; step(g, m, Math.cos(a), Math.sin(a), m.speed * 0.7, dt); }
    m.blinkT = (m.blinkT === undefined ? 6 : m.blinkT) - dt;
    if (m.blinkT <= 0 && d < 300) { m.blinkT = rnd(6, 9); m.act = { k: 'blink', t: 0, dur: 0.5 }; }
    else if (m.cd <= 0 && d < 640) m.act = { k: 'volley', t: 0, dur: 0.65 };
  },

  ogre(g, m, T, dt, t) {
    const d = dist(m, t), en = m.hp < m.maxHp * 0.4 ? 1.3 : 1;
    if (m.act) {
      const a = m.act;
      if (actRun(m, dt)) {
        if (a.k === 'throw') g.addProj({ team: 'm', owner: m, x: m.x, y: m.y, a: m.a, speed: 360, r: 18, dmg: m.dmg * 1.1, life: 1.6, kind: 'rock', exp: 80 });
        m.act = null; m.cd = (a.k === 'slam' ? 2.2 : 3) / en;
      }
      return;
    }
    m.a = angTo(m, t);
    if (d < 190 && m.cd <= 0) {
      m.act = { k: 'slam', t: 0, dur: 0.9 };
      g.addHazard({ x: m.x, y: m.y, r: 140, t: 0.9, dmg: m.dmg * 1.3, kind: 'slam', owner: m });
    } else if (d > 280 && d < 640 && m.cd <= 0 && Math.random() < dt * 1.5) m.act = { k: 'throw', t: 0, dur: 0.7 };
    else if (d > m.r + t.r + 40) step(g, m, t.x - m.x, t.y - m.y, m.speed * en, dt);
  },

  golem(g, m, T, dt, t) {
    const d = dist(m, t), p2 = m.hp < m.maxHp * 0.5;
    if (!m.s1 && m.hp < m.maxHp * 0.6) { m.s1 = 1; for (let i = 0; i < 2; i++) g.summon('slime', m); g.event({ e: 'alert', g: 1, m: 'Le Roi Golem invoque des gelées !' }); }
    if (!m.s2 && m.hp < m.maxHp * 0.3) { m.s2 = 1; for (let i = 0; i < 3; i++) g.summon('slime', m); }
    if (m.act) {
      const a = m.act;
      if (actRun(m, dt)) {
        if (a.k === 'rain') {
          const n = p2 ? 8 : 5;
          for (let i = 0; i < n; i++) {
            const ang = Math.random() * 6.28, rr = i === 0 ? 0 : rnd(60, 240);
            g.addHazard({ x: t.x + Math.cos(ang) * rr, y: t.y + Math.sin(ang) * rr, r: 85, t: 1.1 + i * 0.08, dmg: m.dmg, kind: 'meteor', owner: m });
          }
        }
        m.act = null; m.cd = p2 ? 1.8 : 2.8;
      }
      return;
    }
    m.a = angTo(m, t);
    if (m.cd <= 0 && d < 280) {
      m.act = { k: 'slam', t: 0, dur: 1.1 };
      g.addHazard({ x: m.x, y: m.y, r: 200, t: 1.1, dmg: m.dmg * 1.4, kind: 'slam', owner: m });
    } else if (m.cd <= 0 && d >= 280) m.act = { k: 'rain', t: 0, dur: 0.9 };
    else if (d > m.r + t.r + 60) step(g, m, t.x - m.x, t.y - m.y, m.speed * (p2 ? 1.35 : 1), dt);
  },

  dragon(g, m, T, dt, t) {
    const d = dist(m, t), p2 = m.hp < m.maxHp * 0.5;
    if (m.act) {
      const a = m.act; a.t += dt;
      if (a.k === 'cwind') {
        if (a.t < a.dur * 0.8) a.a = angTo(m, t);
        m.a = a.a;
        if (a.t >= a.dur) m.act = { k: 'charge', t: 0, dur: 0.55, a: a.a, hit: false };
        return;
      }
      if (a.k === 'charge') {
        g.move(m, Math.cos(a.a) * 650 * dt, Math.sin(a.a) * 650 * dt);
        if (!a.hit && dist(m, t) < m.r + t.r + 8) { a.hit = true; g.damage(m, t, m.dmg * 1.3, { kb: { a: a.a, f: 560 }, burn: { dps: m.dmg * 0.15, t: 3 } }); }
        if (a.t >= a.dur) { m.act = null; m.cd = p2 ? 1.5 : 2.4; }
        return;
      }
      if (a.t >= a.dur) {
        if (a.k === 'breath') {
          g.event({ e: 'breath', x: m.x, y: m.y, a: m.a, r: 430, id: m.id });
          g.coneHit(m, m.a, 430, Math.PI * 0.42, m.dmg * 1.2, { burn: { dps: m.dmg * 0.15, t: 3 }, kb: { a: m.a, f: 200 } });
        } else if (a.k === 'ring') {
          const n = p2 ? 20 : 14, off = Math.random() * 6;
          for (let i = 0; i < n; i++) g.addProj({ team: 'm', owner: m, x: m.x, y: m.y, a: off + i / n * Math.PI * 2, speed: 300, r: 12, dmg: m.dmg * 0.8, life: 2.4, kind: 'fire', burn: { dps: m.dmg * 0.1, t: 2 } });
        } else if (a.k === 'meteor') {
          for (const p of g.players.values()) {
            if (!validTarget(p) || dist(p, m) > 1000) continue;
            const n = p2 ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const ang = Math.random() * 6.28, rr = i === 0 ? 0 : rnd(80, 260);
              g.addHazard({ x: p.x + Math.cos(ang) * rr, y: p.y + Math.sin(ang) * rr, r: 95, t: 1.2 + i * 0.1, dmg: m.dmg, kind: 'meteor', owner: m, burn: true });
            }
          }
        }
        m.act = null; m.cd = p2 ? 1.5 : 2.4;
      }
      return;
    }
    m.a = angTo(m, t);
    if (m.cd <= 0) {
      const r = Math.random();
      if (d < 330) m.act = r < 0.5 ? { k: 'breath', t: 0, dur: 0.9 } : { k: 'ring', t: 0, dur: 0.8 };
      else m.act = r < 0.35 ? { k: 'cwind', t: 0, dur: 0.6, a: m.a } : r < 0.7 ? { k: 'meteor', t: 0, dur: 0.7 } : { k: 'ring', t: 0, dur: 0.8 };
    } else if (d > 280) step(g, m, t.x - m.x, t.y - m.y, m.speed * (p2 ? 1.25 : 1), dt);
    else { m.strafe = m.strafe || 1; if (Math.random() < dt * 0.3) m.strafe *= -1; const a = m.a + Math.PI / 2 * m.strafe; step(g, m, Math.cos(a), Math.sin(a), m.speed * 0.5, dt); }
  }
};

function update(g, m, dt) {
  const T = MONSTERS[m.type];
  m.t += dt; m.cd -= dt;
  if (m.flash > 0) m.flash -= dt;
  const fx = m.fx;
  if (fx.slowT > 0) fx.slowT -= dt;
  if (fx.burnT > 0) { fx.burnT -= dt; g.dot(m, fx.burn, dt, fx.burnSrc); if (m.hp <= 0) return; }
  // recul
  if (m.kx || m.ky) { g.move(m, m.kx * dt, m.ky * dt); const f = Math.exp(-9 * dt); m.kx *= f; m.ky *= f; if (Math.abs(m.kx) + Math.abs(m.ky) < 5) m.kx = m.ky = 0; }
  if (fx.stun > 0) { fx.stun -= dt; m.act = null; return; }
  const leash = m.cat === 'boss' ? 1900 : 1100;
  if (m.returning) {
    m.act = null; m.tgt = null;
    step(g, m, m.home.x - m.x, m.home.y - m.y, m.speed * 1.6, dt);
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.15 * dt);
    if (dist(m, m.home) < 50) m.returning = false;
    return;
  }
  const tgt = pickTarget(g, m, T.aggro);
  if (!tgt) {
    m.act = null;
    m.wander.t -= dt;
    if (m.wander.t <= 0) { m.wander.t = rnd(2, 5); m.wander.x = m.home.x + rnd(-130, 130); m.wander.y = m.home.y + rnd(-130, 130); }
    if (Math.hypot(m.wander.x - m.x, m.wander.y - m.y) > 14) { step(g, m, m.wander.x - m.x, m.wander.y - m.y, m.speed * 0.35, dt); m.a = Math.atan2(m.wander.y - m.y, m.wander.x - m.x); }
    if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.04 * dt);
    return;
  }
  if (dist(m, m.home) > leash) { m.returning = true; return; }
  AI[T.ai](g, m, T, dt, tgt);
}

module.exports = { update, dist };
