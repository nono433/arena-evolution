// Serveur HTTP (fichiers statiques + classement) et WebSocket.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Game } = require('./game');
const Acc = require('./accounts');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/api/leaderboard') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(Acc.top(30)));
  }
  let file = url === '/' ? '/public/index.html' : url.startsWith('/shared/') ? url : '/public' + url;
  file = path.normalize(path.join(ROOT, file));
  if (!file.startsWith(path.join(ROOT, 'public')) && !file.startsWith(path.join(ROOT, 'shared'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const game = new Game();
const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on('connection', ws => {
  let player = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (!player) {
      if (m.t !== 'login') return;
      const r = Acc.login(m.n, m.p, m.cls, m.hue);
      if (r.err) return ws.send(JSON.stringify({ t: 'loginerr', m: r.err }));
      player = game.addPlayer(ws, r.acc);
      return;
    }
    if (game.players.get(player.id) !== player) return;
    game.handle(player, m);
  });
  ws.on('close', () => { if (player && game.players.get(player.id) === player) game.removePlayer(player); });
  ws.on('error', () => { });
});

server.listen(PORT, () => console.log(`Arena Evolution — http://localhost:${PORT}`));
process.on('SIGINT', () => { Acc.save(); process.exit(0); });
