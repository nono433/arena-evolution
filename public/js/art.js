// Direction artistique : tout est dessiné procéduralement (dégradés, ombres, animations).
const Art = (() => {
  const TAU = Math.PI * 2;
  const RC = ['#b8c0cc', '#4aa3ff', '#b86bff', '#ffb02e', '#ff4d6d'];
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => gr.addColorStop(s[0], s[1])); return gr; }
  function rad(g, x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => gr.addColorStop(s[0], s[1])); return gr; }
  function ell(g, x, y, rx, ry, fill) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } }
  function shadow(g, rx, ry, a = 0.35) { ell(g, 0, 2, rx, ry, `rgba(0,0,0,${a})`); }
  function poly(g, pts, fill, stroke, lw) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1.5; g.stroke(); } }
  function glow(g, x, y, r, color, a = 1) { g.save(); g.globalAlpha = a; g.fillStyle = rad(g, x, y, 0, r, [[0, color], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }

  // ───────── bruit ─────────
  function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
  }
  const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;
  const sig = x => 1 / (1 + Math.exp(-x));

  // ───────── décor ─────────
  const PAL = {
    foret: [[38, 84, 44], [62, 118, 58]], lave: [[52, 28, 26], [92, 46, 30]], glace: [[150, 192, 218], [208, 232, 244]],
    marais: [[44, 58, 40], [72, 90, 52]], colisee: [[138, 124, 100], [176, 162, 134]]
  };
  function buildBackground(obstacles) {
    const S = Shared, W = S.W, H = S.H;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const cell = 8, w = W / cell, h = H / cell;
    const lc = document.createElement('canvas'); lc.width = w; lc.height = h;
    const lg = lc.getContext('2d'), img = lg.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = (i + 0.5) * cell, y = (j + 0.5) * cell, dx = x - S.CX, dy = y - S.CY, d = Math.hypot(dx, dy);
      const wx = sig(dx / 90), wy = sig(dy / 90);
      const wz = { foret: (1 - wx) * (1 - wy), lave: wx * (1 - wy), glace: (1 - wx) * wy, marais: wx * wy };
      const n = fbm(x / 140, y / 140);
      let r = 0, gg = 0, b = 0;
      for (const k in wz) { const p = PAL[k], t = Math.min(1, n * 1.3); r += wz[k] * (p[0][0] + (p[1][0] - p[0][0]) * t); gg += wz[k] * (p[0][1] + (p[1][1] - p[0][1]) * t); b += wz[k] * (p[0][2] + (p[1][2] - p[0][2]) * t); }
      const wc = sig((S.COLO_R - d) / 26), pc = PAL.colisee, t2 = Math.min(1, n * 1.2);
      r = r * (1 - wc) + wc * (pc[0][0] + (pc[1][0] - pc[0][0]) * t2); gg = gg * (1 - wc) + wc * (pc[0][1] + (pc[1][1] - pc[0][1]) * t2); b = b * (1 - wc) + wc * (pc[0][2] + (pc[1][2] - pc[0][2]) * t2);
      const k = (j * w + i) * 4; img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(lc, 0, 0, W, H);
    const R = rng(77);
    const rp = (rect) => [rect[0] + R() * (rect[2] - rect[0]), rect[1] + R() * (rect[3] - rect[1])];
    const zr = { foret: [70, 70, S.CX, S.CY], lave: [S.CX, 70, W - 70, S.CY], glace: [70, S.CY, S.CX, H - 70], marais: [S.CX, S.CY, W - 70, H - 70] };
    const inZone = (x, y, z) => S.zoneAt(x, y) === z;
    // grain
    for (let i = 0; i < 26000; i++) {
      const x = R() * W, y = R() * H; g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
      g.fillRect(x, y, 2 + R() * 3, 1 + R() * 2);
    }
    // forêt : herbe, fleurs, feuilles
    for (let i = 0; i < 5200; i++) {
      const [x, y] = rp(zr.foret); if (!inZone(x, y, 'foret')) continue;
      const hh = 105 + R() * 25, l = 22 + R() * 22;
      g.strokeStyle = hsl(hh, 50, l, 0.8); g.lineWidth = 1.4;
      g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * 2.5, y); g.quadraticCurveTo(x + k * 3, y - 6, x + k * 5 + (R() - 0.5) * 4, y - 9 - R() * 6); } g.stroke();
    }
    for (let i = 0; i < 260; i++) {
      const [x, y] = rp(zr.foret); if (!inZone(x, y, 'foret')) continue;
      const col = ['#ffe36a', '#ff8fb1', '#fff', '#b79bff'][Math.floor(R() * 4)];
      g.fillStyle = col; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 2.2, y + Math.sin(k * 1.256) * 2.2, 1.6, 0, TAU); g.fill(); }
      g.fillStyle = '#e8a020'; g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill();
    }
    for (let i = 0; i < 60; i++) { const [x, y] = rp(zr.foret); if (!inZone(x, y, 'foret')) continue; g.fillStyle = 'rgba(70,45,25,.25)'; g.beginPath(); g.ellipse(x, y, 20 + R() * 40, 10 + R() * 20, R() * 3, 0, TAU); g.fill(); }
    // lave : fissures lumineuses
    for (let i = 0; i < 150; i++) {
      let [x, y] = rp(zr.lave); if (!inZone(x, y, 'lave')) continue;
      g.save(); g.strokeStyle = 'rgba(255,120,30,.9)'; g.shadowColor = '#ff6a10'; g.shadowBlur = 12; g.lineWidth = 1.5 + R() * 2; g.beginPath(); g.moveTo(x, y);
      let a = R() * TAU; for (let k = 0; k < 6; k++) { a += (R() - 0.5) * 1.4; x += Math.cos(a) * (14 + R() * 24); y += Math.sin(a) * (14 + R() * 24); g.lineTo(x, y); }
      g.stroke(); g.restore();
    }
    for (let i = 0; i < 900; i++) { const [x, y] = rp(zr.lave); if (!inZone(x, y, 'lave')) continue; g.fillStyle = R() < 0.3 ? 'rgba(255,150,60,.5)' : 'rgba(20,10,10,.35)'; g.fillRect(x, y, 2 + R() * 4, 2 + R() * 3); }
    for (let i = 0; i < 40; i++) { const [x, y] = rp(zr.lave); if (!inZone(x, y, 'lave')) continue; g.fillStyle = 'rgba(30,18,16,.35)'; g.beginPath(); g.ellipse(x, y, 30 + R() * 50, 14 + R() * 24, R() * 3, 0, TAU); g.fill(); }
    // glace : reflets, fissures, neige
    for (let i = 0; i < 90; i++) { const [x, y] = rp(zr.glace); if (!inZone(x, y, 'glace')) continue; g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(x, y, 30 + R() * 70, 8 + R() * 20, R() * 3, 0, TAU); g.fill(); }
    for (let i = 0; i < 140; i++) {
      let [x, y] = rp(zr.glace); if (!inZone(x, y, 'glace')) continue;
      g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
      let a = R() * TAU; for (let k = 0; k < 5; k++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * (10 + R() * 22); y += Math.sin(a) * (10 + R() * 22); g.lineTo(x, y); } g.stroke();
      g.strokeStyle = 'rgba(90,150,200,.4)'; g.stroke();
    }
    for (let i = 0; i < 700; i++) { const [x, y] = rp(zr.glace); if (!inZone(x, y, 'glace')) continue; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x, y, 2, 2); }
    // marais : eau stagnante, joncs, nénuphars
    for (let i = 0; i < 70; i++) {
      const [x, y] = rp(zr.marais); if (!inZone(x, y, 'marais')) continue;
      const rx = 40 + R() * 80, ry = 20 + R() * 40;
      g.fillStyle = rad(g, x, y, 0, rx, [[0, 'rgba(24,50,50,.85)'], [0.8, 'rgba(34,70,64,.7)'], [1, 'rgba(60,90,60,0)']]);
      g.beginPath(); g.ellipse(x, y, rx, ry, R() * 3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(160,220,200,.25)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x - 4, y - 3, rx * 0.6, ry * 0.5, 0, 0.3, 2.2); g.stroke();
      if (R() < 0.6) { g.fillStyle = '#3d7a3a'; g.beginPath(); g.arc(x + (R() - 0.5) * rx, y + (R() - 0.5) * ry, 6 + R() * 4, 0.4, TAU - 0.4); g.lineTo(x, y); g.fill(); }
    }
    for (let i = 0; i < 1400; i++) { const [x, y] = rp(zr.marais); if (!inZone(x, y, 'marais')) continue; g.strokeStyle = hsl(80 + R() * 40, 35, 25 + R() * 15, 0.8); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 6, y - 8, x + (R() - 0.5) * 8, y - 12 - R() * 8); g.stroke(); }
    // Colisée : dalles, anneaux, runes
    g.save(); g.beginPath(); g.arc(S.CX, S.CY, S.COLO_R, 0, TAU); g.clip();
    for (let r = 60; r < S.COLO_R; r += 46) { g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(S.CX, S.CY, r, 0, TAU); g.stroke(); const n = Math.floor(r * TAU / 46); for (let i = 0; i < n; i++) { const a = i / n * TAU + (r % 3); g.beginPath(); g.moveTo(S.CX + Math.cos(a) * r, S.CY + Math.sin(a) * r); g.lineTo(S.CX + Math.cos(a) * (r + 46), S.CY + Math.sin(a) * (r + 46)); g.stroke(); } }
    for (let i = 0; i < 1500; i++) { const a = R() * TAU, d = Math.sqrt(R()) * S.COLO_R; g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)'; g.fillRect(S.CX + Math.cos(a) * d, S.CY + Math.sin(a) * d, 3 + R() * 6, 2 + R() * 4); }
    g.restore();
    // bordure du Colisée
    g.strokeStyle = '#4a3d2a'; g.lineWidth = 14; g.beginPath(); g.arc(S.CX, S.CY, S.COLO_R, 0, TAU); g.stroke();
    g.strokeStyle = '#8c7a58'; g.lineWidth = 4; g.beginPath(); g.arc(S.CX, S.CY, S.COLO_R - 6, 0, TAU); g.stroke();
    // sanctuaire
    const sr = S.SANCT_R;
    g.fillStyle = rad(g, S.CX, S.CY, 0, sr, [[0, 'rgba(120,190,255,.55)'], [0.7, 'rgba(80,140,230,.3)'], [1, 'rgba(60,110,220,.15)']]);
    g.beginPath(); g.arc(S.CX, S.CY, sr, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(190,225,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(S.CX, S.CY, sr, 0, TAU); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(S.CX, S.CY, sr - 14, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(210,235,255,.85)'; g.font = '16px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.save(); g.translate(S.CX + Math.cos(a) * (sr - 28), S.CY + Math.sin(a) * (sr - 28)); g.rotate(a + Math.PI / 2); g.fillText(runes[i], 0, 0); g.restore(); }
    g.strokeStyle = 'rgba(210,235,255,.7)'; g.lineWidth = 2;
    for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU * 2 / 5 + k * 0.62; const x = S.CX + Math.cos(a) * (sr - 50), y = S.CY + Math.sin(a) * (sr - 50); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
    // murailles
    const WL = S.WALL;
    g.fillStyle = '#14121a'; g.fillRect(0, 0, W, WL); g.fillRect(0, H - WL, W, WL); g.fillRect(0, 0, WL, H); g.fillRect(W - WL, 0, WL, H);
    const brick = (x0, y0, w0, h0) => { g.save(); g.beginPath(); g.rect(x0, y0, w0, h0); g.clip(); for (let y = y0; y < y0 + h0; y += 18) for (let x = x0 - ((y / 18) % 2) * 22; x < x0 + w0; x += 44) { const l = 24 + R() * 10; g.fillStyle = `hsl(250,12%,${l}%)`; g.fillRect(x + 1, y + 1, 42, 16); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 1, y + 1, 42, 3); } g.restore(); };
    brick(0, 0, W, WL - 8); brick(0, H - WL + 8, W, WL - 8); brick(0, 0, WL - 8, H); brick(W - WL + 8, 0, WL - 8, H);
    g.fillStyle = lin(g, 0, WL - 8, 0, WL + 8, [[0, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(WL, WL - 8, W - 2 * WL, 16);
    g.fillStyle = lin(g, 0, H - WL - 8, 0, H - WL + 8, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); g.fillRect(WL, H - WL - 8, W - 2 * WL, 16);
    // torches
    for (let x = 200; x < W; x += 400) for (const y of [WL - 10, H - WL + 10]) { glow(g, x, y, 90, 'rgba(255,160,60,.35)'); g.fillStyle = '#ffb040'; g.beginPath(); g.ellipse(x, y, 5, 8, 0, 0, TAU); g.fill(); g.fillStyle = '#fff2b0'; g.beginPath(); g.ellipse(x, y + 2, 2.4, 4, 0, 0, TAU); g.fill(); }
    for (let y = 200; y < H; y += 400) for (const x of [WL - 10, W - WL + 10]) { glow(g, x, y, 90, 'rgba(255,160,60,.35)'); g.fillStyle = '#ffb040'; g.beginPath(); g.ellipse(x, y, 5, 8, 0, 0, TAU); g.fill(); g.fillStyle = '#fff2b0'; g.beginPath(); g.ellipse(x, y + 2, 2.4, 4, 0, 0, TAU); g.fill(); }
    // ombres au sol des obstacles
    for (const o of obstacles) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(o.x + 4, o.y + 4, o.r * 1.5, o.r * 0.7, 0, 0, TAU); g.fill(); }
    return c;
  }

  // ───────── obstacles (sprites pré-rendus) ─────────
  const spriteCache = new Map();
  function drawObstacle(g, o) {
    const r = o.r, R = rng(o.x * 31 + o.y), v = o.v;
    shadow(g, r * 1.5, r * 0.6, 0.3);
    switch (o.type) {
      case 'tree': {
        const pine = v === 3;
        g.fillStyle = lin(g, -r * .4, 0, r * .4, 0, [[0, '#4a3220'], [0.5, '#6e4b2e'], [1, '#3a2616']]);
        g.beginPath(); g.moveTo(-r * .5, 2); g.quadraticCurveTo(-r * .3, -r, -r * .25, -r * 2.2); g.lineTo(r * .25, -r * 2.2); g.quadraticCurveTo(r * .3, -r, r * .5, 2); g.fill();
        if (pine) { for (let i = 0; i < 4; i++) { const y = -r * 1.2 - i * r * 1.1, w = r * (2.1 - i * 0.42); poly(g, [[-w, y], [0, y - r * 1.8], [w, y]], lin(g, -w, y, w, y, [[0, '#1d4d2c'], [0.5, '#2f7a40'], [1, '#18401f']]), 'rgba(0,0,0,.25)', 1); } }
        else {
          const h0 = 95 + v * 12, cx = [[-r * .9, -r * 2.9, r * 1.5], [r * .9, -r * 2.8, r * 1.4], [0, -r * 3.6, r * 1.7], [-r * .3, -r * 2.3, r * 1.4]];
          for (const [x, y, rr] of cx) { g.fillStyle = rad(g, x - rr * .3, y - rr * .3, rr * .1, rr, [[0, hsl(h0 + 10, 55, 46)], [0.7, hsl(h0, 55, 30)], [1, hsl(h0 - 5, 50, 20)]]); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
          for (let i = 0; i < 26; i++) { const a = R() * TAU, d = R() * r * 2; g.fillStyle = hsl(h0 + 20, 60, 52, 0.55); g.beginPath(); g.arc(Math.cos(a) * d, -r * 3 + Math.sin(a) * d * 0.8, 2 + R() * 3, 0, TAU); g.fill(); }
        }
        break;
      }
      case 'rock': {
        const z = o.z, base = z === 'glace' ? [200, 18] : z === 'lave' ? [10, 10] : z === 'marais' ? [90, 10] : [220, 6];
        const n = 9, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (0.85 + R() * 0.3); pts.push([Math.cos(a) * rr * 1.1, -r * 0.9 + Math.sin(a) * rr * 0.9]); }
        g.fillStyle = lin(g, -r, -r * 2, r, 0, [[0, hsl(base[0], base[1], 62)], [0.5, hsl(base[0], base[1], 40)], [1, hsl(base[0], base[1], 24)]]);
        poly(g, pts, g.fillStyle, 'rgba(0,0,0,.45)', 2);
        g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(pts[6][0], pts[6][1]); g.lineTo(pts[7][0], pts[7][1]); g.lineTo(pts[8][0], pts[8][1]); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.moveTo(-r * .2, -r * 1.2); g.lineTo(r * .1, -r * .6); g.lineTo(-r * .1, -r * .2); g.stroke();
        if (z === 'glace' || z === 'foret') { g.fillStyle = z === 'glace' ? 'rgba(255,255,255,.9)' : 'rgba(80,140,60,.85)'; g.beginPath(); g.ellipse(-r * .1, -r * 1.7, r * .8, r * .3, -0.2, 0, TAU); g.fill(); }
        break;
      }
      case 'lava': {
        glow(g, 0, -r * .6, r * 2.4, 'rgba(255,100,20,.4)');
        for (let i = 0; i < 4; i++) { const x = (i - 1.5) * r * .55, hgt = r * (1.6 + R() * 1.6); poly(g, [[x - r * .4, 0], [x - r * .2, -hgt * .8], [x + R() * 6, -hgt], [x + r * .3, -hgt * .7], [x + r * .45, 0]], lin(g, x - r, 0, x + r, -hgt, [[0, '#1c1214'], [1, '#4a3030']]), '#0d0809', 1.5); }
        g.strokeStyle = '#ff7a20'; g.shadowColor = '#ff5a00'; g.shadowBlur = 10; g.lineWidth = 2;
        for (let i = 0; i < 5; i++) { g.beginPath(); const x = (R() - .5) * r * 1.6; g.moveTo(x, -2); g.lineTo(x + (R() - .5) * 10, -r * .8); g.lineTo(x + (R() - .5) * 12, -r * 1.4); g.stroke(); }
        g.shadowBlur = 0; break;
      }
      case 'crystal': {
        glow(g, 0, -r, r * 2.6, 'rgba(120,210,255,.35)');
        const cs = [[-r * .8, .8, -.15], [r * .7, .9, .12], [0, 1.5, 0], [-r * .2, 1.05, -.3], [r * .2, 1.1, .35]];
        for (const [x, hh, tilt] of cs.slice().sort((a, b) => a[1] - b[1])) {
          const hgt = r * 2.2 * hh, w = r * .5; g.save(); g.translate(x, 0); g.rotate(tilt);
          poly(g, [[-w, 0], [-w * .9, -hgt * .78], [0, -hgt], [w * .9, -hgt * .78], [w, 0]], lin(g, -w, 0, w, -hgt, [[0, 'rgba(90,170,230,.95)'], [0.5, 'rgba(170,235,255,.95)'], [1, 'rgba(230,250,255,.95)']]), 'rgba(255,255,255,.7)', 1.5);
          g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(-w * .5, -hgt * .15); g.lineTo(-w * .4, -hgt * .7); g.lineTo(-w * .15, -hgt * .75); g.lineTo(-w * .2, -hgt * .15); g.fill();
          g.restore();
        }
        break;
      }
      case 'deadtree': {
        g.strokeStyle = '#3a3430'; g.lineCap = 'round';
        const branch = (x, y, a, len, wd, d) => { const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (R() - .5) * 8, (y + y2) / 2, x2, y2); g.stroke(); if (d > 0) { branch(x2, y2, a - 0.5 - R() * 0.4, len * .7, wd * .65, d - 1); branch(x2, y2, a + 0.5 + R() * 0.4, len * .7, wd * .65, d - 1); } };
        branch(0, 0, -Math.PI / 2 + (v - 1.5) * 0.08, r * 2.4, r * .6, 3);
        g.strokeStyle = 'rgba(110,160,90,.7)'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = (R() - .5) * r * 3, y = -r * (2 + R() * 2); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3, y + 10, x - 2, y + 18 + R() * 14); g.stroke(); }
        break;
      }
      case 'mushroom': {
        glow(g, 0, -r * 1.6, r * 2.4, v % 2 ? 'rgba(120,255,200,.3)' : 'rgba(200,120,255,.3)');
        g.fillStyle = lin(g, -r * .3, 0, r * .3, 0, [[0, '#cbbfa0'], [1, '#8a7e62']]); g.beginPath(); g.moveTo(-r * .35, 0); g.quadraticCurveTo(-r * .2, -r, -r * .25, -r * 1.7); g.lineTo(r * .25, -r * 1.7); g.quadraticCurveTo(r * .2, -r, r * .35, 0); g.fill();
        const hue = v % 2 ? 165 : 285;
        g.fillStyle = rad(g, -r * .3, -r * 2.2, 2, r * 1.5, [[0, hsl(hue, 70, 62)], [1, hsl(hue, 60, 28)]]);
        g.beginPath(); g.moveTo(-r * 1.5, -r * 1.6); g.quadraticCurveTo(-r * 1.4, -r * 3.2, 0, -r * 3.2); g.quadraticCurveTo(r * 1.4, -r * 3.2, r * 1.5, -r * 1.6); g.quadraticCurveTo(0, -r * 1.3, -r * 1.5, -r * 1.6); g.fill();
        g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc((R() - .5) * r * 2, -r * (1.9 + R() * 1), 2 + R() * 3, 0, TAU); g.fill(); }
        break;
      }
      case 'pillar': {
        const hgt = r * 4.4;
        g.fillStyle = lin(g, -r, 0, r, 0, [[0, '#6c6558'], [0.35, '#c4baa4'], [1, '#6a6254']]);
        g.fillRect(-r * 1.15, -r * .5, r * 2.3, r * .5); g.fillRect(-r * .95, -hgt, r * 1.9, hgt - r * .5);
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * r * .36, -r * .6); g.lineTo(i * r * .36, -hgt + 8); g.stroke(); }
        if (v === 1) { g.fillStyle = '#7a7366'; poly(g, [[-r * 1, -hgt], [-r * .4, -hgt - 14], [0, -hgt - 4], [r * .5, -hgt - 18], [r, -hgt]], '#aaa08a', 'rgba(0,0,0,.4)', 1); }
        else { g.fillStyle = lin(g, 0, -hgt - 12, 0, -hgt, [[0, '#d8cfb8'], [1, '#8b836f']]); g.fillRect(-r * 1.3, -hgt - 12, r * 2.6, 14); g.fillRect(-r * 1.1, -hgt - 18, r * 2.2, 8); }
        if (v === 2) { g.strokeStyle = '#3f7a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-r, 0); for (let i = 1; i < 8; i++) g.lineTo((i % 2 ? r : -r) * 0.9, -i * r * .5); g.stroke(); }
        break;
      }
    }
  }
  function obstacleSprite(o) {
    const key = o.type + o.v + o.z + o.r;
    let s = spriteCache.get(key);
    if (!s) {
      const w = Math.ceil(o.r * 6 + 40), h = Math.ceil(o.r * 7 + 60), c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.translate(w / 2, h - 24); drawObstacle(g, { ...o, x: 0, y: 0 });
      s = { c, ox: w / 2, oy: h - 24 }; spriteCache.set(key, s);
    }
    return s;
  }

  // ───────── armes ─────────
  function weapon(g, kind, rar, a, sw, t, pull) {
    const rc = RC[rar || 0];
    g.save(); g.rotate(a);
    const hot = rar >= 2;
    if (kind === 'sword') {
      g.fillStyle = '#5a3d22'; g.fillRect(-6, -2, 10, 4);
      g.fillStyle = '#c9a34a'; g.fillRect(4, -7, 4, 14); g.beginPath(); g.arc(-7, 0, 3, 0, TAU); g.fill();
      if (hot) { g.shadowColor = rc; g.shadowBlur = 12; }
      poly(g, [[8, -3.2], [40, -2], [47, 0], [40, 2], [8, 3.2]], lin(g, 8, -3, 8, 3, [[0, '#f4f8ff'], [0.5, '#c4cfdd'], [1, '#8a97aa']]), rc, 1);
      g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(10, 0); g.lineTo(42, 0); g.stroke();
    } else if (kind === 'axe') {
      g.fillStyle = '#6b4a2a'; g.fillRect(-8, -2, 42, 4);
      if (hot) { g.shadowColor = rc; g.shadowBlur = 12; }
      poly(g, [[26, 0], [30, -16], [42, -20], [38, -6], [38, 6], [42, 20], [30, 16]], lin(g, 26, -20, 42, 20, [[0, '#dfe6ee'], [0.5, '#9aa6b6'], [1, '#6a7688']]), rc, 1.5);
      g.shadowBlur = 0;
    } else if (kind === 'spear') {
      g.fillStyle = '#7a5530'; g.fillRect(-14, -1.8, 64, 3.6);
      g.fillStyle = '#b02a2a'; g.beginPath(); g.moveTo(44, 0); g.quadraticCurveTo(46, 8, 40, 11); g.lineTo(44, 1); g.fill();
      if (hot) { g.shadowColor = rc; g.shadowBlur = 12; }
      poly(g, [[50, -5], [66, 0], [50, 5], [54, 0]], lin(g, 50, -5, 66, 5, [[0, '#f4f8ff'], [1, '#8a97aa']]), rc, 1); g.shadowBlur = 0;
    } else if (kind === 'staff') {
      g.fillStyle = '#5a3a62'; g.fillRect(-12, -2, 52, 4);
      g.fillStyle = '#c9a34a'; g.fillRect(36, -4, 4, 8);
      const pulse = 1 + 0.15 * Math.sin(t * 6);
      glow(g, 46, 0, 20 * pulse, rc === '#b8c0cc' ? 'rgba(120,200,255,.8)' : rc);
      g.fillStyle = rad(g, 45, -2, 1, 7, [[0, '#fff'], [0.4, rc === '#b8c0cc' ? '#7fd0ff' : rc], [1, '#2a3a8a']]); g.beginPath(); g.arc(46, 0, 6.5, 0, TAU); g.fill();
    } else if (kind === 'bow') {
      const px = pull ? 3 : 10;
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(16, -26); g.quadraticCurveTo(30, 0, 16, 26); g.stroke();
      if (hot) { g.strokeStyle = rc; g.lineWidth = 1.2; g.shadowColor = rc; g.shadowBlur = 8; g.beginPath(); g.moveTo(16, -26); g.quadraticCurveTo(30, 0, 16, 26); g.stroke(); g.shadowBlur = 0; }
      g.strokeStyle = '#e8e0cc'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, -26); g.lineTo(px, 0); g.lineTo(16, 26); g.stroke();
      if (pull) { g.strokeStyle = '#d8d0bc'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, 0); g.lineTo(34, 0); g.stroke(); poly(g, [[34, -3], [40, 0], [34, 3]], '#cfd6e0'); }
    }
    g.restore();
  }

  // ───────── héros ─────────
  function hero(g, e, t) {
    const a = e.a, face = Math.cos(a) >= 0 ? 1 : -1, hue = e.u, cls = e.c;
    const eq = e.e || [-1, -1, -1, -1, 0];
    const mv = e.mv, wk = e.walk || 0;
    const bob = mv ? Math.abs(Math.sin(wk)) * 2.6 : Math.sin(t * 2 + (e.id || 0)) * 0.8;
    const f = e.f || 0;
    g.save(); g.translate(e.x, e.y);
    g.scale(1.22, 1.22); shadow(g, 17, 6.5);
    if (f & 4) g.globalAlpha = 0.55 + 0.3 * Math.sin(t * 30);
    if (eq[3] >= 3) { glow(g, 0, -26, 54 + Math.sin(t * 3) * 4, hsl(0, 0, 100, 0) && (eq[3] === 3 ? 'rgba(255,176,46,.28)' : 'rgba(255,77,109,.3)')); }
    const ay = Math.sin(a) * 0.75, ax = Math.cos(a), wa = Math.atan2(ay, ax);
    const shX = face * 9, shY = -35 - bob * .5;
    const behind = Math.sin(a) < -0.35;
    // animation de l'attaque (0..1)
    const sw = e.sw > 0 ? 1 - e.sw / 0.28 : -1;
    const drawWeapon = () => {
      let ang = wa, hx = shX + Math.cos(wa) * 13, hy = shY + 5 + Math.sin(wa) * 8, pull = false;
      const k = e.w || 'sword';
      if (sw >= 0) {
        if (k === 'sword' || k === 'axe') ang = wa + (sw * 2 - 1) * 1.25 * face * (face > 0 ? 1 : 1);
        else if (k === 'spear') { const th = Math.sin(sw * Math.PI) * 14; hx += Math.cos(wa) * th; hy += Math.sin(wa) * th * .6; }
        else if (k === 'bow') pull = sw < 0.5;
        else if (k === 'staff') ang = wa - Math.sin(sw * Math.PI) * 0.4;
      } else if (k === 'bow' && e.chg) pull = true;
      g.strokeStyle = cls === 'mage' ? hsl(hue, 50, 40) : '#7a5a44'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(shX, shY + 3); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = '#e8c4a0'; g.beginPath(); g.arc(hx, hy, 3.4, 0, TAU); g.fill();
      g.save(); g.translate(hx, hy); weapon(g, k, eq[4], ang, sw, t, pull); g.restore();
    };
    if (behind) drawWeapon();
    g.save(); g.scale(face, 1);
    // cape
    if (cls !== 'mage') {
      const sway = mv ? Math.sin(wk * 1) * 3 : Math.sin(t * 2) * 1.5;
      g.fillStyle = hsl(hue, 55, cls === 'ranger' ? 28 : 36); g.beginPath(); g.moveTo(-8, -38 - bob); g.quadraticCurveTo(-22 - sway, -22, -16 - sway * 1.4, -5); g.lineTo(-3, -10); g.lineTo(2, -36 - bob); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.stroke();
    }
    // jambes
    const bootC = eq[2] >= 0 ? RC[eq[2]] : '#5a3d2a';
    for (const side of [-1, 1]) {
      const sp = mv ? Math.sin(wk + (side > 0 ? 0 : Math.PI)) * 5 : 0;
      g.fillStyle = cls === 'mage' ? hsl(hue, 30, 22) : '#3a3f55'; g.fillRect(side * 5 - 3, -14 + (mv ? Math.max(0, -sp) * 0.3 : 0), 6, 12 - (mv ? Math.max(0, sp) * 0.3 : 0));
      g.fillStyle = bootC; g.beginPath(); g.roundRect(side * 5 - 4 + sp * 0.5, -5 - (mv ? Math.max(0, -sp) * .6 : 0), 9, 7, 2); g.fill();
      if (eq[2] >= 0) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(side * 5 - 3 + sp * 0.5, -5 - (mv ? Math.max(0, -sp) * .6 : 0), 7, 1.5); }
    }
    // torse
    const armC = eq[1] >= 0 ? RC[eq[1]] : null;
    const torsoCol = cls === 'warrior' ? lin(g, -12, -38, 12, -12, [[0, '#a8b4c8'], [0.5, '#7a889e'], [1, '#56627a']]) : cls === 'mage' ? lin(g, -12, -38, 12, -4, [[0, hsl(hue, 60, 52)], [1, hsl(hue, 60, 28)]]) : lin(g, -12, -38, 12, -12, [[0, '#7a5a3c'], [1, '#4a3424']]);
    g.beginPath(); g.moveTo(-12, -36 - bob); g.quadraticCurveTo(0, -40 - bob, 12, -36 - bob); g.lineTo(cls === 'mage' ? 15 : 9, cls === 'mage' ? -2 : -12); g.lineTo(cls === 'mage' ? -15 : -9, cls === 'mage' ? -2 : -12); g.closePath();
    g.fillStyle = torsoCol; g.fill(); g.strokeStyle = armC || 'rgba(0,0,0,.4)'; g.lineWidth = armC ? 2 : 1.2; g.stroke();
    if (cls === 'warrior') { g.fillStyle = hsl(hue, 60, 40); g.beginPath(); g.moveTo(-5, -34); g.lineTo(5, -34); g.lineTo(4, -10); g.lineTo(0, -6); g.lineTo(-4, -10); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-9, -33 - bob, 4, 18); }
    if (cls === 'ranger') { g.strokeStyle = '#2a1c10'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -36); g.lineTo(9, -15); g.stroke(); g.fillStyle = '#c9a34a'; g.beginPath(); g.arc(-1, -26, 2, 0, TAU); g.fill(); }
    if (cls === 'mage') { g.strokeStyle = '#ffd98a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -4); g.lineTo(14, -4); g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-9, -34 - bob, 3, 26); }
    g.fillStyle = '#3a2a1a'; g.fillRect(-9, -15, 18, 3.5); g.fillStyle = armC || '#c9a34a'; g.fillRect(-2, -15.5, 4, 4.5);
    if (cls === 'warrior') for (const s of [-1, 1]) { g.fillStyle = lin(g, s * 14, -42, s * 8, -30, [[0, '#d4dce8'], [1, '#6c7890']]); g.beginPath(); g.arc(s * 12.5, -35 - bob * .5, 6.5, 0, TAU); g.fill(); g.strokeStyle = armC || 'rgba(0,0,0,.4)'; g.lineWidth = 1.6; g.stroke(); }
    // accessoire
    if (eq[3] >= 0) { glow(g, 0, -29 - bob, 12, RC[eq[3]] + 'aa'); g.fillStyle = RC[eq[3]]; g.beginPath(); g.arc(0, -29 - bob, 3, 0, TAU); g.fill(); g.strokeStyle = '#fff8'; g.lineWidth = .8; g.stroke(); }
    // tête
    const hy = -47 - bob;
    // cheveux arrière + oreille
    if (cls !== 'ranger') { g.fillStyle = hsl((hue + 20) % 360, 35, 22); g.beginPath(); g.ellipse(-4, hy + 1, 8, 10, 0.2, 0, TAU); g.fill(); }
    g.fillStyle = rad(g, -2, hy - 4, 1, 12, [[0, '#fbdcbc'], [0.7, '#ecc7a2'], [1, '#c99a78']]); g.beginPath(); g.arc(1, hy, 10, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,20,20,.55)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#d9ab88'; g.beginPath(); g.ellipse(-8, hy + 1, 2, 3, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,120,110,.28)'; g.beginPath(); g.ellipse(7, hy + 3, 2.6, 1.6, 0, 0, TAU); g.fill();
    for (const [ex, er] of [[5.5, 2.3], [-0.5, 2]]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, hy - 1, er, er * 1.25, 0, 0, TAU); g.fill(); g.fillStyle = hsl((hue + 180) % 360, 70, 38); g.beginPath(); g.arc(ex + 0.8, hy - 0.8, er * 0.72, 0, TAU); g.fill(); g.fillStyle = '#10101a'; g.beginPath(); g.arc(ex + 0.9, hy - 0.8, er * 0.38, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(ex + 0.2, hy - 2, 1, 1); }
    g.strokeStyle = '#3a2418'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(3.4, hy - 4.6); g.lineTo(8, hy - 4); g.moveTo(-2.6, hy - 4); g.lineTo(1.6, hy - 4.5); g.stroke();
    g.strokeStyle = '#a05a4a'; g.lineWidth = 1.1; g.beginPath(); g.arc(3.5, hy + 4.4, 2, 0.3, 2.8); g.stroke();
    // accessoire dorsal selon la classe
    if (cls === 'ranger') { g.fillStyle = '#5a3a22'; g.beginPath(); g.roundRect(-16, -42 - bob, 7, 22, 2); g.fill(); g.strokeStyle = '#2a1a10'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#d8d0bc'; for (let i = 0; i < 3; i++) { g.fillRect(-15 + i * 2, -48 - bob - i, 1.4, 7); } g.fillStyle = '#c04040'; for (let i = 0; i < 3; i++) g.fillRect(-15 + i * 2, -50 - bob - i, 1.4, 3); }
    if (cls === 'warrior') { g.fillStyle = lin(g, -22, -40, -10, -14, [[0, hsl(hue, 50, 46)], [1, hsl(hue, 55, 26)]]); g.beginPath(); g.moveTo(-23, -38 - bob); g.lineTo(-11, -38 - bob); g.lineTo(-12, -22 - bob); g.lineTo(-17, -14 - bob); g.lineTo(-22, -22 - bob); g.closePath(); g.fill(); g.strokeStyle = '#c9a34a'; g.lineWidth = 1.5; g.stroke(); }
    // reflet de bord (lumière)
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(1, hy, 9, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    const hc = eq[0] >= 0 ? RC[eq[0]] : null;
    if (cls === 'warrior') {
      if (eq[0] >= 0) { g.fillStyle = lin(g, -10, hy - 12, 10, hy, [[0, '#cfd8e6'], [1, '#6c7890']]); g.beginPath(); g.arc(1, hy - 1, 11.5, Math.PI, TAU); g.lineTo(12, hy + 3); g.lineTo(-10, hy + 3); g.fill(); g.strokeStyle = hc; g.lineWidth = 2; g.stroke(); g.fillStyle = hc; g.beginPath(); g.moveTo(-2, hy - 12); g.quadraticCurveTo(1, hy - 24, 8 + Math.sin(t * 5) * 1.5, hy - 14); g.lineTo(5, hy - 11); g.fill(); g.fillStyle = '#222'; g.fillRect(2, hy - 2, 9, 3); }
      else { g.fillStyle = '#6a4a2a'; g.beginPath(); g.arc(1, hy - 3, 10.5, Math.PI * 1.05, TAU * 0.98); g.fill(); g.fillStyle = hsl(hue, 70, 45); g.fillRect(-9, hy - 6, 20, 3.5); }
    } else if (cls === 'mage') {
      g.fillStyle = lin(g, -12, hy - 6, 14, hy - 6, [[0, hsl(hue, 55, 34)], [1, hsl(hue, 55, 50)]]);
      g.beginPath(); g.ellipse(1, hy - 6, 15, 4.5, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-8, hy - 7); g.quadraticCurveTo(-2, hy - 22, 6 + Math.sin(t * 2) * 3, hy - 30); g.quadraticCurveTo(7, hy - 18, 10, hy - 7); g.fill();
      g.strokeStyle = hc || '#ffd98a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-8, hy - 7); g.lineTo(10, hy - 7); g.stroke();
      if (hc) { g.fillStyle = hc; g.beginPath(); g.arc(1, hy - 9, 2.6, 0, TAU); g.fill(); }
      g.fillStyle = '#d8d8e8'; g.beginPath(); g.moveTo(-4, hy + 4); g.quadraticCurveTo(2, hy + 16, 8, hy + 4); g.fill();
    } else {
      g.fillStyle = hsl(hue, 45, 26); g.beginPath(); g.arc(1, hy - 1, 12, Math.PI * 0.95, TAU * 1.02); g.lineTo(11, hy + 5); g.quadraticCurveTo(1, hy + 9, -9, hy + 5); g.fill();
      g.fillStyle = '#ecc7a2'; g.beginPath(); g.ellipse(3, hy + 1, 7, 6.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#2a2030'; g.beginPath(); g.arc(5, hy, 1.6, 0, TAU); g.fill(); g.beginPath(); g.arc(0, hy, 1.3, 0, TAU); g.fill();
      if (hc) { g.strokeStyle = hc; g.lineWidth = 2.2; g.beginPath(); g.arc(1, hy - 1, 12, Math.PI * 1.05, TAU * 0.98); g.stroke(); g.fillStyle = hc; g.beginPath(); g.moveTo(6, hy - 10); g.lineTo(18, hy - 16); g.lineTo(8, hy - 5); g.fill(); }
    }
    g.restore();
    if (!behind) drawWeapon();
    // états
    if (f & 1) { const pulse = 1 + 0.04 * Math.sin(t * 8); g.fillStyle = rad(g, 0, -28, 8, 34 * pulse, [[0, 'rgba(120,200,255,.05)'], [0.85, 'rgba(120,200,255,.22)'], [1, 'rgba(180,235,255,.7)']]); g.beginPath(); g.arc(0, -28, 34 * pulse, 0, TAU); g.fill(); }
    if (f & 2) for (let i = 0; i < 4; i++) { const ph = (t * 2.2 + i * 0.25) % 1; g.fillStyle = `rgba(255,${120 + i * 30},30,${1 - ph})`; g.beginPath(); g.ellipse(-10 + i * 7, -10 - ph * 40, 3.5 * (1 - ph) + 1, 6 * (1 - ph) + 1, 0, 0, TAU); g.fill(); }
    if (f & 16) for (let i = 0; i < 3; i++) { const aa = t * 4 + i * 2.1; g.fillStyle = '#ffe36a'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('★', Math.cos(aa) * 14, -64 + Math.sin(aa) * 4); }
    if (f & 32) for (let i = 0; i < 3; i++) { const ph = (t * 1.5 + i / 3) % 1; g.fillStyle = `rgba(110,255,150,${1 - ph})`; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('+', -12 + i * 12, -20 - ph * 40); }
    g.restore();
  }

  // ───────── monstres ─────────
  function monster(g, m, t) {
    const face = Math.cos(m.a) >= 0 ? 1 : -1, id = m.id, p = m.p || 0, s = m.s;
    g.save(); g.translate(m.x, m.y);
    const fn = M[m.k]; if (fn) fn(g, m, t, face, id, p, s);
    if (m.bn) for (let i = 0; i < 3; i++) { const ph = (t * 2 + i * .33) % 1; g.fillStyle = `rgba(255,${130 + i * 30},30,${1 - ph})`; g.beginPath(); g.ellipse(-8 + i * 8, -14 - ph * 30, 3, 5, 0, 0, TAU); g.fill(); }
    if (m.st) for (let i = 0; i < 3; i++) { const aa = t * 4 + i * 2.1; g.fillStyle = '#ffe36a'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('★', Math.cos(aa) * 14, -(m.hh || 50) - 6 + Math.sin(aa) * 4); }
    g.restore();
  }
  const M = {
    slime(g, m, t, face, id, p, s) {
      const sq = 1 + 0.09 * Math.sin(t * 5 + id), hop = s === 'swing' ? Math.sin(p * Math.PI) : 0;
      const hue = [118, 175, 285][id % 3]; m.hh = 34;
      shadow(g, 21 - hop * 4, 7);
      g.save(); g.translate(0, -hop * 14); g.scale(1 + (s === 'swing' ? (p < .6 ? .18 * p : -.1) : 0), sq - (s === 'swing' && p < 0.6 ? .25 * p : 0));
      g.beginPath(); g.moveTo(-20, 0); g.bezierCurveTo(-24, -24, -10, -34, 0, -34); g.bezierCurveTo(10, -34, 24, -24, 20, 0); g.quadraticCurveTo(0, 6, -20, 0);
      g.fillStyle = rad(g, -6, -22, 3, 30, [[0, hsl(hue, 75, 68, .95)], [0.6, hsl(hue, 70, 46, .92)], [1, hsl(hue, 70, 28, .95)]]); g.fill(); g.strokeStyle = hsl(hue, 70, 22); g.lineWidth = 2; g.stroke();
      g.fillStyle = hsl(hue, 60, 30, .55); g.beginPath(); g.arc(4, -10, 7, 0, TAU); g.fill(); g.beginPath(); g.arc(-8, -6, 3.5, 0, TAU); g.fill(); g.beginPath(); g.arc(9, -17, 2.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.ellipse(-9, -26, 6, 3.2, -0.5, 0, TAU); g.fill();
      const ex = face * 4; for (const dx of [-6, 7]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(dx + ex, -19, 4.2, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(dx + ex + face * 1.4, -18.5, 2, 0, TAU); g.fill(); }
      g.strokeStyle = hsl(hue, 70, 18); g.lineWidth = 1.5; g.beginPath(); g.arc(ex + 0.5, -10, 4, 0.2, Math.PI - 0.2); g.stroke();
      g.restore();
    },
    bat(g, m, t, face, id, p, s) {
      const fl = Math.sin(t * (s === 'wind' ? 8 : 20) + id), lift = 34 + Math.sin(t * 3 + id) * 4; m.hh = 52;
      shadow(g, 12, 4, 0.25);
      g.save(); g.translate(0, -lift);
      if (s === 'dive') g.rotate(Math.sin(m.a) * 0.5 * face);
      const spread = s === 'wind' ? 1.25 : 1;
      for (const sd of [-1, 1]) {
        g.save(); g.scale(sd, 1); const wy = -8 + fl * 16;
        g.fillStyle = lin(g, 0, 0, 34, 0, [[0, '#3a1f4a'], [1, '#6a3a7a']]);
        g.beginPath(); g.moveTo(3, -2); g.quadraticCurveTo(14 * spread, wy - 16, 38 * spread, wy - 6); g.quadraticCurveTo(30 * spread, wy + 2, 32 * spread, wy + 10); g.quadraticCurveTo(22 * spread, wy + 2, 20 * spread, wy + 12); g.quadraticCurveTo(12, wy + 2, 8, wy + 8); g.quadraticCurveTo(4, 4, 3, 4); g.fill();
        g.strokeStyle = '#1c0f26'; g.lineWidth = 1.2; g.stroke(); g.beginPath(); g.moveTo(3, -1); g.lineTo(36 * spread, wy - 5); g.moveTo(3, 0); g.lineTo(28 * spread, wy + 8); g.stroke();
        g.restore();
      }
      g.fillStyle = rad(g, -2, -4, 1, 12, [[0, '#6a4a7a'], [1, '#2a1a36']]); g.beginPath(); g.ellipse(0, 2, 8, 11, 0, 0, TAU); g.fill();
      g.fillStyle = '#2a1a36'; poly(g, [[-6, -8], [-9, -18], [-2, -10]]); poly(g, [[6, -8], [9, -18], [2, -10]], '#2a1a36');
      g.fillStyle = '#ff3030'; g.shadowColor = '#f00'; g.shadowBlur = s === 'wind' ? 10 : 4; g.beginPath(); g.arc(-3.5, -3, 2, 0, TAU); g.arc(3.5, -3, 2, 0, TAU); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#fff'; poly(g, [[-2.5, 3], [-1.5, 7], [-0.5, 3]], '#fff'); poly(g, [[0.5, 3], [1.5, 7], [2.5, 3]], '#fff');
      g.restore();
    },
    skeleton(g, m, t, face, id, p, s) {
      m.hh = 56; shadow(g, 15, 5.5);
      const wk = Math.sin(t * 6 + id) * 3, bone = '#e9e4d2', bd = '#8a846e';
      g.save(); g.scale(face, 1);
      g.strokeStyle = bone; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-4, -16); g.lineTo(-5 + wk * .4, -2); g.moveTo(4, -16); g.lineTo(5 - wk * .4, -2); g.stroke();
      g.fillStyle = bone; g.beginPath(); g.ellipse(0, -17, 8, 3.5, 0, 0, TAU); g.fill();
      g.strokeStyle = bone; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -18); g.lineTo(0, -38); g.stroke();
      g.fillStyle = 'rgba(30,26,20,.8)'; g.beginPath(); g.ellipse(0, -30, 9, 10, 0, 0, TAU); g.fill();
      g.strokeStyle = bone; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(0, -34 + i * 5, 9 - Math.abs(i - 1) * .8, 2.8, 0, 0, TAU); g.stroke(); }
      g.restore();
      // arc
      const aim = Math.atan2(Math.sin(m.a) * .75, Math.cos(m.a));
      g.strokeStyle = bone; g.lineWidth = 3; g.beginPath(); g.moveTo(face * 7, -37); g.lineTo(face * 7 + Math.cos(aim) * 12, -33 + Math.sin(aim) * 8); g.stroke();
      g.save(); g.translate(face * 7 + Math.cos(aim) * 12, -33 + Math.sin(aim) * 8); weapon(g, 'bow', 0, aim, 0, t, s === 'shoot'); g.restore();
      g.save(); g.scale(face, 1);
      g.fillStyle = bone; g.beginPath(); g.arc(1, -47, 9.5, 0, TAU); g.fill(); g.fillRect(-5, -42, 11, 6); g.strokeStyle = bd; g.lineWidth = 1; g.beginPath(); g.arc(1, -47, 9.5, 0, TAU); g.stroke();
      g.fillStyle = '#1a1620'; g.beginPath(); g.ellipse(4, -48, 3, 3.5, 0, 0, TAU); g.ellipse(-2, -48, 2.6, 3.2, 0, 0, TAU); g.fill();
      g.fillStyle = s === 'shoot' ? '#ff5a3a' : '#6ad0ff'; g.shadowColor = g.fillStyle; g.shadowBlur = 6; g.beginPath(); g.arc(4, -48, 1.3, 0, TAU); g.arc(-2, -48, 1.1, 0, TAU); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#1a1620'; for (let i = 0; i < 4; i++) g.fillRect(-3 + i * 3, -41, 1.5, 3);
      g.restore();
    },
    brute(g, m, t, face, id, p, s) {
      m.hh = 66; shadow(g, 24, 8);
      const charge = s === 'charge', wind = s === 'cwind', swing = s === 'swing', rec = s === 'recover';
      const wk = Math.sin(t * 7 + id) * 3;
      g.save(); g.scale(face, 1); if (charge) g.rotate(0.22); if (wind) g.translate(0, 4 * Math.sin(p * 3));
      g.fillStyle = '#4a3a2a'; g.fillRect(-10, -16, 8, 15); g.fillRect(2, -16, 8, 15);
      g.fillStyle = '#2a2018'; g.beginPath(); g.roundRect(-12 + wk * .3, -4, 11, 6, 2); g.roundRect(1 - wk * .3, -4, 11, 6, 2); g.fill();
      g.fillStyle = lin(g, -22, -50, 22, -16, [[0, '#6aa04a'], [1, '#3e6a2c']]);
      g.beginPath(); g.moveTo(-18, -48); g.quadraticCurveTo(0, -56, 18, -48); g.lineTo(14, -14); g.lineTo(-14, -14); g.fill(); g.strokeStyle = '#22401a'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#6a4a2a'; g.beginPath(); g.moveTo(-14, -46); g.lineTo(14, -46); g.lineTo(11, -18); g.lineTo(-11, -18); g.fill();
      g.fillStyle = '#c9a34a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-6 + i * 6, -40 + i * 0, 1.8, 0, TAU); g.fill(); g.beginPath(); g.arc(-6 + i * 6, -30, 1.8, 0, TAU); g.fill(); }
      g.fillStyle = '#5a8a3c'; g.beginPath(); g.arc(-20, -44, 8, 0, TAU); g.arc(20, -44, 8, 0, TAU); g.fill();
      g.fillStyle = lin(g, -10, -70, 10, -52, [[0, '#7ab456'], [1, '#4a7a34']]); g.beginPath(); g.ellipse(1, -60, 12, 11, 0, 0, TAU); g.fill(); g.strokeStyle = '#22401a'; g.stroke();
      g.fillStyle = wind ? '#ff3030' : '#ffd23a'; g.shadowColor = g.fillStyle; g.shadowBlur = wind ? 10 : 0; g.beginPath(); g.arc(5, -62, 2.2, 0, TAU); g.arc(-2, -62, 2, 0, TAU); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = '#2a1a10'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(1, -66); g.lineTo(8, -64); g.moveTo(-5, -65); g.lineTo(-1, -63); g.stroke();
      g.fillStyle = '#f4f0e0'; poly(g, [[6, -54], [9, -62], [11, -54]], '#f4f0e0'); poly(g, [[-5, -54], [-8, -61], [-9, -54]], '#f4f0e0');
      g.restore();
      const ang = swing ? (-1.2 + p * 2.4) * face - (face < 0 ? Math.PI : 0) + (face < 0 ? 0 : 0) : (rec ? 1.2 * face : (wind ? -0.9 : -0.3)) - (face < 0 ? Math.PI : 0) + (face < 0 ? Math.PI * 2 * 0 : 0);
      g.save(); g.translate(face * 22, -38); g.rotate(swing ? (face > 0 ? -1.3 + p * 2.6 : Math.PI + 1.3 - p * 2.6) : (face > 0 ? 0.5 : Math.PI - 0.5));
      g.fillStyle = '#6b4a2a'; g.fillRect(-4, -3, 40, 6); g.fillStyle = '#5a3a1e'; g.beginPath(); g.ellipse(40, 0, 11, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#b8b8c0'; for (let i = 0; i < 4; i++) { const aa = i * 1.57; poly(g, [[40 + Math.cos(aa) * 8, Math.sin(aa) * 8 - 2], [40 + Math.cos(aa) * 15, Math.sin(aa) * 15], [40 + Math.cos(aa) * 8, Math.sin(aa) * 8 + 2]], '#b8b8c0'); }
      g.restore();
    },
    wraith(g, m, t, face, id, p, s) {
      m.hh = 70; const fl = Math.sin(t * 2 + id) * 5; shadow(g, 18, 6, 0.2);
      let al = 1; if (s === 'blink') al = 1 - Math.sin(p * Math.PI) * 0.8;
      g.save(); g.globalAlpha = al; g.translate(0, -26 + fl);
      glow(g, 0, -10, 64 + Math.sin(t * 4) * 5, s === 'volley' ? 'rgba(200,120,255,.6)' : 'rgba(110,70,200,.38)');
      g.beginPath(); g.moveTo(-13, -26); g.quadraticCurveTo(-26, 8, -22, 30);
      for (let i = 0; i <= 6; i++) g.lineTo(-22 + i * 7.3, 30 + (i % 2 ? 11 : -2) + Math.sin(t * 5 + i) * 4);
      g.quadraticCurveTo(26, 8, 13, -26); g.quadraticCurveTo(0, -36, -13, -26);
      g.fillStyle = lin(g, 0, -34, 0, 42, [[0, '#2a1f52'], [0.6, 'rgba(60,40,120,.85)'], [1, 'rgba(60,40,120,0)']]); g.fill();
      g.strokeStyle = 'rgba(160,130,255,.5)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#0a0614'; g.beginPath(); g.ellipse(0, -23, 9, 10, 0, 0, TAU); g.fill();
      g.fillStyle = '#7af0ff'; g.shadowColor = '#7af0ff'; g.shadowBlur = 10; g.beginPath(); g.ellipse(face * 3 - 3, -24, 2.2, 3.4, 0, 0, TAU); g.ellipse(face * 3 + 4, -24, 2.2, 3.4, 0, 0, TAU); g.fill(); g.shadowBlur = 0;
      const aim = Math.atan2(Math.sin(m.a) * .75, Math.cos(m.a)), lift = s === 'volley' ? Math.sin(p * Math.PI) * 10 : 0;
      for (const sd of [-1, 1]) { const hx = Math.cos(aim) * 22 + sd * 10, hy = -6 + Math.sin(aim) * 12 - lift; g.strokeStyle = 'rgba(90,60,170,.9)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(sd * 10, -14); g.lineTo(hx, hy); g.stroke(); glow(g, hx, hy, 14, 'rgba(140,255,255,.8)'); g.fillStyle = '#c8ffff'; g.beginPath(); g.arc(hx, hy, 3, 0, TAU); g.fill(); }
      g.restore();
    },
    ogre(g, m, t, face, id, p, s) {
      m.hh = 84; shadow(g, 30, 10); const slam = s === 'slam', thr = s === 'throw'; const wk = Math.sin(t * 5 + id) * 3;
      g.save(); g.scale(face * 1.15, 1.15);
      g.fillStyle = '#7a5a40'; g.fillRect(-13, -20, 11, 19); g.fillRect(2, -20, 11, 19);
      g.fillStyle = '#3a2a20'; g.beginPath(); g.roundRect(-15 + wk * .3, -4, 14, 7, 2); g.roundRect(1 - wk * .3, -4, 14, 7, 2); g.fill();
      g.fillStyle = lin(g, -26, -60, 26, -18, [[0, '#d6a878'], [1, '#a5764c']]); g.beginPath(); g.moveTo(-24, -54); g.quadraticCurveTo(0, -66, 24, -54); g.quadraticCurveTo(30, -34, 20, -16); g.lineTo(-20, -16); g.quadraticCurveTo(-30, -34, -24, -54); g.fill(); g.strokeStyle = '#6a4228'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#6a4a2a'; g.beginPath(); g.moveTo(-20, -22); g.lineTo(20, -22); g.lineTo(16, -8); g.lineTo(-16, -8); g.fill();
      g.strokeStyle = '#8a8a96'; g.lineWidth = 3; g.beginPath(); g.moveTo(-22, -54); g.quadraticCurveTo(0, -36, 22, -54); g.stroke();
      g.fillStyle = '#c99a6a'; g.beginPath(); g.arc(-26, -52, 10, 0, TAU); g.arc(26, -52, 10, 0, TAU); g.fill();
      g.fillStyle = '#d6a878'; g.beginPath(); g.ellipse(1, -70, 12, 11, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#4a2a1a'; g.beginPath(); g.moveTo(-10, -73); g.lineTo(12, -73); g.lineTo(10, -76); g.lineTo(-8, -76); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(5, -70, 3.2, 0, TAU); g.arc(-3, -70, 3, 0, TAU); g.fill(); g.fillStyle = slam ? '#f00' : '#a01010'; g.beginPath(); g.arc(6, -70, 1.6, 0, TAU); g.arc(-2, -70, 1.5, 0, TAU); g.fill();
      g.fillStyle = '#f4f0e0'; poly(g, [[-4, -63], [-6, -69], [-1, -63]], '#f4f0e0'); poly(g, [[7, -63], [9, -69], [10, -62]], '#f4f0e0');
      g.restore();
      let ang; if (slam) ang = -2.2 + Math.sin(p * Math.PI * .5) * (p > .75 ? 3.4 : -0.0) - (p < .75 ? 0 : 0); else ang = 0.6;
      const raise = slam ? (p < 0.8 ? -1.9 - p * .2 : -1.9 + (p - 0.8) / 0.2 * 3.6) : thr ? -1.6 : 0.7;
      g.save(); g.translate(face * 30, -50); g.scale(face, 1); g.rotate(raise);
      g.fillStyle = '#6b4a2a'; g.fillRect(-4, -4, 52, 8); g.fillStyle = '#5a3a1e'; g.beginPath(); g.ellipse(52, 0, 14, 12, 0, 0, TAU); g.fill();
      g.fillStyle = '#9a9aa6'; for (let i = 0; i < 5; i++) { const aa = i * 1.26; poly(g, [[52 + Math.cos(aa) * 10, Math.sin(aa) * 10 - 2], [52 + Math.cos(aa) * 19, Math.sin(aa) * 19], [52 + Math.cos(aa) * 10, Math.sin(aa) * 10 + 2]], '#9a9aa6'); }
      g.restore();
      if (thr) { g.fillStyle = rad(g, 0, -108, 2, 16, [[0, '#9a9488'], [1, '#5a5448']]); g.beginPath(); g.arc(0, -108, 16, 0, TAU); g.fill(); }
    },
    golem(g, m, t, face, id, p, s) {
      m.hh = 130; shadow(g, 52, 16, 0.4);
      const slam = s === 'slam', rain = s === 'rain', lift = slam ? (p < .8 ? p / .8 : 1 - (p - .8) / .2 * 1.2) : rain ? Math.sin(p * Math.PI) : 0;
      const wk = Math.sin(t * 3) * 2, br = Math.sin(t * 1.6) * 1.5;
      g.save(); g.scale(1.55, 1.55);
      const stone = (x, y, w, h, c1, c2) => { g.fillStyle = lin(g, x, y, x + w, y + h, [[0, c1], [1, c2]]); g.beginPath(); g.roundRect(x, y, w, h, 4); g.fill(); g.strokeStyle = '#25272e'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 2, y + 2, w - 4, 3); };
      stone(-16, -22, 13, 22, '#8a8f9c', '#555a66'); stone(3, -22, 13, 22, '#8a8f9c', '#555a66');
      stone(-22, -66 + br, 44, 48, '#9aa0ae', '#5c616e');
      g.strokeStyle = '#ff8a2a'; g.shadowColor = '#ff6a00'; g.shadowBlur = 10; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -50); g.lineTo(-6, -42); g.lineTo(-10, -34); g.moveTo(10, -56); g.lineTo(4, -46); g.lineTo(12, -38); g.stroke();
      g.fillStyle = rad(g, 0, -42, 1, 12, [[0, '#fff2b0'], [0.4, '#ff9a2a'], [1, 'rgba(255,90,0,0)']]); g.beginPath(); g.arc(0, -42, 12, 0, TAU); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#4a7a3a'; g.beginPath(); g.ellipse(-14, -64, 8, 3, 0, 0, TAU); g.ellipse(12, -30, 6, 2.5, 0, 0, TAU); g.fill();
      stone(-11, -86 + br, 22, 22, '#a8aebb', '#656b78');
      g.fillStyle = '#ffb02e'; for (let i = 0; i < 5; i++) poly(g, [[-11 + i * 5.5, -86 + br], [-8.5 + i * 5.5, -98 + br - (i % 2) * 4], [-6 + i * 5.5, -86 + br]], '#d8a02e', '#6a4a10', 1);
      g.fillStyle = '#ff9a2a'; g.shadowColor = '#ff7a00'; g.shadowBlur = 9; g.fillRect(-7, -78 + br, 5, 4); g.fillRect(2, -78 + br, 5, 4); g.shadowBlur = 0;
      for (const sd of [-1, 1]) { const ax = sd * 30, ay = -56 + br - lift * 26 + (slam && p > .8 ? 40 * (p - .8) / .2 : 0); stone(ax - 9, ay, 18, 30, '#8a90a0', '#4d525e'); stone(ax - 12, ay + 26 - (lift > .5 ? 0 : -4), 24, 22, '#9aa0ae', '#555a66'); }
      g.restore();
    },
    dragon(g, m, t, face, id, p, s) {
      m.hh = 150; shadow(g, 70, 20, 0.4);
      const breath = s === 'breath', ring = s === 'ring', fl = Math.sin(t * (ring ? 8 : 3.5));
      g.save(); g.scale(face * 1.7, 1.7);
      // ailes
      for (const sd of [0, 1]) { g.save(); g.translate(-6 + sd * 10, -50); g.rotate((-0.9 + fl * (.35 + (ring ? .4 : 0))) * (sd ? 0.8 : 1) - sd * 0.2);
        g.fillStyle = lin(g, 0, 0, -10, -64, [[0, '#8a2a1a'], [1, '#d85a30']]); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-18, -34, -50, -52); g.quadraticCurveTo(-34, -38, -36, -28); g.quadraticCurveTo(-24, -26, -22, -14); g.quadraticCurveTo(-12, -14, -8, -4); g.fill(); g.strokeStyle = '#3a0e08'; g.lineWidth = 1.6; g.stroke();
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-48, -50); g.moveTo(0, 0); g.lineTo(-34, -26); g.stroke(); g.restore(); }
      // queue
      g.strokeStyle = '#7a1a10'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-16, -24); g.quadraticCurveTo(-46, -10 + Math.sin(t * 2) * 6, -62, -26 + Math.sin(t * 2.4) * 8); g.stroke();
      poly(g, [[-62, -26 + Math.sin(t * 2.4) * 8], [-72, -32], [-66, -20]], '#d85a30');
      // pattes
      g.fillStyle = '#6a1a10'; g.fillRect(-14, -18, 9, 18); g.fillRect(6, -18, 9, 18); g.fillStyle = '#e8d8b8'; for (const x of [-14, 6]) for (let i = 0; i < 3; i++) poly(g, [[x + i * 3, 0], [x + i * 3 + 1.5, 4], [x + i * 3 + 3, 0]], '#e8d8b8');
      // corps
      g.fillStyle = lin(g, -26, -64, 26, -16, [[0, '#b83a22'], [0.6, '#8a2418'], [1, '#5a140e']]); g.beginPath(); g.ellipse(0, -36, 30, 24, -0.1, 0, TAU); g.fill(); g.strokeStyle = '#3a0e08'; g.lineWidth = 2; g.stroke();
      g.fillStyle = lin(g, 0, -48, 0, -14, [[0, '#f0b868'], [1, '#c8783a']]); g.beginPath(); g.ellipse(5, -30, 18, 15, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(80,20,10,.45)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(5, -42 + i * 6, 14 - i, 0.3, Math.PI - 0.3); g.stroke(); }
      for (let i = 0; i < 6; i++) poly(g, [[-20 + i * 7, -58 + Math.abs(i - 2.5) * 2], [-17 + i * 7, -67 + Math.abs(i - 2.5) * 2], [-14 + i * 7, -58 + Math.abs(i - 2.5) * 2]], '#d8c8a0', '#5a3a20', 1);
      // cou + tête
      const hx = 30, hy = breath ? -64 + Math.sin(p * 3) * 3 : -62;
      g.strokeStyle = '#a02e1c'; g.lineWidth = 14; g.beginPath(); g.moveTo(16, -48); g.quadraticCurveTo(26, -60, hx, hy); g.stroke();
      g.fillStyle = lin(g, hx - 12, hy - 10, hx + 18, hy + 10, [[0, '#c04226'], [1, '#7a1e12']]); g.beginPath(); g.ellipse(hx + 6, hy, 17, 11, 0.1, 0, TAU); g.fill(); g.strokeStyle = '#3a0e08'; g.lineWidth = 1.8; g.stroke();
      const jaw = breath ? 9 + Math.sin(p * Math.PI) * 4 : 3;
      g.fillStyle = '#7a1a10'; g.beginPath(); g.moveTo(hx + 2, hy + 4); g.lineTo(hx + 24, hy + 4 + jaw); g.lineTo(hx + 22, hy + 7 + jaw); g.lineTo(hx - 2, hy + 9); g.fill();
      if (breath || ring) { glow(g, hx + 20, hy + 4, 34 + p * 20, 'rgba(255,170,40,.95)'); }
      g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) poly(g, [[hx + 6 + i * 4, hy + 4], [hx + 7.5 + i * 4, hy + 9], [hx + 9 + i * 4, hy + 4]], '#fff');
      g.fillStyle = '#e8d8b8'; poly(g, [[hx - 2, hy - 8], [hx - 14, hy - 24], [hx + 2, hy - 12]], '#e8d8b8', '#5a3a20', 1); poly(g, [[hx + 6, hy - 9], [hx - 2, hy - 28], [hx + 10, hy - 11]], '#e8d8b8', '#5a3a20', 1);
      g.fillStyle = '#ffe24a'; g.shadowColor = '#ffb000'; g.shadowBlur = 8; g.beginPath(); g.ellipse(hx + 8, hy - 3, 3.4, 2.2, 0.3, 0, TAU); g.fill(); g.shadowBlur = 0; g.fillStyle = '#111'; g.fillRect(hx + 7.4, hy - 5, 1.4, 4);
      g.fillStyle = '#3a0e08'; g.beginPath(); g.arc(hx + 21, hy - 1, 1.4, 0, TAU); g.fill();
      g.restore();
    }
  };

  // ───────── projectiles, butins, zones ─────────
  function proj(g, q, t) {
    g.save(); g.translate(q.x, q.y - 22);
    if (q.k === 'arrow') { g.rotate(q.a); g.strokeStyle = '#d8cfb8'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-16, 0); g.lineTo(10, 0); g.stroke(); poly(g, [[10, -3.5], [18, 0], [10, 3.5]], '#e6ecf4'); g.fillStyle = '#c04040'; poly(g, [[-16, 0], [-21, -4], [-12, 0]], '#c04040'); poly(g, [[-16, 0], [-21, 4], [-12, 0]], '#c04040'); }
    else if (q.k === 'bolt') { glow(g, 0, 0, 30, 'rgba(110,190,255,.85)'); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.fillStyle = '#7fc8ff'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.globalAlpha = .5; g.fill(); }
    else if (q.k === 'fire') { const r = q.r * (1 + 0.12 * Math.sin(t * 25)); glow(g, 0, 0, r * 3.4, 'rgba(255,110,20,.9)'); g.fillStyle = rad(g, 0, 0, 1, r * 1.2, [[0, '#fffbe0'], [0.4, '#ffc040'], [1, '#e8420a']]); g.beginPath(); g.arc(0, 0, r * 1.15, 0, TAU); g.fill(); }
    else if (q.k === 'shadow') { glow(g, 0, 0, 30, 'rgba(170,90,255,.85)'); g.fillStyle = rad(g, 0, 0, 1, 12, [[0, '#f2d8ff'], [0.5, '#9a4aff'], [1, '#3a1a7a']]); g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); }
    else if (q.k === 'rock') { g.rotate(t * 6); g.fillStyle = rad(g, -4, -4, 2, 20, [[0, '#b0aa9c'], [1, '#524c40']]); poly(g, [[-16, -6], [-6, -17], [10, -14], [17, 0], [9, 15], [-8, 16], [-17, 6]], g.fillStyle, '#2a261e', 2); }
    g.restore();
  }
  function drop(g, d, t) {
    g.save(); g.translate(d.x, d.y);
    const bob = Math.sin(t * 3 + d.i) * 3;
    if (d.t === 'hp') { shadow(g, 9, 3.5, .25); glow(g, 0, -14 + bob, 24, 'rgba(255,70,90,.7)'); g.fillStyle = rad(g, -2, -16 + bob, 1, 10, [[0, '#ffb0b8'], [1, '#d01a30']]); g.beginPath(); g.arc(0, -14 + bob, 8, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillRect(-1.5, -19 + bob, 3, 10); g.fillRect(-5, -15.5 + bob, 10, 3); }
    else {
      const c = RC[d.r]; shadow(g, 13, 5, .3);
      if (d.r >= 2) { g.fillStyle = lin(g, 0, -90, 0, 0, [[0, 'rgba(255,255,255,0)'], [1, c + 'aa']]); g.fillRect(-5, -90, 10, 90); }
      glow(g, 0, -12 + bob, 34, c + 'aa');
      g.fillStyle = lin(g, -11, -22, 11, -2, [[0, '#8a5a30'], [1, '#4a2e18']]); g.beginPath(); g.roundRect(-11, -20 + bob, 22, 16, 3); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.stroke();
      g.fillStyle = c; g.fillRect(-2, -17 + bob, 4, 6); g.fillStyle = '#c9a34a'; g.fillRect(-11, -14 + bob, 22, 2.5);
      g.fillStyle = '#fff'; const sp = (t * 2 + d.i) % 1; g.globalAlpha = 1 - sp; g.fillRect(-10 + sp * 20, -26 + bob - sp * 8, 2, 2);
    }
    g.restore();
  }
  function hazard(g, h, t) {
    const pr = 1 - h.t / h.T, pulse = 0.5 + 0.5 * Math.sin(t * 14);
    g.save(); g.translate(h.x, h.y);
    const col = h.k === 'slam' ? '255,150,40' : '255,60,40';
    g.fillStyle = `rgba(${col},${0.1 + pr * 0.28})`; g.beginPath(); g.arc(0, 0, h.r, 0, TAU); g.fill();
    g.fillStyle = `rgba(${col},${0.2 + pr * 0.4})`; g.beginPath(); g.arc(0, 0, h.r * pr, 0, TAU); g.fill();
    g.strokeStyle = `rgba(255,${200 - pr * 120},60,${0.55 + pulse * 0.4})`; g.lineWidth = 3; g.setLineDash([10, 8]); g.lineDashOffset = -t * 30; g.beginPath(); g.arc(0, 0, h.r, 0, TAU); g.stroke(); g.setLineDash([]);
    if (h.k === 'meteor') { const fy = -(1 - pr) * 320; glow(g, 0, fy, 46, 'rgba(255,120,30,.85)'); g.fillStyle = rad(g, 0, fy, 1, 20, [[0, '#fff3b0'], [0.5, '#ff8a2a'], [1, '#7a1a08']]); g.beginPath(); g.arc(0, fy, 17, 0, TAU); g.fill(); }
    g.restore();
  }
  return { RC, hsl, glow, rng, buildBackground, obstacleSprite, hero, monster, proj, drop, hazard, weapon, shadow, rad, lin, TAU };
})();
