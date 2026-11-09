const WebSocket = require('ws');
const ws = new WebSocket(process.argv[2] || 'wss://arena-evolution.onrender.com');
const r = []; let snaps = 0, t0, gaps = [], last = 0;
ws.on('open', () => ws.send(JSON.stringify({ t: 'login', n: 'TestPersist', p: 'secret1' })));
ws.on('message', d => { const m = JSON.parse(d); const now = Date.now();
  if (m.t === 'welcome') { t0 = now; const iv = setInterval(() => ws.send(JSON.stringify({ t: 'ping', c: Date.now() })), 500); setTimeout(() => { clearInterval(iv); gaps.sort((a, b) => a - b); console.log('RTT ms:', r.join(','), '| snaps/10s', snaps, '| écart snap médian', gaps[gaps.length >> 1], 'max', gaps[gaps.length - 1]); process.exit(0); }, 10000); }
  if (m.t === 'pong') r.push(now - m.c);
  if (m.t === 'snap') { snaps++; if (last) gaps.push(now - last); last = now; } });
