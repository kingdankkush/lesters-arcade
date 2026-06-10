// Final e2e audit — raw CDP protocol against already-running Edge headless.
// Uses Node 22's built-in WebSocket

async function findPageWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('CDP not reachable');
}

let msgId = 0;
const pending = new Map();
async function cdp(ws, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, 25000);
  });
}

(async () => {
  const wsUrl = await findPageWs();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const networkLog = [];
  const errors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result || msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Network.responseReceived' &&
        msg.params?.response?.url?.includes('lestersarcade.io')) {
      networkLog.push({ url: msg.params.response.url, status: msg.params.response.status });
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(`${d.exception?.description || d.text}`.slice(0, 240));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(`console.error: ${msg.params.args.map(a => a.description || a.value).join(' ')}`.slice(0, 240));
    }
  };

  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Network.enable');
  await cdp(ws, 'Runtime.enable');

  const evalJS = async (expr) => {
    const r = await cdp(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
    return r?.result?.value;
  };
  const click = async (sel) => evalJS(`(() => { const e = document.querySelector(\`${sel}\`); if (!e) return 'NOT FOUND'; e.click(); return 'clicked'; })()`);

  console.log('--- Phase 1: homepage ---');
  await cdp(ws, 'Page.navigate', { url: 'https://lestersarcade.io/' });
  await new Promise(r => setTimeout(r, 5000));
  const phase1 = networkLog.slice();
  const phase1Modules = phase1.filter(e => e.url.endsWith('.mjs'));
  console.log(`Homepage requests: ${phase1.length}, MJS modules: ${phase1Modules.length}`);

  console.log('\n--- Phase 2: connect wallet ---');
  await click('#officialConnectButton');
  await new Promise(r => setTimeout(r, 1500));

  console.log('\n--- Phase 3: click HMH cabinet (triggers lazy load) ---');
  const before = networkLog.length;
  await evalJS(`(() => { const c = document.querySelector('.official-cabinet-card.playable'); if (c) c.click(); return 'ok'; })()`);
  await new Promise(r => setTimeout(r, 3000));
  const phase3 = networkLog.slice(before);
  const loadedOnDemand = phase3.filter(e => e.url.includes('/assets/generated/hmh-'));
  console.log(`Cabinet-click fetched ${loadedOnDemand.length} HMH manifest URLs:`);
  for (const e of loadedOnDemand) console.log('  +', e.url.split('/').slice(-2).join('/'));

  console.log('\n--- Phase 4: free mode + pick hero ---');
  await click('#officialFreeModeButton');
  await new Promise(r => setTimeout(r, 1000));
  await evalJS(`(() => { const c = document.querySelector('button.hero-card.active'); if (c) c.click(); return 'ok'; })()`);
  await new Promise(r => setTimeout(r, 1200));
  await click('#officialBeginLevelButton');
  // Check loading overlay immediately (it should be visible for ~3s with random keyart)
  await new Promise(r => setTimeout(r, 800));
  const loadingInfo = await evalJS(`(() => { const o = document.getElementById('hmhLoadingOverlay'); if (!o) return 'NO OVERLAY'; const style = o.style?.backgroundImage || 'n/a'; return { visible: !o.hidden, bg: style.slice(0, 160) }; })()`);
  console.log('Loading overlay during Begin click:', JSON.stringify(loadingInfo));
  await new Promise(r => setTimeout(r, 5500)); // wait for cinematic finish
  await new Promise(r => setTimeout(r, 3000)); // wait for game start

  console.log('\n--- Phase 5: gameplay + profile/leaderboards ---');
  const gp = await evalJS(`(() => ({
    atGameplay: !!document.querySelector('#officialGameplay:not([hidden])'),
    canvas: (() => { const c = document.getElementById('combatCanvas'); return c ? {w:c.width, h:c.height} : null; })(),
    combatStatus: document.getElementById('combatStatus')?.textContent?.slice(0, 100) ?? 'MISSING',
  }))()`);
  console.log('Gameplay:', JSON.stringify(gp, null, 1));

  // Navigate to profile
  await evalJS(`(() => { for (const t of document.querySelectorAll('.official-nav-tab')) if (/profile/i.test(t.textContent)) { t.click(); return; } })()`);
  await new Promise(r => setTimeout(r, 800));
  const profile = await evalJS(`(() => ({
    heroCardVisible: !!document.querySelector('.profile-hero-card'),
    heroAvatar: !!document.querySelector('.profile-hero-avatar'),
    heroStats: document.querySelectorAll('.profile-hero-stat').length,
    quickActions: document.querySelectorAll('.profile-action-primary').length,
  }))()`);
  console.log('Profile:', JSON.stringify(profile, null, 1));

  // Navigate to leaderboards
  await evalJS(`(() => { for (const t of document.querySelectorAll('.official-nav-tab')) if (/leaderboard/i.test(t.textContent)) { t.click(); return; } })()`);
  await new Promise(r => setTimeout(r, 800));
  const lb = await evalJS(`(() => {
    const scores = [...document.querySelectorAll('.leaderboard-trow .leaderboard-score')].map(n => parseInt(n.textContent.replace(/,/g,''), 10)).filter(x => x>0);
    return {
      gameTabs: document.querySelectorAll('.leaderboard-game-tab').length,
      cadenceTabs: document.querySelectorAll('.leaderboard-cadence-tab').length,
      rows: document.querySelectorAll('.leaderboard-trow').length,
      goldRank: !!document.querySelector('.leaderboard-trow.top-3.rank-gold'),
      silverRank: !!document.querySelector('.leaderboard-trow.top-3.rank-silver'),
      bronzeRank: !!document.querySelector('.leaderboard-trow.top-3.rank-bronze'),
      scoreCount: scores.length,
      topScore: scores[0],
      bottomScore: scores[scores.length - 1],
      scoreRangeOk: scores.length > 1 && scores[0] >= 24000 && scores[scores.length-1] <= 6000,
    };
  })()`);
  console.log('Leaderboards:', JSON.stringify(lb, null, 1));

  console.log('\n--- FINAL ---');
  console.log(`Total network requests: ${networkLog.length}`);
  console.log(`Phase 1 (homepage eager) MJS modules: ${phase1Modules.length}`);
  console.log(`Phase 3 (on cabinet click) HMH-specific fetches: ${loadedOnDemand.length}`);
  console.log(`JS errors observed: ${errors.length}`);
  if (errors.length) for (const e of errors.slice(0, 8)) console.log('  ', e);

  ws.close();
})();
