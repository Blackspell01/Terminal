const express = require('express');
const { WebSocketServer } = require('ws');
const pty = require('@homebridge/node-pty-prebuilt-multiarch');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BUFFER_MAX = 500 * 1024;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

const clients = new Set();
let outputBuffer = '';

const shell = pty.spawn('nsenter', [
  '-t', '1', '-m', '-u', '-i', '-n', '-p', '--',
  'bash', '-l',
], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: '/',
  env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
});

console.log(`Shell PID: ${shell.pid}`);

shell.onData((data) => {
  outputBuffer += data;
  if (outputBuffer.length > BUFFER_MAX) {
    outputBuffer = outputBuffer.slice(-BUFFER_MAX);
  }
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
});

shell.onExit(({ exitCode }) => {
  console.log(`Shell exited (code ${exitCode})`);
  process.exit(exitCode ?? 0);
});

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[ws] +client  (${clients.size} connected, buffer=${outputBuffer.length}b)`);

  ws.send('\x1b[!p\x1b[?25h\x1b[m');
  if (outputBuffer) ws.send(outputBuffer);

  ws.on('message', (raw) => {
    try {
      const { type, data, cols, rows } = JSON.parse(raw);
      if (type === 'input') {
        shell.write(data);
      } else if (type === 'resize') {
        shell.resize(Math.max(1, cols), Math.max(1, rows));
      }
    } catch {}
  });

  const drop = () => {
    clients.delete(ws);
    console.log(`[ws] -client  (${clients.size} connected)`);
  };
  ws.on('close', drop);
  ws.on('error', drop);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Web terminal -> http://localhost:${PORT}`);
});
