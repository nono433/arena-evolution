// Génération déterministe de l'arène : obstacles, points d'apparition.
const S = require('../shared/world');

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const ZONE_RECTS = {
  foret: [S.WALL + 40, S.WALL + 40, S.CX, S.CY], lave: [S.CX, S.WALL + 40, S.W - S.WALL - 40, S.CY],
  glace: [S.WALL + 40, S.CY, S.CX, S.H - S.WALL - 40], marais: [S.CX, S.CY, S.W - S.WALL - 40, S.H - S.WALL - 40]
};
const ZONE_TYPES = {
  foret: [['tree', 24, 0.7], ['rock', 28, 0.3]],
  lave: [['lava', 30, 0.7], ['rock', 28, 0.3]],
  glace: [['crystal', 26, 0.65], ['rock', 28, 0.35]],
  marais: [['deadtree', 20, 0.5], ['mushroom', 22, 0.3], ['rock', 28, 0.2]]
};

function genWorld() {
  const R = rng(20240607);
  const obstacles = [];
  const free = (x, y, r, gap) => {
    const dc = Math.hypot(x - S.CX, y - S.CY);
    if (dc < S.SANCT_R + 110) return false;
    for (const o of obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + r + gap) return false;
    return true;
  };
  // piliers du Colisée
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.26, rr = 380;
    obstacles.push({ x: Math.round(S.CX + Math.cos(a) * rr), y: Math.round(S.CY + Math.sin(a) * rr), r: 26, type: 'pillar', z: 'colisee', v: i % 3 });
  }
  // blocs de pierre dans le Colisée
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, rr = 250;
    obstacles.push({ x: Math.round(S.CX + Math.cos(a) * rr), y: Math.round(S.CY + Math.sin(a) * rr), r: 22, type: 'rock', z: 'colisee', v: i % 4 });
  }
  for (const [zone, rect] of Object.entries(ZONE_RECTS)) {
    let n = 0, tries = 0;
    while (n < 40 && tries++ < 3000) {
      const x = rect[0] + R() * (rect[2] - rect[0]), y = rect[1] + R() * (rect[3] - rect[1]);
      if (S.zoneAt(x, y) !== zone) continue;
      let roll = R(), t = ZONE_TYPES[zone][0];
      for (const c of ZONE_TYPES[zone]) { if (roll < c[2]) { t = c; break; } roll -= c[2]; }
      const r = t[1] + Math.floor(R() * 6);
      if (!free(x, y, r, 70)) continue;
      obstacles.push({ x: Math.round(x), y: Math.round(y), r, type: t[0], z: zone, v: Math.floor(R() * 4) });
      n++;
    }
  }
  // points d'apparition des monstres
  const monsterSpawns = [];
  let tries = 0;
  while (monsterSpawns.length < 36 && tries++ < 5000) {
    const x = S.WALL + 120 + R() * (S.W - 2 * S.WALL - 240), y = S.WALL + 120 + R() * (S.H - 2 * S.WALL - 240);
    if (Math.hypot(x - S.CX, y - S.CY) < S.COLO_R + 80) continue;
    if (!free(x, y, 30, 20)) continue;
    if (monsterSpawns.some(p => Math.hypot(p.x - x, p.y - y) < 280)) continue;
    monsterSpawns.push({ x: Math.round(x), y: Math.round(y), zone: S.zoneAt(x, y) });
  }
  // points de réapparition des joueurs (autour du sanctuaire)
  const playerSpawns = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    playerSpawns.push({ x: Math.round(S.CX + Math.cos(a) * 95), y: Math.round(S.CY + Math.sin(a) * 95) });
  }
  const lairs = { golem: { x: 560, y: 520 }, dragon: { x: 2660, y: 520 } };
  // dégager les repaires
  for (const l of Object.values(lairs)) for (let i = obstacles.length - 1; i >= 0; i--) if (Math.hypot(obstacles[i].x - l.x, obstacles[i].y - l.y) < 160) obstacles.splice(i, 1);
  return { obstacles, monsterSpawns, playerSpawns, lairs };
}

module.exports = { genWorld };
