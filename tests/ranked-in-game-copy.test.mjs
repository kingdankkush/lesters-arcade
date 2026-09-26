// In-game Ranked onboarding copy (owner request 2026-09-26, slice
// fable/in-game-ranked-copy). The three child host pages carry the canonical
// wording from docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md
// verbatim, the guide path is exactly '/how-ranked-works' everywhere, and the
// copy lives in static HTML/CSS only: the child JS entries stay byte-identical
// (STACKED entry cap 29,000 B; HMH initial-JS headroom is under 4 KB).
//
// Fee truth: the 0.012 price is only true once the fee release
// (fable/ranked-fee-001: entry 0.01, settle floor 0.012) is live, so the
// branch carrying this test merges with or after that release, never before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

export const RANKED_COPY = Object.freeze({
  price: 'Ranked costs 0.012 testnet zkLTC per run: 0.01 entry + 0.002 to publish your score on chain.',
  faucet: 'Get free testnet zkLTC from the LiteForge faucet (0.05 per request, enough for 4 Ranked runs)',
  faucetUrl: 'https://liteforge.hub.caldera.xyz',
  free: 'Free play needs no wallet and never touches the chain.',
  proof: "Ranked runs are checked by the arcade's server and published on LitVM, then appear on the leaderboards, your profile and your achievements.",
  value: 'Testnet zkLTC has no monetary value.',
  guidePath: '/how-ranked-works',
  guideText: 'How Ranked works',
});

const GUIDE_ANCHOR = `<a href="${RANKED_COPY.guidePath}" target="_blank" rel="noopener noreferrer">${RANKED_COPY.guideText}</a>`;
const FAUCET_ANCHOR = `<a href="${RANKED_COPY.faucetUrl}" target="_blank" rel="noopener noreferrer">liteforge.hub.caldera.xyz</a>`;
const count = (text, needle) => text.split(needle).length - 1;
const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `missing ${from}`);
  const end = text.indexOf(to, start);
  assert.ok(end > start, `missing ${to} after ${from}`);
  return text.slice(start, end);
};

const pages = {
  hmh: read('apps/portal/hmh-reboot/index.html'),
  chikun: read('apps/portal/chikun/index.html'),
  stacked: read('apps/portal/stacked/index.html'),
};
const entries = {
  hmh: read('apps/hmh-reboot/src/main.mjs'),
  chikun: read('apps/chikun/src/main.mjs'),
  stacked: read('apps/stacked/src/main.mjs'),
};
const brief = read('docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md');

test('the canonical wording matches the integration brief', () => {
  for (const key of ['price', 'free', 'proof', 'value']) assert.ok(brief.includes(RANKED_COPY[key]), `brief carries ${key}`);
  assert.ok(brief.includes(`${RANKED_COPY.faucet}.`), 'brief carries the faucet line');
  assert.ok(brief.includes(RANKED_COPY.faucetUrl));
  assert.ok(brief.includes('**`/how-ranked-works`**'), 'the brief fixes the clean guide URL');
});

test('every child host page carries the four canonical facts, the faucet line and its URL verbatim', () => {
  for (const [name, html] of Object.entries(pages)) {
    for (const key of ['price', 'free', 'proof', 'value']) assert.ok(html.includes(RANKED_COPY[key]), `${name}: ${key}`);
    assert.ok(html.includes(`${RANKED_COPY.faucet}: `), `${name}: faucet sentence`);
    assert.ok(html.includes(RANKED_COPY.faucetUrl), `${name}: faucet URL`);
    // Exact numbers only; no rounding or alternative phrasings anywhere on the page.
    assert.doesNotMatch(html, /0\.1 zkLTC|0\.102|0\.1001|102000000000000000/, `${name}: stale fee figures`);
  }
});

test('the guide path is exactly /how-ranked-works everywhere, never the .html file', () => {
  for (const [name, html] of Object.entries(pages)) {
    const total = count(html, 'how-ranked-works');
    assert.ok(total >= 1, `${name} names the guide`);
    assert.equal(count(html, '/how-ranked-works'), total, `${name}: every occurrence is the absolute clean path`);
    assert.equal((html.match(/\/how-ranked-works(?![\w./-])/g) ?? []).length, total, `${name}: no suffix such as .html or a query`);
    assert.doesNotMatch(html, /how-ranked-works\.html/, `${name}: never the file name`);
  }
  // Chikun and STACKED open the guide in a new tab (their hosts grant allow-popups).
  assert.equal(count(pages.chikun, GUIDE_ANCHOR), 2, 'Chikun: start overlay and Free results overlay each carry the guide link');
  assert.equal(count(pages.chikun, 'how-ranked-works'), 2);
  assert.equal(count(pages.stacked, GUIDE_ANCHOR), 1, 'STACKED: one guide anchor in the shared menu/results panel');
  assert.equal(count(pages.stacked, 'how-ranked-works'), 1);
  // HMH's host sandbox has no allow-popups, so the guide is text with a single data attribute.
  const hmhBlock = slice(pages.hmh, '<section class="hmh-startup-modes"', '</section>');
  assert.equal(count(pages.hmh, 'data-guide-path="/how-ranked-works"'), 1);
  assert.match(hmhBlock, /<span data-guide-path="\/how-ranked-works">lestersarcade\.io\/how-ranked-works<\/span>/);
  assert.doesNotMatch(hmhBlock, /<a\b/, 'HMH carries no anchor: its sandbox has no allow-popups');
  assert.doesNotMatch(read('apps/portal/src/hmh-reboot-host.mjs'), /allow-popups/, 'the HMH sandbox is unchanged by this slice');
});

test('each explainer sits on a pre-run or post-run surface, never on a live-run one', () => {
  // HMH: inside the startup briefing card, after the three tips and before the progress bar.
  const hmhStartup = slice(pages.hmh, 'id="hmhStartup"', 'id="hmhHud"');
  assert.match(hmhStartup, /<section class="hmh-startup-modes" aria-labelledby="hmhStartupModesTitle">\s*<h2 id="hmhStartupModesTitle">Free and Ranked<\/h2>/);
  assert.ok(hmhStartup.indexOf('hmh-startup-modes') > hmhStartup.indexOf('<div class="hmh-startup-tips">'));
  assert.ok(hmhStartup.indexOf('hmh-startup-modes') < hmhStartup.indexOf('hmh-startup-progress'));
  const hmhPause = slice(pages.hmh, 'id="hmhPausePanel"', 'hmh-menu-actions');
  assert.doesNotMatch(hmhPause, /0\.012|how-ranked-works/, 'the HMH pause panel stays as it was');
  assert.doesNotMatch(slice(pages.hmh, 'id="hmhHud"', 'id="hmhControlsHint"'), /0\.012|zkLTC|how-ranked-works/, 'nothing on the HMH cockpit');

  // Chikun: a collapsed details block on the start overlay below the key hints; the Free hint after the share row.
  const chikunStart = slice(pages.chikun, 'id="startOverlay"', 'id="pauseOverlay"');
  assert.match(chikunStart, /<small>[^<]*<\/small>\s*<details class="ranked-help" id="rankedHelp">\s*<summary>Free and Ranked <span>0\.012 zkLTC per run<\/span><\/summary>/);
  assert.ok(chikunStart.indexOf('id="rankedHelp"') > chikunStart.indexOf('id="startButton"'), 'the start button stays above the explainer');
  assert.ok(chikunStart.includes(FAUCET_ANCHOR));
  const chikunResult = slice(pages.chikun, 'id="resultOverlay"', 'id="liveStatus"');
  assert.match(chikunResult, /id="shareRow" aria-label="Share this run"><\/div>\s*<p class="ranked-hint" id="rankedHint">Free play needs no wallet and never touches the chain\. <a href="\/how-ranked-works"/);
  assert.doesNotMatch(slice(pages.chikun, '<div class="hud">', 'id="startOverlay"'), /zkLTC|how-ranked-works/, 'nothing on the Chikun HUD');
  assert.doesNotMatch(slice(pages.chikun, 'id="pauseOverlay"', 'id="resultOverlay"'), /zkLTC|how-ranked-works/, 'the Chikun pause overlay stays as it was');

  // STACKED: the Ranked tile names the price; the hint and the explainer follow the share row in the one dialog panel.
  assert.match(pages.stacked, /<span class="tile-label">Ranked<\/span><span class="tile-hint">0\.012 zkLTC per run<\/span>/);
  assert.doesNotMatch(pages.stacked, /Verified runs/);
  assert.match(pages.stacked, /id="shareRow" class="share-row-mount" aria-label="Share this run" hidden><\/div>\s*<p id="rankedHint" class="ranked-hint"><span class="free-line">Free play needs no wallet and never touches the chain\.<\/span> <a href="\/how-ranked-works"/);
  assert.match(pages.stacked, /<details id="rankedHelp" class="ranked-help"><summary><span>Free and Ranked<\/span><span class="summary-hint">0\.012 zkLTC per run<\/span><\/summary>/);
  assert.ok(pages.stacked.includes(FAUCET_ANCHOR));
  const stackedOrder = ['id="menuTiles"', 'id="shareRow"', 'id="rankedHint"', 'id="rankedHelp"', 'id="freeMedalShelf"', 'id="preferencePanel"'].map((id) => pages.stacked.indexOf(id));
  assert.deepEqual([...stackedOrder].sort((a, b) => a - b), stackedOrder, 'hint and explainer sit between the share row and the medal shelf');
  assert.doesNotMatch(slice(pages.stacked, '<header class="game-header">', 'id="gameOverlay"'), /zkLTC|how-ranked-works/, 'nothing on the STACKED header, stage, touch controls or footer');
});

test('the copy is static: no child JS entry names the price or the guide', () => {
  for (const [name, source] of Object.entries(entries)) {
    // Phrase-level guards: a bare 0.012 is a legitimate tuning constant in the simulation.
    for (const phrase of ['how-ranked-works', '0.012 testnet zkLTC', '0.012 zkLTC', 'liteforge.hub.caldera.xyz', 'LiteForge faucet']) {
      assert.equal(source.includes(phrase), false, `${name} main.mjs carries no onboarding copy (${phrase})`);
    }
  }
});

test('the house style holds: no monetary promise, no "verified", no em dash in the new blocks', () => {
  const blocks = [
    slice(pages.hmh, '<section class="hmh-startup-modes"', '</section>'),
    slice(pages.chikun, '<details class="ranked-help"', '</details>'),
    slice(pages.chikun, '<p class="ranked-hint"', '</p>'),
    slice(pages.stacked, '<p id="rankedHint"', '</p>'),
    slice(pages.stacked, '<details id="rankedHelp"', '</details>'),
  ];
  for (const block of blocks) {
    assert.doesNotMatch(block, /verif|prize|\bearn|reward|jackpot|\bpaid\b|real money|—/i, block.slice(0, 80));
    assert.doesNotMatch(block, /\bLTC\b(?!C)/, 'the token is always written zkLTC');
  }
});

test('the stylesheets gate the Free hint by mode and keep the blocks contained at phone widths', () => {
  const chikunCss = read('apps/portal/chikun/game.css');
  assert.match(chikunCss, /\.game-shell\[data-mode="ranked"\] \.ranked-hint\{display:none\}/, 'Chikun hides the Free hint on Ranked results');
  assert.match(chikunCss, /\.ranked-help-body p\{[^}]*overflow-wrap:anywhere/);
  assert.match(chikunCss, /@media\(max-width:700px\)\{\.ranked-help\{/, 'Chikun compacts the explainer under 700px');
  assert.match(chikunCss, /@media\(max-height:260px\)\{\.ranked-help\{display:none\}\}/, 'the tiniest landscape viewport hides it like the mode tease');
  assert.match(chikunCss, /\.ranked-help summary\{[^}]*min-height:44px/);

  const stackedCss = read('apps/portal/stacked/game.css');
  assert.match(stackedCss, /#menuTiles:has\(#rankedModeTile\[aria-current="true"\]\)~\.ranked-hint \.free-line\{display:none\}/, 'STACKED hides the Free sentence while Ranked is the active mode');
  assert.match(stackedCss, /\.panel \.ranked-help-body p\{[^}]*overflow-wrap:anywhere/);
  assert.match(stackedCss, /\.ranked-help \.summary-hint\{[^}]*text-transform:none/);

  const hmhCss = read('apps/portal/hmh-reboot/styles.css');
  assert.match(hmhCss, /\.hmh-startup-modes \{ margin:0; border-top:1px solid #35534a;/);
  assert.match(hmhCss, /\.hmh-startup-modes p \{[^}]*overflow-wrap:anywhere/);
  assert.match(hmhCss, /@media\(max-width:600px\) \{ \.hmh-startup-modes \{/, 'HMH compacts the block on phones');
});
