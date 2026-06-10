// CDP gameplay audit — navigate wallet -> cabin -> mode -> charselect -> level intro -> begin -> gameplay
const target = 'https://lestersarcade.io/';

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      const page = tabs.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
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
    errors.push({ text: d.text, desc: d.exception?.description?.slice(0, 600), url: d.url, line: d.lineNumber, col: d.columnNumber });
  }
  if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error')) {
    errors.push({ kind: 'console.error', args: msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 400) });
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
await new Promise((r) => setTimeout(r, 4000));

const click = async (selector, label, waitAfter = 2000) => {
  const expr = `(() => { const b = document.querySelector(\`${selector}\`) || [...document.querySelectorAll('button')].find(x => /${label}/i.test(x.textContent)); if (!b) return 'NOT_FOUND'; b.click(); return 'clicked:' + (b.id || b.textContent.trim().slice(0,40)); })()`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log('>', label, '→', r?.result?.value ?? '?');
  await new Promise((r) => setTimeout(r, waitAfter));
};

// Connect Wallet
await click('#officialConnectButton', 'connect', 2500);
// Click Hard Money Heroes cabinet (data-game attribute)
const cabinetExpr = `(() => { const c = document.querySelector('[data-game]'); if (!c) return 'NOT_FOUND'; c.click(); return 'clicked:' + c.dataset.game; })()`;
let r = await send('Runtime.evaluate', { expression: cabinetExpr, returnByValue: true });
console.log('> cabinet →', r?.result?.value ?? '?');
await new Promise((rs) => setTimeout(rs, 2000));

// Free Mode
await click('#officialFreeModeButton', 'Free Mode', 2000);

// Character Select state
const csProbe = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    visible: !!document.querySelector('#officialCharacterSelect:not([hidden])'),
    heroCards: document.querySelectorAll('button.hero-card').length,
    activeCard: document.querySelector('button.hero-card.active')?.dataset?.hero ?? document.querySelector('button.hero-card.active')?.querySelector('.hero-name')?.textContent,
    rosterEl: !!document.querySelector('#officialCharacterRoster'),
    stageCount: document.querySelectorAll('.hero-card-stage').length,
    spriteCount: document.querySelectorAll('.hero-card-stage .hmh-cabinet-rotator img').length,
    firstSpriteSrc: document.querySelector('.hero-card-stage .hmh-cabinet-rotator img')?.src ?? 'no sprite',
  })`,
  returnByValue: true,
});
console.log('\n=== CHAR SELECT STATE ===');
console.log(csProbe?.result?.value ?? JSON.stringify(csProbe));

// Click first hero
await click('button.hero-card.active', 'hero', 2000);

// Level intro
await click('#officialBeginLevelButton', 'Begin', 4000);

// Gameplay state
const gpProbe = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    atGameplay: !!document.querySelector('#officialGameplay:not([hidden])'),
    combatMountChildren: document.querySelector('#officialCombatMount')?.children.length,
    canvas: (() => { const c = document.getElementById('combatCanvas'); if (!c) return 'MISSING'; const r = c.getBoundingClientRect(); return { width: c.width, height: c.height, bbox: {top:r.top,left:r.left,w:r.width,h:r.height}, display: getComputedStyle(c).display, visibility: getComputedStyle(c).visibility, parent: c.parentElement?.id || c.parentElement?.className.slice(0,40) }; })(),
    hudOverlay: (() => { const h = document.getElementById('combatHudOverlay'); return h ? {hidden: h.hidden, childCount: h.children.length, inner: h.innerHTML.slice(0,400)} : 'MISSING'; })(),
    menuPanel: (() => { const m = document.getElementById('combatMenuPanel'); return m ? {hidden: m.hidden, state: m.dataset.state} : 'MISSING'; })(),
    menuButtons: [...document.querySelectorAll('#combatMenuActionGrid button')].map(b => b.textContent.trim().slice(0, 30)),
    combatStatus: document.getElementById('combatStatus')?.textContent?.slice(0, 200) ?? 'MISSING',
  })`,
  returnByValue: true,
});
console.log('\n=== GAMEPLAY STATE ===');
console.log(gpProbe?.result?.value ?? JSON.stringify(gpProbe));

console.log('\n=== JS ERRORS / CONSOLE ===');
console.log(JSON.stringify(errors.slice(0, 30), null, 1));
console.log('\n=== 4xx/5xx ===');
console.log(JSON.stringify(failedRequests.slice(0, 20), null, 1));
ws.close();
process.exit(0);
