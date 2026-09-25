// Chikun Weekly Jackpot, jackpot-ui slice: copy plumbing (design §D.6), the generated rules page
// /jackpot/chikun (design §D.4) with its legal and section guard, and the page's lazy module.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import {
  JACKPOT_CONTACT, JACKPOT_LEGAL_DRAFT, JACKPOT_RULES_SECTIONS, JACKPOT_TEST_TOKEN_SYMBOL, PORTAL_FLAGS,
  escapeHtml, jackpotRulesCopy, portalCopyFor,
} from '../apps/portal/src/portal-content.mjs';
import {
  JACKPOT_LEGAL_PENDING, JACKPOT_RULES_FILE, PORTAL_FLAG_OVERRIDES, PORTAL_GENERATED_FILES, buildPortalPages,
  parsePortalPagesArgs, renderJackpotRules, resolvePortalFlags, runPortalPagesCli, stalePortalPages,
} from '../scripts/build-portal-pages.mjs';
import { JACKPOT_LIVE, JACKPOT_RULES_PATH } from '../apps/portal/src/jackpot-config.mjs';
import { mountJackpotRules, nextCloseOf } from '../apps/portal/jackpot/chikun-rules.mjs';
import { resetJackpotMemo } from '../apps/portal/src/jackpot/jackpot-client.mjs';
import { fakeDocument, mountById, visibleText } from './helpers/jackpot-fake-dom.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const portal = join(root, 'apps', 'portal');
const builder = join(root, 'scripts', 'build-portal-pages.mjs');
const read = (path) => readFileSync(join(root, path), 'utf8');
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/jackpot/${name}.json`, import.meta.url), 'utf8'));
const template = read('apps/portal/jackpot/chikun.html');
const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
const jackpotLive = portalCopyFor(PORTAL_FLAG_OVERRIDES.jackpot);
const SOFT_NO_VALUE = 'Testnet zkLTC has no value. Any test prizes are paid in testnet tokens that also have no value.';
const LIVE_NO_VALUE = "Testnet zkLTC has no value. The only prize is the Chikun's Escape Weekly Jackpot, paid in tCHIKUN, a testnet token with no value; see the rules.";
// The reviewed-text path of the E10 flip, with a fixture legal block.
const REVIEWED_TEMPLATE = template.replace(/\s*<!-- LEGAL-REVIEW-PENDING[^>]*-->/, '');
const FIXTURE_LEGAL = Object.freeze({ title: 'Fixture reviewed rules', items: Object.freeze([Object.freeze(['Fixture.', 'Reviewed by counsel for this test only.'])]) });

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'jackpot-rules-'));
  try { return run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const readAll = (dir) => Object.fromEntries(PORTAL_GENERATED_FILES.map((name) => [name, readFileSync(join(dir, name), 'utf8')]));
const block = (html, key) => html.match(new RegExp(`<!-- copy:${key}:start -->([\\s\\S]*?)<!-- copy:${key}:end -->`))?.[1];
const responseOf = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => JSON.parse(JSON.stringify(body)) });

// The owner-requested legal draft, read straight from the binding design (§F.1).
function designLegalDraft() {
  const design = read('docs/game-design/chikun-weekly-jackpot-design-20260924.md');
  const section = design.slice(design.indexOf('### F.1'), design.indexOf('## G. Slice plan'));
  const quoted = section.split('\n').filter((line) => line.startsWith('> ')).map((line) => line.slice(2));
  return { title: quoted[0].replace(/\*\*/g, ''), items: quoted.slice(1).map((line) => line.replace(/^- /, '').replace(/\*\*/g, '')) };
}

test('copy plumbing: the jackpot flag, the optional third boolean and the jackpot override', () => {
  assert.equal(PORTAL_FLAGS.chikunJackpotLive, JACKPOT_LIVE);
  assert.deepEqual(resolvePortalFlags({ settlementLive: true, hostedProfileSync: true }), { settlementLive: true, hostedProfileSync: true }, 'the third boolean is optional');
  assert.deepEqual(resolvePortalFlags({ settlementLive: true, hostedProfileSync: true, chikunJackpotLive: true }), { settlementLive: true, hostedProfileSync: true, chikunJackpotLive: true });
  assert.deepEqual(resolvePortalFlags('jackpot'), { settlementLive: true, hostedProfileSync: true, chikunJackpotLive: true });
  assert.deepEqual(parsePortalPagesArgs(['--flags', 'jackpot']), { flags: 'jackpot' });
  // Every existing error message is kept.
  assert.throws(() => resolvePortalFlags('staging'), (error) => error instanceof RangeError && error.message === '--flags must be live or preview, got "staging"');
  assert.throws(() => resolvePortalFlags({ settlementLive: true, hostedProfileSync: true, chikunJackpotLive: 'yes' }), (error) => error instanceof TypeError && error.message === 'flags must be live, preview or {settlementLive, hostedProfileSync} booleans');
  // The live copy needs live settlement too (JACKPOT_LIVE => SETTLEMENT_LIVE).
  assert.deepEqual(portalCopyFor({ settlementLive: false, hostedProfileSync: true, chikunJackpotLive: true }), portalCopyFor({ settlementLive: false, hostedProfileSync: true }));
  assert.equal(jackpotRulesCopy({ settlementLive: false, chikunJackpotLive: true }).live, false);
  assert.ok(portalCopyFor(PORTAL_FLAG_OVERRIDES.jackpot).llmsScope.includes(`https://lestersarcade.io${JACKPOT_RULES_PATH}.`), 'the copy links the rules path of jackpot-config.mjs');
  assert.equal(JACKPOT_TEST_TOKEN_SYMBOL, /ERC20\("[^"]+", "([^"]+)"\)/.exec(read('contracts/src/TestChikunToken.sol'))[1], 'the copy names the deployed test token');
});

test('the soft-launch noValue line replaces "there are no prizes", and serverRecords gains the jackpot data', () => {
  const faq = launch.faq.find(([question]) => /cost money/.test(question))[1];
  for (const text of [faq, launch.trustStatus.join(' '), launch.llmsScope]) {
    assert.ok(text.includes(SOFT_NO_VALUE), text);
    assert.doesNotMatch(text, /there are no prizes/);
  }
  const storage = launch.trustStorage.join(' ');
  assert.match(storage, /the seed tickets issued for your Ranked runs/);
  assert.match(storage, /the Weekly Jackpot's review of your candidate runs, whose recorded inputs are published as replays once their week closes/);
  // Flag-independent: the lines are the same whatever JACKPOT_LIVE says.
  assert.equal(jackpotLive.trustStorage[0], launch.trustStorage[0]);
  assert.equal(launch.faq.some(([question]) => /jackpot/i.test(question)), false, 'no jackpot FAQ while the flag is off');
});

test('the live jackpot copy: noValue, the FAQ entry, trustStatus and llmsScope', () => {
  const faq = new Map(jackpotLive.faq);
  assert.ok(faq.get('Does Ranked cost money or pay prizes?').includes(LIVE_NO_VALUE));
  assert.match(faq.get('Is there a jackpot?'), /^Yes\. The Chikun's Escape Weekly Jackpot pays the best verified Ranked Chikun's Escape score of each funded week in tCHIKUN, a testnet token with no value, after a review by a person\. Entry fees do not fund the prize\. The rules are at lestersarcade\.io\/jackpot\/chikun\.$/);
  assert.deepEqual(jackpotLive.faq.map(([question]) => question).slice(3, 5), ['Does Ranked cost money or pay prizes?', 'Is there a jackpot?']);
  assert.equal(jackpotLive.trustStatus.length, launch.trustStatus.length);
  assert.ok(jackpotLive.trustStatus[2].endsWith(`${LIVE_NO_VALUE} Weekly Jackpot candidates are checked automatically and reviewed by a person before any payout, and every review decision is published on LitVM.`));
  assert.equal(jackpotLive.llmsScope.split('\n').length, launch.llmsScope.split('\n').length + 1, 'llmsScope gains one sentence');
  assert.match(jackpotLive.llmsScope, /The Chikun's Escape Weekly Jackpot pays the best verified Ranked Chikun's Escape score of each funded week in tCHIKUN, a testnet token with no value, after a review by a person; its rules are at https:\/\/lestersarcade\.io\/jackpot\/chikun\.$/);
  for (const text of [jackpotLive.faq.flat().join(' '), jackpotLive.trustStatus.join(' '), jackpotLive.llmsScope]) {
    assert.doesNotMatch(text, /\d[\d,]* tCHIKUN|guarantee|profit|invest|!/i, 'no amount and plain wording');
  }
});

test('the SPA copy leaves out the jackpot live lines, which only the page builder renders', async () => {
  // The live jackpot changes only the builder's FAQ, trust and llms copy...
  const changed = Object.keys(jackpotLive).filter((key) => JSON.stringify(jackpotLive[key]) !== JSON.stringify(launch[key])).sort();
  assert.deepEqual(changed, ['faq', 'llmsScope', 'trustStatus']);
  // ...which no SPA module reads (main.js and every browser module under apps/portal/src).
  const sources = ['apps/portal/main.js'];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== 'generated') walk(path); } else if (/\.m?js$/.test(entry.name) && path !== 'apps/portal/src/portal-content.mjs') sources.push(path);
    }
  };
  walk('apps/portal/src');
  for (const path of sources) assert.doesNotMatch(read(path), /\.(?:faq|trustStatus|llmsScope)\b|PORTAL_FAQ/, `${path} reads builder-only copy`);
  // So the SPA's PORTAL_COPY is built without them, and a minified bundle of it carries none of their
  // strings (they stay out of dist/main.js whatever JACKPOT_LIVE says).
  const { build } = await import('esbuild');
  const result = await build({
    stdin: { contents: "import { PORTAL_COPY } from './apps/portal/src/portal-content.mjs'; globalThis.copy = PORTAL_COPY;", resolveDir: root, loader: 'js' },
    bundle: true, minify: true, treeShaking: true, format: 'esm', write: false, logLevel: 'silent',
  });
  const bundle = result.outputFiles[0].text;
  for (const text of ['Is there a jackpot?', 'The only prize is', 'after a review by a person', 'Weekly Jackpot candidates are checked', 'Soft launch', 'LEGAL']) {
    assert.equal(bundle.includes(text), false, `the SPA bundle carries "${text}"`);
  }
  assert.ok(bundle.includes(SOFT_NO_VALUE), 'the flag-false honesty line stays in the SPA copy');
});

test('flag-false portal pages change only the named honesty lines', () => {
  // The committed flags keep JACKPOT_LIVE false: the committed pages equal the builder output, and the
  // only jackpot traces outside the rules page are the named lines and the hidden, empty containers.
  assert.deepEqual(stalePortalPages(), []);
  const pages = Object.fromEntries(PORTAL_GENERATED_FILES.map((name) => [name, readFileSync(join(portal, name), 'utf8')]));
  for (const [name, text] of Object.entries(pages)) {
    if (name === JACKPOT_RULES_FILE) continue;
    assert.doesNotMatch(text, /there are no prizes/, name);
    assert.doesNotMatch(text, /tCHIKUN|\/jackpot\/chikun|Is there a jackpot/i, `${name} names no jackpot while the flag is off`);
    const traces = text
      .replace(/the Weekly Jackpot(?:&#39;|')s review of your candidate runs/g, '')
      .replace(/<section id="jackpotPromo" class="jackpot-promo" aria-label="Weekly Jackpot" hidden><\/section>/g, '')
      .replace(/<div id="rankedEntryJackpot" class="ranked-entry-row ranked-entry-jackpot" hidden><\/div>/g, '');
    assert.doesNotMatch(traces, /jackpot/i, `${name}: only the named lines mention the jackpot`);
  }
  for (const name of ['index.html', 'trust.html', 'llms.txt', 'discover/chikun.html']) assert.ok(pages[name].includes(escapeHtml(SOFT_NO_VALUE)) || pages[name].includes(SOFT_NO_VALUE), name);
  assert.doesNotMatch(pages['sitemap.xml'], /jackpot/);
});

test('the rules page is noindex and out of the sitemap until live', () => {
  const page = read('apps/portal/jackpot/chikun.html');
  assert.match(page, /<meta name="robots" content="noindex" \/>/);
  assert.equal(block(page, 'jackpot-rules-banner'), escapeHtml("Soft launch: test prizes in tCHIKUN, a token with no value, may be paid to the week's top eligible Ranked Chikun player. Every payout is reviewed by hand."));
  for (const id of JACKPOT_RULES_SECTIONS) {
    assert.equal(page.split(`<!-- copy:jackpot-rules-${id}:start -->`).length, 2, `section ${id}`);
    assert.match(block(page, `jackpot-rules-${id}`), new RegExp(`<h2 id="rules-${id}-title">`), `section ${id} has its heading`);
  }
  assert.equal(JACKPOT_RULES_SECTIONS.length, 16);
  assert.doesNotMatch(read('apps/portal/sitemap.xml'), /jackpot/);
  assert.doesNotMatch(read('apps/portal/llms.txt'), /jackpot/i);
  // The legal block is the §F.1 draft, verbatim, with the pending comment beside it.
  const draft = designLegalDraft();
  assert.equal(JACKPOT_LEGAL_DRAFT.title, draft.title);
  assert.deepEqual(JACKPOT_LEGAL_DRAFT.items.map((item) => (Array.isArray(item) ? item.join(' ') : item)), draft.items);
  const legal = block(page, 'jackpot-legal');
  for (const line of [draft.title, ...draft.items]) assert.ok(legal.replace(/<[^>]+>/g, '').includes(escapeHtml(line)), line);
  assert.match(page, /<!-- LEGAL-REVIEW-PENDING: owner confirms at E10 -->\s*<!-- copy:jackpot-legal:start -->/, 'the guard comment sits beside the legal block');
  // Required disclosures (design §D.4).
  const text = page.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  for (const phrase of ['Louie', JACKPOT_CONTACT, '3,599 seconds', 'One person, one wallet', 'as people and not only as wallets', 'Entry fees do not fund the prize',
    'earliest', 'Monday at 00:00 UTC', 'within 6 hours', '12 hours', '24 hours', '72 hours', 'only unsophisticated automation', 'real time', 'within 7 days',
    'rolls into the next week', 'Fund only through the contract', 'can still change before that week starts', '180 days', 'at least one week of notice',
    'contest wallet 30 days', 'downloadable', 'provided as is', 'cannot be redeemed or exchanged', 'wiped at mainnet', 'Past weeks']) {
    if (phrase === 'earliest') { assert.match(text, /published on LitVM first, then to the lower session id/); continue; }
    if (phrase === 'downloadable') { assert.match(text, /replays of candidate runs that anyone can download once the week closes/); continue; }
    assert.ok(text.includes(phrase), phrase);
  }
  // CSP-safe static page: one module script, no inline script or handlers, absolute same-origin assets.
  const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.match(scripts[0][1], /type="module" src="\/jackpot\/chikun-rules\.mjs"/);
  assert.equal(scripts[0][2].trim(), '');
  assert.doesNotMatch(page, /\son[a-z]+\s*=|javascript:|(?:src|href)="(?:https?:)?\/\/(?!lestersarcade\.io)/i);
  assert.doesNotMatch(page, /\d[\d,]* tCHIKUN/, 'no static amount');
  const module = read('apps/portal/jackpot/chikun-rules.mjs');
  assert.doesNotMatch(module, /\.innerHTML\s*=|\beval\s*\(|new Function\s*\(|document\.write/);
  // Size. Design §D.3 budgets "static page + module <= 10 KB". The page (the 16 sections plus the
  // verbatim §F.1 legal draft) and the module are about 18.6 KB raw: an accepted deviation recorded in the
  // jackpot-ui handoff, not the design's meaning. This pins the transferred size (gzip) to the 10 KB row
  // and the raw size to its current ceiling, so neither grows silently.
  assert.ok(gzipSync(page).length + gzipSync(module).length <= 10_240, 'rules page + module, gzip');
  assert.ok(Buffer.byteLength(page) + Buffer.byteLength(module) <= 19_456, 'rules page + module, raw (19 KB ceiling; the 10 KB row is a recorded deviation)');
});

test('a live build refuses a rules page with the legal placeholder or a missing section', () => {
  withTempDir((dir) => {
    assert.throws(() => buildPortalPages({ flags: 'jackpot', outDir: dir }), new RegExp(`${JACKPOT_LEGAL_PENDING}.*E10`));
    const missing = REVIEWED_TEMPLATE.replace('<!-- copy:jackpot-rules-claims:start --><!-- copy:jackpot-rules-claims:end -->', '').replace(/<!-- copy:jackpot-rules-claims:start -->[\s\S]*?<!-- copy:jackpot-rules-claims:end -->/, '');
    assert.throws(() => buildPortalPages({ flags: 'jackpot', outDir: dir, sources: { [JACKPOT_RULES_FILE]: missing } }), /jackpot-rules-claims/);
    assert.throws(() => renderJackpotRules(missing, jackpotRulesCopy(PORTAL_FLAG_OVERRIDES.jackpot)), /jackpot-rules-claims/);
    // Reviewed text in place: the live build passes, indexes the page and lists it.
    buildPortalPages({ flags: 'jackpot', outDir: dir, sources: { [JACKPOT_RULES_FILE]: REVIEWED_TEMPLATE } });
    const pages = readAll(dir);
    const rules = pages[JACKPOT_RULES_FILE];
    assert.match(rules, /<meta name="robots" content="index, follow" \/>/);
    assert.doesNotMatch(rules, /LEGAL-REVIEW-PENDING|Soft launch/);
    assert.match(block(rules, 'jackpot-rules-banner'), /The Weekly Jackpot runs on the LitVM LiteForge testnet\. Prizes are paid in tCHIKUN, a testnet token with no value\./);
    assert.match(block(rules, 'jackpot-rules-history'), /load from the arcade server/);
    assert.match(pages['sitemap.xml'], /<url><loc>https:\/\/lestersarcade\.io\/jackpot\/chikun<\/loc><\/url>/);
    assert.match(pages['llms.txt'], /- \[Weekly Jackpot rules\]\(https:\/\/lestersarcade\.io\/jackpot\/chikun\): How the Chikun's Escape Weekly Jackpot works/);
    assert.ok(pages['index.html'].includes('<summary>Is there a jackpot?</summary>'));
    assert.ok(pages['trust.html'].includes(escapeHtml(LIVE_NO_VALUE)));
    // A fixture legal text renders in place of the draft (the owner-supplied text at E10).
    const withFixture = renderJackpotRules(REVIEWED_TEMPLATE, jackpotRulesCopy({ ...PORTAL_FLAG_OVERRIDES.jackpot, legal: FIXTURE_LEGAL }));
    assert.match(block(withFixture, 'jackpot-legal'), /<strong>Fixture reviewed rules<\/strong>[\s\S]*<strong>Fixture\.<\/strong> Reviewed by counsel for this test only\./);
  });
  // The CLI dry run of the flip refuses too, and never writes over the committed tree.
  withTempDir((dir) => {
    const result = spawnSync(process.execPath, [builder, '--flags', 'jackpot', '--out', dir], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /LEGAL-REVIEW-PENDING/);
    // Every page renders before any is written: a refused flip leaves no half-flipped page behind.
    assert.deepEqual(readdirSync(dir), []);
  });
  const lines = [];
  assert.equal(runPortalPagesCli(['--flags', 'jackpot'], { log: (line) => lines.push(line), error: (line) => lines.push(line) }), 1);
  assert.match(lines[0], /needs --out <dir>/);
});

test('the rules module renders local close times and addresses without a request while the flag is off', async () => {
  const documentRef = fakeDocument();
  const times = mountById(documentRef, 'p', 'jackpotRulesTimes', { hidden: true });
  const contracts = mountById(documentRef, 'dl', 'jackpotRulesContracts', { hidden: true });
  const summary = mountById(documentRef, 'p', 'jackpotRulesNow', { hidden: true });
  const history = mountById(documentRef, 'ol', 'jackpotRulesHistory', { hidden: true });
  const calls = [];
  const now = Date.parse('2026-10-01T12:00:00.000Z');
  assert.deepEqual(nextCloseOf(now), { closesAt: '2026-10-05T00:00:00.000Z', payoutAt: '2026-10-06T00:00:00.000Z' });
  assert.deepEqual(nextCloseOf(Date.parse('2026-10-05T00:00:00.000Z')), { closesAt: '2026-10-12T00:00:00.000Z', payoutAt: '2026-10-13T00:00:00.000Z' }, 'the close instant starts the next week');
  await mountJackpotRules({ documentRef, fetchImpl: async (url) => { calls.push(url); throw new Error('no request expected'); }, now: () => now, locale: 'en-US', timeZone: 'America/New_York' });
  assert.deepEqual(calls, [], 'no request to /api/jackpot while JACKPOT_LIVE is false');
  assert.equal(times.hidden, false);
  assert.equal(times.textContent, 'Where you are, this week closes Sun 8:00 PM EDT · Mon 00:00 UTC, and its prize is paid from Mon 8:00 PM EDT · Tue 00:00 UTC (24 hours later, unless the week is extended).');
  assert.equal(visibleText(contracts), 'ContractNot deployed yet.');
  assert.equal(summary.hidden, true);
  assert.equal(history.hidden, true);

  const deployed = { status: 'deployed', instances: { chikun: { address: `0x${'1a'.repeat(20)}`, token: { symbol: 'tCHIKUN', address: `0x${'7c'.repeat(20)}` }, retired: [{ address: `0x${'2b'.repeat(20)}`, token: { symbol: 'tCHIKUN' } }] } } };
  await mountJackpotRules({ documentRef, deployment: deployed, fetchImpl: async () => { throw new Error('no request expected'); }, now: () => now });
  const links = contracts.querySelectorAll('a');
  assert.deepEqual(links.map((anchor) => anchor.href), [`https://liteforge.explorer.caldera.xyz/address/0x${'1a'.repeat(20)}`, `https://liteforge.explorer.caldera.xyz/address/0x${'7c'.repeat(20)}`, `https://liteforge.explorer.caldera.xyz/address/0x${'2b'.repeat(20)}`]);
  assert.ok(links.every((anchor) => anchor.target === '_blank' && anchor.rel === 'noopener noreferrer'));
});

test('the live rules module shows the funded prize, the cap note and past weeks in their own tokens', async () => {
  const setup = () => {
    const documentRef = fakeDocument();
    return {
      documentRef,
      summary: mountById(documentRef, 'p', 'jackpotRulesNow', { hidden: true }),
      history: mountById(documentRef, 'ol', 'jackpotRulesHistory', { hidden: true }),
      times: mountById(documentRef, 'p', 'jackpotRulesTimes', { hidden: true }),
    };
  };
  const now = () => Date.parse('2026-10-01T12:00:00.000Z');
  resetJackpotMemo();
  let page = setup();
  await mountJackpotRules({ documentRef: page.documentRef, live: true, fetchImpl: async () => responseOf(fixture('open-funded-capped')), now, locale: 'en-US', timeZone: 'UTC' });
  assert.equal(visibleText(page.summary), 'ŁThis week, Sep 28 – Oct 4 · 5,000 tCHIKUN (testnet token, no value) · up to 5,000 tCHIKUN; the rest rolls over · closes in 3d 12h · top score 48,213 (provisional)');

  resetJackpotMemo();
  page = setup();
  await mountJackpotRules({ documentRef: page.documentRef, live: true, fetchImpl: async () => responseOf(fixture('open-unfunded')), now });
  assert.match(visibleText(page.summary), /No jackpot funded this week · closes in 3d 12h$/);
  assert.doesNotMatch(visibleText(page.summary), /tCHIKUN|top score/, 'no amount and no race for an unfunded week');

  resetJackpotMemo();
  page = setup();
  await mountJackpotRules({ documentRef: page.documentRef, live: true, fetchImpl: async () => responseOf(fixture('paid-history-two-tokens')), now });
  const rows = page.history.querySelectorAll('li').map((row) => visibleText(row));
  assert.equal(rows.length, 3);
  assert.match(rows[0], /^Sep 21 – Sep 27, 2026 · Paid · SkyChikun · 2,500 CHIKUN · Transaction$/, 'the previous week with no published candidate row');
  assert.match(rows[1], /^Sep 14 – Sep 20, 2026 · Paid · Lester Fan · 45,000 pts · 1,500 CHIKUN · Transaction · Watch$/);
  assert.match(rows[2], /^Sep 7 – Sep 13, 2026 · Paid · 0xb7b7…b7b7 · 61,234 pts · 9,000 tCHIKUN \(testnet token, no value\) · Transaction · Watch$/, 'a tCHIKUN week keeps its own token and note; a hidden name shows the short wallet');
  const watch = page.history.querySelector('a[href]');
  assert.ok(page.history.querySelectorAll('a').some((anchor) => /^\/chikun\/index\.html\?replay=%2Fapi%2Fjackpot%2Freplay%3Fsession%3D0x/.test(anchor.href)));
  assert.match(watch.href, /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x/);

  resetJackpotMemo();
  page = setup();
  await mountJackpotRules({ documentRef: page.documentRef, live: true, fetchImpl: async () => responseOf(fixture('claim-pending')), now });
  assert.match(visibleText(page.history), /Claim pending/);

  resetJackpotMemo();
  page = setup();
  await mountJackpotRules({ documentRef: page.documentRef, live: true, fetchImpl: async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) }), now });
  assert.equal(page.summary.hidden, true, 'a failed answer shows nothing');
  assert.equal(page.history.hidden, true);
  resetJackpotMemo();
});
