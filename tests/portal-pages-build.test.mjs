import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  PORTAL_GENERATED_FILES, buildPortalPages, parsePortalPagesArgs, renderCopyBlock, resolvePortalFlags, runPortalPagesCli, stalePortalPages,
} from '../scripts/build-portal-pages.mjs';
import { PORTAL_FLAGS, PORTAL_GAMES, escapeHtml, portalCopyFor } from '../apps/portal/src/portal-content.mjs';

const portal = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const builder = fileURLToPath(new URL('../scripts/build-portal-pages.mjs', import.meta.url));
const INDEX_BLOCKS = ['how-intro', 'how-connect-title', 'how-connect', 'how-connect-action', 'how-profile', 'scores-lead', 'scores-note', 'scores-wallet', 'mode-copy', 'mode-ranked'];
const TRUST_BLOCKS = ['ranked-storage', 'ranked-status'];
const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
// The flag state that settlement.mjs does not carry, so these tests hold both
// before and after the step-7 flip (no slice test changes at the flip).
const OTHER_FLAGS = PORTAL_FLAGS.settlementLive ? 'preview' : 'live';
const FLAG_DEPENDENT_FILES = ['index.html', 'trust.html', 'llms.txt', 'manifest.webmanifest', 'discover/games.html', ...PORTAL_GAMES.map(game => `discover/${game.slug}.html`)];
const captureConsole = () => {
  const lines = { log: [], error: [] };
  return { lines, output: { log: text => lines.log.push(text), error: text => lines.error.push(text) } };
};

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'portal-pages-'));
  try { return run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const readAll = dir => Object.fromEntries(PORTAL_GENERATED_FILES.map(name => [name, readFileSync(join(dir, name), 'utf8')]));
// The Ranked modal and the sign-in button belong to the signin-entry slice; its
// static modal text is outside the generated copy, so the page checks skip it.
const withoutModal = html => html.replace(/<div id="rankedEntryModal"[\s\S]*?(?=<nav\b)/, '');
const block = (html, key) => html.match(new RegExp(`<!-- copy:${key}:start -->([\\s\\S]*?)<!-- copy:${key}:end -->`))?.[1];
const metaContent = (html, attribute, key) => html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`))?.[1];
const structuredData = html => JSON.parse(html.match(/<script id="portalStructuredData" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test('committed pages equal the builder output for the current flags', () => {
  withTempDir(dir => {
    buildPortalPages({ outDir: dir });
    const built = readAll(dir);
    for (const name of PORTAL_GENERATED_FILES) {
      assert.equal(built[name], readFileSync(join(portal, name), 'utf8'), `${name} is stale: run node scripts/build-portal-pages.mjs`);
    }
  });
});

test('each copy block exists exactly once in the committed sources', () => {
  const index = readFileSync(join(portal, 'index.html'), 'utf8');
  const trust = readFileSync(join(portal, 'trust.html'), 'utf8');
  for (const [html, keys] of [[index, INDEX_BLOCKS], [trust, TRUST_BLOCKS]]) {
    for (const key of keys) {
      assert.equal(html.split(`<!-- copy:${key}:start -->`).length, 2, `${key} start marker`);
      assert.equal(html.split(`<!-- copy:${key}:end -->`).length, 2, `${key} end marker`);
    }
  }
  const copy = portalCopyFor(PORTAL_FLAGS);
  assert.equal(block(index, 'scores-note'), escapeHtml(copy.scoresNote));
  assert.equal(block(index, 'mode-copy'), escapeHtml(copy.modeSelect['lester-blaster'].copy));
  assert.equal(block(index, 'mode-ranked'), escapeHtml(copy.modeSelect['lester-blaster'].ranked));
});

test('the live render states the launch copy and drops the preview copy', () => {
  withTempDir(dir => {
    buildPortalPages({ flags: 'live', outDir: dir });
    const pages = readAll(dir);
    const index = pages['index.html'];
    for (const [attribute, key] of [['name', 'description'], ['property', 'og:description'], ['name', 'twitter:description']]) {
      assert.equal(metaContent(index, attribute, key), escapeHtml(launch.description), key);
    }
    assert.match(launch.description, /0\.102 testnet zkLTC per run, with verified scores published on LitVM/);
    const website = structuredData(index)['@graph'].find(node => node['@type'] === 'WebSite');
    assert.equal(website.description, launch.description);
    for (const [question, answer] of launch.faq) assert.ok(index.includes(`<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`), question);
    assert.match(index, /0\.102 zkLTC per run on the LitVM LiteForge testnet: a 0\.1 zkLTC entry, split 85% to the game&#39;s developer and 15% to the arcade, plus a 0\.002 zkLTC settlement reserve/);
    assert.match(index, /Hard Money Heroes runs are plausibility-checked against the game&#39;s limits; they are not replayed\./);
    assert.match(block(index, 'scores-lead'), /global Weekly, Monthly, and All-time leaderboards/);
    assert.equal(block(index, 'mode-ranked'), escapeHtml(launch.modeSelect['lester-blaster'].ranked));

    const trust = pages['trust.html'];
    assert.match(block(trust, 'ranked-status'), /Ranked is live on the LitVM LiteForge testnet\. A Ranked run costs 0\.102 zkLTC/);
    assert.match(block(trust, 'ranked-status'), /Chikun&#39;s Escape and STACKED runs are replayed from their recorded inputs/);
    assert.match(block(trust, 'ranked-status'), /Hard Money Heroes runs are plausibility-checked against the game&#39;s limits and are not replayed/);
    assert.match(block(trust, 'ranked-status'), /Testnet entries are not refunded\./);
    assert.match(block(trust, 'ranked-storage'), /Neon Postgres database: your wallet address; your verified Ranked sessions with their evidence/);
    assert.match(block(trust, 'ranked-storage'), /keyed hashes \(HMAC\) of IP addresses in short time windows, not raw IP addresses/);

    assert.match(pages['llms.txt'], /## Current scope\nRanked costs 0\.102 zkLTC per run/);
    assert.match(pages['llms.txt'], /How it works\]\(https:\/\/lestersarcade\.io\/#how-it-works\): Free play with no wallet, and wallet sign-in for Ranked runs on the LitVM testnet\./);
    assert.equal(JSON.parse(pages['manifest.webmanifest']).description, launch.description);
    assert.match(pages['discover/hard-money-heroes.html'], /the arcade server plausibility-checks each run \(it is not replayed\) before publishing it on LitVM/);
    for (const slug of ['chikun', 'stacked']) assert.match(pages[`discover/${slug}.html`], /the arcade server replays each run from your inputs before publishing it on LitVM/);
    assert.match(pages['discover/games.html'], new RegExp(`<meta name="description" content="${escapeHtml(launch.description).replace(/[.()]/g, '\\$&')}"`));

    const launchStrings = new Set([...Object.values(launch).flat(2)].filter(value => typeof value === 'string'));
    const previewStatements = [preview.description, preview.scoresLead, preview.scoresNote, preview.scoresWallet, preview.howIntro, preview.howConnect, preview.howProfile, ...Object.values(preview.modeSelect).flatMap(entry => [entry.copy, entry.ranked]), preview.modeRanked, preview.llmsScope, preview.llmsHowItWorks, ...preview.faq.map(([, answer]) => answer), ...preview.trustStatus, ...preview.trustStorage, ...Object.values(preview.rankedDetail)]
      .filter(statement => !launchStrings.has(statement));
    assert.ok(previewStatements.length > 15);
    for (const [name, text] of Object.entries(pages)) {
      const page = withoutModal(text);
      assert.doesNotMatch(page, /device-local|\byearly\b|SETTLEMENT_LIVE=false|No score transaction is sent|temporarily disabled/i, `${name} keeps preview wording`);
      assert.doesNotMatch(page, /\bNFTs?\b|soulbound/i, `${name} uses NFT wording (contract A32)`);
      for (const statement of previewStatements) {
        for (const form of new Set([statement, escapeHtml(statement)])) assert.ok(!page.includes(form), `${name} still says: ${statement}`);
      }
    }
  });
});

test('the preview render keeps the preview wording and names no board period', () => {
  withTempDir(dir => {
    buildPortalPages({ flags: 'preview', outDir: dir });
    const pages = readAll(dir);
    assert.equal(metaContent(pages['index.html'], 'name', 'description'), escapeHtml(preview.description));
    // The preview Scores page still offers other time windows until the
    // profile-boards slice drops its tabs, so the preview lead names none.
    assert.match(block(pages['index.html'], 'scores-lead'), /^See your Ranked preview records on this device&#39;s scoreboards\./);
    assert.doesNotMatch(block(pages['index.html'], 'scores-lead'), /daily|weekly|monthly|yearly|all-time/i);
    assert.match(block(pages['index.html'], 'scores-note'), /device-local previews today/);
    assert.match(block(pages['trust.html'], 'ranked-status'), /<code>SETTLEMENT_LIVE=false<\/code>/);
    assert.match(block(pages['trust.html'], 'ranked-storage'), /stay in this browser/);
    assert.match(pages['llms.txt'], /No entry fees, prizes, global rankings, cross-device history, or on-chain score publishing are available\./);
    for (const [name, text] of Object.entries(pages)) {
      assert.doesNotMatch(withoutModal(text), /\byearly\b|0\.102|Neon Postgres|plausibility/i, name);
    }
  });
});

test('the flag override accepts only live or preview, and markers must be unique', () => {
  assert.equal(resolvePortalFlags(undefined), PORTAL_FLAGS);
  assert.deepEqual(resolvePortalFlags('live'), { settlementLive: true, hostedProfileSync: true });
  assert.deepEqual(resolvePortalFlags('preview'), { settlementLive: false, hostedProfileSync: false });
  for (const bad of ['on', 'true', '', 1, { settlementLive: 'yes', hostedProfileSync: true }]) assert.throws(() => resolvePortalFlags(bad));
  assert.deepEqual(parsePortalPagesArgs(['--flags', 'live']), { flags: 'live' });
  assert.deepEqual(parsePortalPagesArgs(['--flags=preview']), { flags: 'preview' });
  assert.deepEqual(parsePortalPagesArgs(['--check', '--flags', 'live']), { check: true, flags: 'live' });
  assert.throws(() => parsePortalPagesArgs(['--flags', 'staging']), /live or preview/);
  assert.throws(() => parsePortalPagesArgs(['--flags']), /needs a value/);
  assert.throws(() => parsePortalPagesArgs(['--live']), /unknown argument/);
  assert.equal(renderCopyBlock('<p><!-- copy:a:start -->old<!-- copy:a:end --></p>', 'a', 'new &amp; $1'), '<p><!-- copy:a:start -->new &amp; $1<!-- copy:a:end --></p>');
  assert.throws(() => renderCopyBlock('<p>no markers</p>', 'a', 'x'), /exactly one/);
  assert.throws(() => renderCopyBlock('<!-- copy:a:start --><!-- copy:a:end --><!-- copy:a:start --><!-- copy:a:end -->', 'a', 'x'), /exactly one/);
});

test('the CLI writes an overridden render only to --out and leaves the committed pages alone', () => {
  withTempDir(dir => {
    const before = readAll(portal);
    const result = spawnSync(process.execPath, [builder, '--flags', 'live', '--out', dir], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /launch copy/);
    assert.equal(result.stderr, '');
    assert.match(readFileSync(join(dir, 'trust.html'), 'utf8'), /Neon Postgres database/);
    assert.deepEqual(readAll(portal), before);
    for (const game of PORTAL_GAMES) assert.match(readFileSync(join(dir, `discover/${game.slug}.html`), 'utf8'), /0\.102 testnet zkLTC per run/);
  });
});

test('check mode reports stale pages without writing anything, whichever flags are committed', () => {
  const before = readAll(portal);
  assert.deepEqual(stalePortalPages(), [], 'the committed pages are current');
  const staleForOther = stalePortalPages({ flags: OTHER_FLAGS });
  for (const name of FLAG_DEPENDENT_FILES) assert.ok(staleForOther.includes(name), `${name} changes when the flags flip`);
  assert.ok(!staleForOther.includes('sitemap.xml') && !staleForOther.includes('robots.txt'), 'the sitemap and robots file do not depend on the flags');
  withTempDir(dir => {
    buildPortalPages({ flags: OTHER_FLAGS, outDir: dir });
    assert.deepEqual(stalePortalPages({ flags: OTHER_FLAGS, outDir: dir }), []);
    assert.deepEqual(stalePortalPages({ outDir: dir }).sort(), [...staleForOther].sort());
  });
  const current = spawnSync(process.execPath, [builder, '--check'], { encoding: 'utf8' });
  assert.equal(current.status, 0, current.stderr);
  assert.equal(current.stdout.trim(), `Generated pages match the ${portalCopyFor(PORTAL_FLAGS).state} copy from settlement.mjs.`);
  const otherCheck = spawnSync(process.execPath, [builder, '--check', '--flags', OTHER_FLAGS], { encoding: 'utf8' });
  assert.equal(otherCheck.status, 1);
  const otherState = portalCopyFor(resolvePortalFlags(OTHER_FLAGS)).state;
  assert.match(otherCheck.stderr, new RegExp(`^Generated pages differ from the ${otherState} copy from --flags ${OTHER_FLAGS}: index\\.html, .*trust\\.html`));
  assert.match(otherCheck.stderr, /That is expected until settlement\.mjs carries these flags/);
  assert.deepEqual(readAll(portal), before);
});

test('check mode tells a stale tree to rebuild and commit', () => {
  withTempDir(dir => {
    buildPortalPages({ outDir: dir });
    writeFileSync(join(dir, 'llms.txt'), 'stale');
    const { lines, output } = captureConsole();
    assert.equal(runPortalPagesCli(['--check', '--out', dir], output), 1);
    assert.deepEqual(lines.error, [`Generated pages differ from the ${portalCopyFor(PORTAL_FLAGS).state} copy from settlement.mjs: llms.txt. Run node scripts/build-portal-pages.mjs and commit the output.`]);
  });
});

test('the CLI refuses to write flipped pages over the committed tree', () => {
  const before = readAll(portal);
  const { lines, output } = captureConsole();
  assert.equal(runPortalPagesCli(['--flags', OTHER_FLAGS], output), 1);
  assert.deepEqual(lines.error, [`--flags ${OTHER_FLAGS} differs from settlement.mjs, so it needs --out <dir>; the committed apps/portal pages always follow settlement.mjs.`]);
  assert.deepEqual(lines.log, []);
  const spawned = spawnSync(process.execPath, [builder, `--flags=${OTHER_FLAGS}`], { encoding: 'utf8' });
  assert.equal(spawned.status, 1);
  assert.match(spawned.stderr, /needs --out <dir>/);
  assert.deepEqual(readAll(portal), before);
});

test('a rebuild rewrites only the files whose content changed', () => {
  // build.mjs rebuilds the committed pages during npm test while other test
  // files read them, so a current file must never be truncated and rewritten.
  withTempDir(dir => {
    buildPortalPages({ outDir: dir });
    const old = new Date('2001-01-01T00:00:00Z');
    for (const name of PORTAL_GENERATED_FILES) utimesSync(join(dir, name), old, old);
    writeFileSync(join(dir, 'llms.txt'), 'stale');
    buildPortalPages({ outDir: dir });
    for (const name of PORTAL_GENERATED_FILES) {
      const { mtimeMs } = statSync(join(dir, name));
      if (name === 'llms.txt') assert.ok(mtimeMs > old.getTime(), 'the changed file is rewritten');
      else assert.equal(mtimeMs, old.getTime(), `${name} was rewritten although it was current`);
    }
    assert.deepEqual(stalePortalPages({ outDir: dir }), []);
  });
});
