import ReconnectingWebSocket from 'https://cdn.jsdelivr.net/npm/partysocket@1.3.0/ws/+esm';

const term = new Terminal({ cursorBlink: true, macOptionClickForcesSelection: true });
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

const url = new URL(location.href);
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
// Verbindet bei Abbruch automatisch neu
const ws = new ReconnectingWebSocket(url.href);
ws.binaryType = 'arraybuffer';

function sendResize() {
  if (ws.readyState !== WebSocket.OPEN) return;
  const v = new DataView(new ArrayBuffer(5));
  v.setUint8(0, 0x01); v.setUint16(1, term.cols, true); v.setUint16(3, term.rows, true);
  ws.send(v.buffer);
}

// Bei jeder (Neu-)Verbindung schickt der Server den aktuellen Bildschirm.
// AttachAddon beendet sich bei Verbindungsabbruch selbst, daher pro Verbindung neu einhängen.
ws.addEventListener('open', () => {
  term.reset();
  term.loadAddon(new AttachAddon.AttachAddon(ws));
  sendResize();
});

new ResizeObserver(() => { fitAddon.fit(); sendResize(); })
  .observe(document.getElementById('terminal-container'));
