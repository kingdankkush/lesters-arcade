// CDP console-error capture for lestersarcade.io using headless Edge.
// Node 22 has global WebSocket. Usage: node scripts/tmp-cdp-audit.mjs <url>
const target = process.argv[2] ?? 'https://lestersarcade.io/';

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      const page = tabs.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* edge not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Could not reach Edge debugging port');
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => {
  const msgId = ++id;
  pending.set(msgId, resolve);
  ws.send(JSON.stringify({ id: msgId, method, params }));
});

const errors = [];
const failedRequests = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    errors.push({
      kind: 'exception',
      text: d.text,
      desc: d.exception?.description?.slice(0, 600),
      url: d.url, line: d.lineNumber, col: d.columnNumber,
    });
  }
  if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
    errors.push({ kind: `console.${msg.params.type}`, args: msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 400) });
  }
  if (msg.method === 'Network.loadingFailed') {
    failedRequests.push({ url: msg.params.requestURLs?.[0] ?? msg.params.requestId, error: msg.params.errorText });
  }
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
    failedRequests.push({ url: msg.params.response.url, status: msg.params.response.status });
  }
};

await new Promise((r) => { ws.onopen = r; });
await send('Runtime.enable');
await send('Network.enable');
await send('Page.enable');
await send('Page.navigate', { url: target });
await new Promise((r) => setTimeout(r, 9000));

// Probe app state after load: did listeners attach? does the splash render?
const probe = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    title: document.title,
    bodyChildren: document.body?.children?.length ?? 0,
    hasConnectBtn: !!document.querySelector('#connectWalletButton, #officialConnectWalletButton, [id*="onnect"]'),
    connectBtnIds: [...document.querySelectorAll('button')].map(b=>b.id).filter(Boolean).slice(0,20),
    musicPlayer: !!document.querySelector('#arcadeMusicPlayer'),
    splashVisible: !!document.querySelector('#officialWalletSplash:not([hidden])'),
    keyartBg: getComputedStyle(document.querySelector('#officialWalletSplash') ?? document.body).backgroundImage.slice(0,200),
  })`,
  returnByValue: true,
});
console.log('=== APP STATE PROBE ===');
console.log(probe?.result?.value ?? JSON.stringify(probe));

// Try clicking connect
const click = await send('Runtime.evaluate', {
  expression: `(() => { const b = document.querySelector('#officialConnectWalletButton') || [...document.querySelectorAll('button')].find(x => /connect/i.test(x.textContent)); if (!b) return 'NO BUTTON FOUND'; b.click(); return 'clicked: ' + (b.id || b.textContent.trim().slice(0,40)); })()`,
  returnByValue: true,
});
console.log('=== CLICK RESULT ===');
console.log(click?.result?.value ?? JSON.stringify(click));
await new Promise((r) => setTimeout(r, 3000));

console.log('=== JS ERRORS / CONSOLE ===');
console.log(JSON.stringify(errors, null, 1));
console.log('=== FAILED REQUESTS ===');
console.log(JSON.stringify(failedRequests.slice(0, 30), null, 1));
ws.close();
process.exit(0);
