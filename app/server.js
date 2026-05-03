const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const pty = require('@homebridge/node-pty-prebuilt-multiarch');

const PUBLIC = path.join(__dirname, 'public');
const shell = pty.spawn('nsenter', ['-t', '1', '-m', '-u', '-i', '-n', '-p', '--', 'bash', '-l'], {
  name: 'xterm-256color', cols: 80, rows: 24, cwd: '/',
  env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' },
});

let outputBuffer = '';
shell.onData((data) => {
  outputBuffer += data;
  if (outputBuffer.length > 512000) outputBuffer = outputBuffer.slice(-512000);
  for (const ws of clients) if (ws.readyState === 1) ws.send(data);
});

const server = http.createServer((req, res) => {
  const file = path.join(PUBLIC, req.url === '/' ? '/index.html' : req.url);
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404), res.end();
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] });
    res.end(data);
  });
});

const clients = new Set();
new WebSocketServer({ server }).on('connection', (ws) => {
  clients.add(ws);
  if (outputBuffer) ws.send(outputBuffer);
  ws.on('message', (raw) => {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (buf[0] === 0x01 && buf.length === 5) shell.resize(buf.readUInt16LE(1), buf.readUInt16LE(3));
    else shell.write(buf.toString());
  });
  ws.on('close', () => clients.delete(ws));
});

server.listen(process.env.PORT || 3000, '0.0.0.0');