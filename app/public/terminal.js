const term = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, monospace',
  lineHeight: 1.2,
  scrollback: 10000,
  theme: {
    background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#aeafad',
    selectionBackground: '#264f78',
    black: '#1e1e1e',   red:     '#f44747', green:   '#4ec9b0', yellow:  '#dcdcaa',
    blue:  '#569cd6',   magenta: '#c586c0', cyan:    '#9cdcfe', white:   '#d4d4d4',
    brightBlack:   '#808080', brightRed:     '#f44747', brightGreen:   '#4ec9b0',
    brightYellow:  '#dcdcaa', brightBlue:    '#569cd6', brightMagenta: '#c586c0',
    brightCyan:    '#9cdcfe', brightWhite:   '#ffffff',
  },
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

const decoder = new TextDecoder();
let ws, reconnectDelay = 500;

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function connect() {
  const url = new URL(location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => { reconnectDelay = 500; sendResize(); term.focus(); };
  ws.onmessage = (e) => {
    term.write(typeof e.data === 'string' ? e.data : decoder.decode(e.data));
  };
  ws.onclose = () => {
    term.write('\r\n\x1b[33m[reconnecting in ' + (reconnectDelay / 1000).toFixed(1) + 's...]\x1b[0m\r\n');
    setTimeout(() => { reconnectDelay = Math.min(reconnectDelay * 1.5, 10000); connect(); }, reconnectDelay);
  };
  ws.onerror = () => ws.close();
}

function sendResize() {
  send({ type: 'resize', cols: term.cols, rows: term.rows });
}

term.onData((data) => { send({ type: 'input', data }); });

term.attachCustomKeyEventHandler((ev) => {
  if (ev.type !== 'keydown') return true;
  if (ev.ctrlKey && ev.code === 'KeyC') {
    if (ev.shiftKey || term.hasSelection()) {
      navigator.clipboard.writeText(term.getSelection() || '').catch(() => {});
      return false;
    }
    return true;
  }
  if (ev.ctrlKey && ev.code === 'KeyV') {
    navigator.clipboard.readText().then((t) => send({ type: 'input', data: t })).catch(() => {});
    return false;
  }
  return true;
});

new ResizeObserver(() => { fitAddon.fit(); sendResize(); })
  .observe(document.getElementById('terminal-container'));

connect();
