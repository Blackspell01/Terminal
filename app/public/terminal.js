const term = new Terminal({ cursorBlink: true });
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

const url = new URL(location.href);
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(url);
ws.binaryType = 'arraybuffer';

function sendResize() {
  if (ws.readyState !== WebSocket.OPEN) return;
  const v = new DataView(new ArrayBuffer(5));
  v.setUint8(0, 0x01); v.setUint16(1, term.cols, true); v.setUint16(3, term.rows, true);
  ws.send(v.buffer);
}

ws.onopen = () => {
  term.loadAddon(new AttachAddon.AttachAddon(ws));
  sendResize();
};

new ResizeObserver(() => { fitAddon.fit(); sendResize(); })
  .observe(document.getElementById('terminal-container'));