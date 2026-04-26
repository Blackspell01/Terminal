const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const pty = require('@homebridge/node-pty-prebuilt-multiarch');

const PORT = process.env.PORT || 3000;
const BUFFER_MAX = 500 * 1024;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const file = req.url === '/' ? '/index.html' : req.url;
  fs.readFile(path.join(PUBLIC, file), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const clients = new Set();
let outputBuffer = '';

const shell = pty.spawn('nsenter', ['-t', '1', '-m', '-u', '-i', '-n', '-p', '--', 'bash', '-l'], {
  name: 'xterm-256color', cols: 80, rows: 24, cwd: '/',
  env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
});

console.log(`Shell PID: ${shell.pid}`);

shell.onData((data) => {
  outputBuffer += data;
  if (outputBuffer.length > BUFFER_MAX) outputBuffer = outputBuffer.slice(-BUFFER_MAX);
  for (const ws of clients) if (ws.readyState === 1) ws.send(data);
});

shell.onExit(({ exitCode }) => { console.log(`Shell exited (code ${exitCode})`); process.exit(exitCode ?? 0); });

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send('\x1b[!p\x1b[?25h\x1b[m');
  if (outputBuffer) ws.send(outputBuffer);

  ws.on('message', (raw) => {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (buf[0] === 0x01 && buf.length === 5) shell.resize(buf.readUInt16LE(1), buf.readUInt16LE(3));
    else shell.write(buf.toString());
  });

  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => {});
});

server.listen(PORT, '0.0.0.0', () => console.log(`Web terminal -> http://localhost:${PORT}`));
