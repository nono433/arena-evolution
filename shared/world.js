// Code partagé client/serveur : dimensions de l'arène, zones et collisions.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const W = 3200, H = 2400, CX = 1600, CY = 1200, WALL = 70, COLO_R = 470, SANCT_R = 170;
  const ZONE_NAMES = {
    colisee: 'Le Colisée', foret: 'Forêt Murmurante', lave: 'Plaines Ardentes',
    glace: 'Toundra Gelée', marais: 'Marais Putride'
  };
  function zoneAt(x, y) {
    const dx = x - CX, dy = y - CY;
    if (dx * dx + dy * dy < COLO_R * COLO_R) return 'colisee';
    if (dy < 0) return dx < 0 ? 'foret' : 'lave';
    return dx < 0 ? 'glace' : 'marais';
  }
  const CELL = 160;
  function makeCollider(obstacles) {
    const grid = new Map();
    const key = (cx, cy) => cx * 100 + cy;
    for (const o of obstacles) {
      const x0 = Math.floor((o.x - o.r) / CELL), x1 = Math.floor((o.x + o.r) / CELL);
      const y0 = Math.floor((o.y - o.r) / CELL), y1 = Math.floor((o.y + o.r) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const k = key(cx, cy);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(o);
      }
    }
    const out = { x: 0, y: 0 };
    function resolve(x, y, r) {
      for (let it = 0; it < 2; it++) {
        const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
        const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
          const list = grid.get(key(cx, cy));
          if (!list) continue;
          for (const o of list) {
            let dx = x - o.x, dy = y - o.y;
            let d = Math.sqrt(dx * dx + dy * dy);
            const min = o.r + r;
            if (d < min) {
              if (d < 0.001) { dx = 1; dy = 0; d = 1; }
              x = o.x + dx / d * min; y = o.y + dy / d * min;
            }
          }
        }
      }
      out.x = Math.max(WALL + r, Math.min(W - WALL - r, x));
      out.y = Math.max(WALL + r, Math.min(H - WALL - r, y));
      return out;
    }
    function hit(x, y, r) {
      const list = grid.get(key(Math.floor(x / CELL), Math.floor(y / CELL)));
      if (list) for (const o of list) {
        const dx = x - o.x, dy = y - o.y, m = o.r + r;
        if (dx * dx + dy * dy < m * m) return true;
      }
      return x < WALL || y < WALL || x > W - WALL || y > H - WALL;
    }
    return { resolve, hit };
  }
  return { W, H, CX, CY, WALL, COLO_R, SANCT_R, ZONE_NAMES, zoneAt, makeCollider };
});
