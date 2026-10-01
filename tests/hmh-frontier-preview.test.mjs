// New Frontier (preview): a second Free start on the HMH mode select that
// asks the host for the W4a ten-area world. Free and unranked only; a Ranked
// session never gets it, and a preview run offers no result or share card.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { HMH_FRONTIER_PREVIEW_COPY, mountHmhFrontierPreviewOption } from '../apps/portal/src/hmh-frontier-preview.mjs';
import { HMH_FRONTIER_PREVIEW_WORLD } from '../apps/portal/src/hmh-reboot-host.mjs';
import { TEN_AREA_WORLD_VALUE, resolveHmhWorldSelection } from '../apps/hmh-reboot/src/world-context.mjs';

const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

function node(tag) {
  return {
    tag,
    children: [],
    attrs: {},
    listeners: {},
    hidden: false,
    parentNode: null,
    setAttribute(name, value) { this.attrs[name] = String(value); },
    addEventListener(type, listener) { this.listeners[type] = listener; },
    append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } },
    before(sibling) {
      const index = this.parentNode.children.indexOf(this);
      sibling.parentNode = this.parentNode;
      this.parentNode.children.splice(index, 0, sibling);
    },
    click() { return this.listeners.click?.(); },
  };
}

const documentRef = { createElement: (tag) => node(tag) };

test('the option renders as a labelled second Free start with an honest note, HMH only', () => {
  const container = node('section');
  const grid = node('div');
  const guide = node('p');
  container.append(grid, guide);
  const starts = [];
  const option = mountHmhFrontierPreviewOption({ documentRef, container, before: guide, onStart: () => starts.push('free-preview') });
  assert.equal(option.root.id, 'hmhFrontierPreviewOption');
  assert.deepEqual(container.children.map((child) => child), [grid, option.root, guide], 'sits between the mode cards and the Ranked guide note');
  assert.equal(option.button.tag, 'button');
  assert.equal(option.button.type, 'button');
  assert.equal(option.button.textContent, 'Explore the New Frontier (preview)');
  assert.equal(option.button.attrs['aria-describedby'], option.note.id);
  assert.equal(option.note.textContent, 'Unfinished ten-area world in Free Mode. Unranked: no leaderboard, no run result and no share card.');
  assert.match(option.note.textContent, /unranked/i);
  assert.match(option.note.textContent, /no leaderboard/i);
  assert.match(option.note.textContent, /preview|unfinished/i);
  option.button.click();
  assert.deepEqual(starts, ['free-preview']);
  option.render('lester-blaster');
  assert.equal(option.root.hidden, false);
  for (const gameId of ['chikun', 'stacked', null]) {
    option.render(gameId);
    assert.equal(option.root.hidden, true, String(gameId));
  }
  // Without an anchor the option is appended to the container.
  const plain = node('section');
  const appended = mountHmhFrontierPreviewOption({ documentRef, container: plain, onStart: () => {} });
  assert.deepEqual(plain.children, [appended.root]);
  assert.throws(() => mountHmhFrontierPreviewOption({ documentRef, container: plain }), TypeError);
  assert.throws(() => mountHmhFrontierPreviewOption({ documentRef, onStart: () => {} }), TypeError);
});

test('every preview copy line says it is unranked and has no result', () => {
  for (const [key, copy] of Object.entries(HMH_FRONTIER_PREVIEW_COPY)) {
    if (key === 'button' || key === 'title') continue;
    assert.match(key === 'intro' ? copy.body : copy, /unranked/i, key);
  }
  assert.match(HMH_FRONTIER_PREVIEW_COPY.result, /^Preview run/);
  assert.match(HMH_FRONTIER_PREVIEW_COPY.result, /no result or share card/);
  assert.match(HMH_FRONTIER_PREVIEW_COPY.gameplay, /no result, leaderboard or share card/);
});

test('the host requests exactly the child selection the world-context rule accepts', () => {
  assert.equal(HMH_FRONTIER_PREVIEW_WORLD, TEN_AREA_WORLD_VALUE);
  const selection = resolveHmhWorldSelection({ params: `mode=free&world=${HMH_FRONTIER_PREVIEW_WORLD}` });
  assert.equal(selection.legacy, false);
  assert.equal(selection.rankedEligible, false);
  assert.equal(selection.official, false);
});

test('main.js starts the preview only from its button, for Free, and asks the host per unranked session', () => {
  // The mode select mounts the option once, between the cards and the guide note.
  assert.match(main, /const renderOfficialModeSelect = \(\) => \{\n  officialPlayRoutes\.renderModeSelect\(\);\n  hmhChallengeUi\.render\(selectedGameId\);\n  startRankedPreflightInBackground\(\);\n  if \(!hmhFrontierPreviewOption && dom\.officialModeSelect\) \{\n    hmhFrontierPreviewOption = mountHmhFrontierPreviewOption\(\{\n      container: dom\.officialModeSelect,\n      before: dom\.officialModeSelect\.querySelector\('\.mode-guide-note'\),\n      onStart: \(\) => startOfficialMode\('free', \{ frontierPreview: true \}\),\n    \}\);\n  \}\n  hmhFrontierPreviewOption\?\.render\(selectedGameId\);\n/);
  // Every other start (the Free card, quick-start, Ranked, restart via Ranked) clears the request.
  assert.match(main, /async function startOfficialMode\(mode, \{ frontierPreview = false \} = \{\}\) \{\n  playSfxCue\('menu-click'\);\n[^\n]*\n  hmhFrontierPreviewRequested = mode === 'free' && frontierPreview === true && selectedGameId === 'lester-blaster';\n/);
  assert.equal((main.match(/frontierPreview: true/g) ?? []).length, 1, 'only the preview button requests the world');
  assert.match(main, /dom\.officialFreeModeButton\.addEventListener\('click', \(\) => startOfficialMode\('free'\)\);/);
  assert.match(main, /dom\.officialRankedModeButton\.addEventListener\('click', \(\) => startOfficialMode\('ranked'\)\);/);
  // The mount asks only for an unranked Free payload and trusts the frame's answer.
  assert.match(main, /const frontierWorld = hmhFrontierPreviewRequested && !currentSession\.isPaid && initContext\.mode === 'free' && initContext\.rankedEligible === false \? 'ten-area' : null;\n  const frame = hmhRebootHost\.mountSession\(\{/);
  assert.match(main, /\}, \{ world: frontierWorld \}\);\n  hmhFrontierPreviewActive = frame\?\.dataset\?\.world === 'ten-area';\n  labelHmhFrontierPreviewTitle\(\);\n  return frame;\n\}/);
  assert.equal((main.match(/hmhRebootHost\.mountSession\(/g) ?? []).length, 1);
  // Teardown clears the active flag; the Chikun and STACKED hosts never see it.
  assert.match(main, /hmhRebootActive = false;\n  hmhFrontierPreviewActive = false;\n\}/);
  assert.doesNotMatch(main.slice(main.indexOf('function mountChikunSession'), main.indexOf('const hmhChallengeUi = ')), /frontierWorld|hmhFrontierPreview/);
  const stackedMount = main.indexOf('async function mountStackedSession');
  assert.doesNotMatch(main.slice(stackedMount, main.indexOf('\n}\n', stackedMount)), /frontierWorld|hmhFrontierPreview/);
});

test('main.js labels a preview run and offers it no Free share card', () => {
  assert.match(main, /const modeCopy = hmhFrontierPreviewActive \? HMH_FRONTIER_PREVIEW_COPY\.gameplay : officialSelectedMode === 'ranked'/);
  // The gameplay title is labelled by the renderer and by the mount (the view renders first), never twice.
  assert.match(main, /const renderOfficialGameplay = \(\) => \{\n  officialPlayRoutes\.renderGameplay\(\);\n[^\n]*\n  labelHmhFrontierPreviewTitle\(\);\n\};/);
  assert.match(main, /function labelHmhFrontierPreviewTitle\(\) \{\n  if \(!hmhFrontierPreviewActive \|\| !dom\.officialGameModeTitle\) return;\n  const suffix = ` \/\/ \$\{HMH_FRONTIER_PREVIEW_COPY\.title\}`;\n  if \(!dom\.officialGameModeTitle\.textContent\.endsWith\(suffix\)\) dom\.officialGameModeTitle\.textContent \+= suffix;\n\}/);
  assert.match(main, /textContent = hmhFrontierPreviewActive \? HMH_FRONTIER_PREVIEW_COPY\.gameplay : 'Top-down reboot runtime connected\./);
  const summary = main.slice(main.indexOf('function renderGameOverSummary()'), main.indexOf('const loopNote = el('));
  assert.match(summary, /if \(hmhFrontierPreviewActive\) appendText\(dom\.combatGameOverSummary, 'p', HMH_FRONTIER_PREVIEW_COPY\.result, 'game-over-summary-copy hmh-frontier-preview-label'\);\n  else if \(!win && \(currentSession\?\.mode \?\? officialSelectedMode \?\? 'free'\) === 'free'\) \{/);
  assert.equal((summary.match(/createShareRow\(/g) ?? []).length, 1, 'one Free share row, inside the non-preview branch');
});

// QA sweep 2026-10-01: the preview's level intro said "Level 1: The Forked
// Frontier ... the Liquidator's yard". It shows the ten-area world's copy and
// gives the page's own copy back for an ordinary Free or Ranked run.
test('the level intro shows the preview copy only for a preview start', async () => {
  const { applyHmhFrontierPreviewIntro } = await import('../apps/portal/src/hmh-frontier-preview.mjs');
  const el = (text) => ({ textContent: text, dataset: {} });
  const eyebrow = el('Hard Money Heroes // Level 1'), title = el('Level 1: The Forked Frontier'), body = el('The relay has gone silent.');
  const card = { querySelector: (selector) => ({ '.eyebrow': eyebrow, h2: title, 'h2 + p': body })[selector] ?? null };
  const section = { querySelector: (selector) => (selector === '.level-intro-card' ? card : null) };
  assert.equal(applyHmhFrontierPreviewIntro(section, true), true);
  assert.deepEqual([eyebrow.textContent, title.textContent, body.textContent], [HMH_FRONTIER_PREVIEW_COPY.intro.eyebrow, HMH_FRONTIER_PREVIEW_COPY.intro.title, HMH_FRONTIER_PREVIEW_COPY.intro.body]);
  assert.doesNotMatch(`${title.textContent} ${body.textContent}`, /Forked|yard/);
  assert.match(body.textContent, /unranked/);
  assert.equal(applyHmhFrontierPreviewIntro(section, false), false);
  assert.deepEqual([eyebrow.textContent, title.textContent, body.textContent], ['Hard Money Heroes // Level 1', 'Level 1: The Forked Frontier', 'The relay has gone silent.']);
  assert.equal(applyHmhFrontierPreviewIntro(null, true), false);
  assert.match(main, /if \(active\) applyHmhFrontierPreviewIntro\(dom\.officialLevelIntro, hmhFrontierPreviewRequested\);/);
});
