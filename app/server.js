const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const pty = require('@homebridge/node-pty-prebuilt-multiarch');
const { Terminal } = require('@xterm/headless');
const { SerializeAddon } = require('@xterm/addon-serialize');

const PUBLIC = path.join(__dirname, 'public');
const shell = pty.spawn('nsenter', ['-t', '1', '-m', '-u', '-i', '-n', '-p', '--', 'sh', '-lc', 'cd "$HOME_DIR" && exec zsh -l'],
{
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  env: {
    ...process.env,
    ZDOTDIR: process.env.OMZ_DIR,
    ZSH: `${process.env.OMZ_DIR}/.oh-my-zsh`,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
  },
});

// Unsichtbares Terminal mit derselben Ausgabe: Neue Verbindungen bekommen dessen aktuellen Bildschirm
// statt roher Ausgabe (darin stecken alte Abfragen, deren Antworten sonst als Text am Prompt landen)
const mirror = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
const serializer = new SerializeAddon();
mirror.loadAddon(serializer);

// addon-serialize stellt die Maus-Kodierung (SGR, ?1006) nicht wieder her: über den Parser-Hook mitverfolgen
let sgrMouse = false;
for (const final of ['h', 'l']) {
  mirror.parser.registerCsiHandler({ prefix: '?', final }, (params) => {
    if (params.includes(1006)) sgrMouse = final === 'h';
    return false; // normale Verarbeitung nicht verhindern
  });
}

// Erst weitergeben, wenn das unsichtbare Terminal die Daten verarbeitet hat, damit die Reihenfolge zum Bildschirmstand passt
shell.onData((data) => mirror.write(data, () => {
  for (const ws of clients) if (ws.readyState === 1) ws.send(data);
}));

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
  mirror.write('', () => {
    if (ws.readyState !== 1) return;
    ws.send(serializer.serialize() + (sgrMouse ? '\x1b[?1006h' : ''));
    clients.add(ws);
  });
  ws.on('message', (raw) => {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (buf[0] === 0x01 && buf.length === 5) {
      shell.resize(buf.readUInt16LE(1), buf.readUInt16LE(3));
      mirror.resize(buf.readUInt16LE(1), buf.readUInt16LE(3));
    } else shell.write(buf.toString());
  });
  ws.on('close', () => clients.delete(ws));
});

server.listen(process.env.PORT || 3000, '0.0.0.0');