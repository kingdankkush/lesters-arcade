// The "How Ranked works" player guide (apps/portal/how-ranked-works.html, served
// at /how-ranked-works). Ranked-onboarding brief, acceptance criterion 2: the
// 8-step path, the price box, the faucet, Free vs Ranked, the checks per game,
// where a score shows up, the FAQ and the fixes, with FAQPage and HowTo data
// that match the visible text, built by scripts/build-portal-pages.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTAL_GENERATED_FILES, buildPortalPages } from '../scripts/build-portal-pages.mjs';
import { PORTAL_FLAGS } from '../apps/portal/src/portal-content.mjs';
import { RANKED_FACTS, RANKED_WORDING } from '../apps/portal/src/ranked-facts.mjs';
import {
  RANKED_GUIDE_FILE, RANKED_GUIDE_PATH, guidePlainText, rankedGuideCopy, rankedGuideSchema, renderGuideInline,
} from '../apps/portal/src/ranked-guide-content.mjs';

const portal = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const trust = readFileSync(join(portal, 'trust.html'), 'utf8');
const live = rankedGuideCopy({ settlementLive: true });
const preview = rankedGuideCopy({ settlementLive: false });

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (html) => html.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);
// Visible text: tags dropped, the screen-reader-only new-tab note removed, spaces collapsed.
const text = (html) => decode(html.replace(/<span class="visually-hidden">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const section = (html, id) => html.match(new RegExp(`<section id="${id}"[^>]*>([\\s\\S]*?)</section>`))?.[1] ?? '';
const jsonLd = (html) => JSON.parse(html.match(/<script id="guideStructuredData" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const meta = (html, attribute, key) => decode(html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`))?.[1] ?? '');

function withRender(flags, run) {
  const dir = mkdtempSync(join(tmpdir(), 'ranked-guide-'));
  try {
    buildPortalPages({ flags, outDir: dir });
    return run((name) => readFileSync(join(dir, name), 'utf8'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
// The launch render, whichever flags settlement.mjs carries (tests/portal-pages-build.test.mjs
// proves the committed pages equal the render for the committed flags).
const committed = withRender('live', (read) => read(RANKED_GUIDE_FILE));

test('the guide is a generated page, served at the clean path and listed in the sitemap', () => {
  assert.ok(PORTAL_GENERATED_FILES.includes(RANKED_GUIDE_FILE));
  assert.equal(RANKED_GUIDE_PATH, RANKED_FACTS.guidePath);
  assert.match(committed, /<link rel="canonical" href="https:\/\/lestersarcade\.io\/how-ranked-works" \/>/);
  assert.match(committed, /<meta name="robots" content="index, follow" \/>/);
  assert.match(committed, /<html lang="en">/);
  const sitemap = readFileSync(join(portal, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<url><loc>https:\/\/lestersarcade\.io\/how-ranked-works<\/loc><\/url>/);
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrite = vercel.rewrites.findIndex((entry) => entry.source === '/how-ranked-works');
  assert.equal(vercel.rewrites[rewrite].destination, '/how-ranked-works.html');
  // No noindex header covers it.
  for (const rule of vercel.headers.filter((entry) => entry.headers.some((header) => header.key === 'X-Robots-Tag'))) {
    assert.doesNotMatch('/how-ranked-works', new RegExp(`^${rule.source.replace(/:\w+\*/g, '.*')}$`), rule.source);
  }
});

test('the live guide walks the 8 steps the brief names, in order', () => {
  assert.equal(live.live, true);
  assert.deepEqual(live.steps.map((step) => step.name), [
    'Play Free now', 'Connect a wallet', 'Let the site add LitVM', 'Get free zkLTC from the faucet',
    'Sign in with a free signature', 'Choose Ranked and pay 0.012', 'Play. Your run is checked', 'It is published',
  ]);
  const steps = section(committed, 'steps');
  assert.equal(steps.match(/<li id="step-\d">/g).length, 8);
  for (const [index, step] of live.steps.entries()) {
    assert.ok(text(steps).includes(`Step ${index + 1}:`) === false, 'the visually hidden step label is not visible text');
    assert.match(steps, new RegExp(`<span class="visually-hidden">Step ${index + 1}: </span>`));
    assert.ok(text(steps).includes(guidePlainText(step.text)), step.name);
  }
  assert.match(text(steps), /MetaMask, Rabby, OKX Wallet or another browser wallet, or WalletConnect/);
  assert.match(text(steps), /chain 4441/);
  assert.match(text(steps), /costs nothing and sends no transaction/);
  assert.match(text(steps), /leaderboards, your profile and your achievements, with a share card/);
});

test('the price box, the faucet call to action and Free vs Ranked state the facts', () => {
  const price = text(section(committed, 'price'));
  assert.match(price, /^What a Ranked run costs 0\.012 testnet zkLTC per run Entry 0\.01 zkLTC .*85% to the game's developer and 15% to the arcade\. Publishing 0\.002 zkLTC .* Total 0\.012 zkLTC/);
  assert.match(price, /Testnet zkLTC has no monetary value\./);
  assert.match(price, /exact amount from the entry contract/);

  const faucet = section(committed, 'faucet');
  assert.ok(text(faucet).includes(RANKED_WORDING.faucet));
  assert.match(faucet, /<a class="guide-button" href="https:\/\/liteforge\.hub\.caldera\.xyz" target="_blank" rel="noopener noreferrer">Open the LiteForge faucet<span class="visually-hidden"> \(opens in a new tab\)<\/span><\/a>/);

  const table = section(committed, 'free-vs-ranked');
  assert.match(table, /<table class="guide-table"><caption>/);
  assert.match(table, /<th scope="col">Free<\/th><th scope="col">Ranked<\/th>/);
  for (const [row, free, ranked] of [['Cost', 'Nothing', '0.012 testnet zkLTC per run'], ['Wallet', 'Not needed', 'one free sign-in signature'], ['Chain', 'Never touches the chain', 'Published on LitVM'], ['Leaderboards', 'Not ranked', 'Weekly, Monthly and All-time boards'], ['Achievements', 'Not earned', 'Earned from verified runs']]) {
    assert.match(text(table), new RegExp(`${row} ${free}[^|]*${ranked.replace(/[.]/g, '\\.')}`), row);
  }
});

test('the checks section says what is verified for each game', () => {
  const checks = text(section(committed, 'checks'));
  assert.match(checks, /random seed from the server/);
  assert.match(checks, /Chikun's Escape Your recorded inputs are replayed on the server\./);
  assert.match(checks, /STACKED Your recorded inputs are replayed on the server\./);
  assert.match(checks, /Hard Money Heroes Your run summary is plausibility-checked against the game's limits\. It is not replayed/);
});

test('where a score shows up: results, boards with their resets, profile, achievements, share card', () => {
  const where = text(section(committed, 'where'));
  for (const lead of ['Results screen', 'Leaderboards', 'Your profile', 'Achievements', 'Share card']) assert.ok(where.includes(lead), lead);
  assert.match(where, /Weekly boards reset every Monday 00:00 UTC/);
  assert.match(where, /124 in all: 44 in Hard Money Heroes, 40 in Chikun's Escape and 40 in STACKED/);
  assert.match(where, /Each score shows the game version it was played on\./);
  assert.match(section(committed, 'where'), /href="\/scores"/);
  assert.match(section(committed, 'where'), /href="\/profile"/);
});

test('the FAQ answers every question the brief lists', () => {
  const questions = live.questions.map(([question]) => question);
  const required = [
    [/real money/i, /no monetary value/], [/wallet/i, /identity/], [/two numbers/i, /0\.01 entry .* 0\.002/],
    [/how long .*publishing/i, /about a minute/], [/payment or a run fails/i, /not refunded/], [/phone/i, /WalletConnect/],
    [/which wallets/i, /MetaMask/], [/my fee/i, /85% to the game's developer and 15% to the arcade/],
    [/leaderboards reset/i, /Monday 00:00 UTC/], [/achievements/i, /124 achievements: 44 .* 40 .* 40/], [/game version/i, /version it was played on/],
  ];
  for (const [question, answer] of required) {
    const match = live.questions.find(([name]) => question.test(name));
    assert.ok(match, `a question matching ${question}`);
    assert.match(match[1], answer, match[0]);
  }
  assert.equal(new Set(questions).size, questions.length);
  const faq = section(committed, 'faq');
  assert.equal(faq.match(/<details>/g).length, live.questions.length);
  for (const [question, answer] of live.questions) {
    assert.ok(faq.includes(`<details><summary>${renderGuideInline(question)}</summary><p>${renderGuideInline(answer)}</p></details>`), question);
  }
});

test('the fixes cover every problem the brief lists', () => {
  const fixes = section(committed, 'fixes');
  const leads = [...fixes.matchAll(/<li><h3>([^<]+)<\/h3>/g)].map((match) => decode(match[1]));
  assert.deepEqual(leads, ['Wrong network', 'Not enough zkLTC', 'The wallet asks for a high fee or refuses', 'Payment done, result pending', 'Run not accepted', 'Browser closed during a run']);
  assert.match(text(fixes), /Switch to LiteForge/);
  assert.match(text(fixes), /Re-check/);
  assert.match(text(fixes), /Nothing is charged when you cancel\./);
  assert.match(text(fixes), /Never share your seed phrase or private key\./);
  assert.match(fixes, /href="\/trust\.html#support"/);
});

test('the structured data is the visible text: WebPage, HowTo and FAQPage', () => {
  const graph = jsonLd(committed)['@graph'];
  assert.deepEqual(graph.map((node) => node['@type']), ['WebPage', 'HowTo', 'FAQPage']);
  assert.deepEqual(jsonLd(committed), JSON.parse(rankedGuideSchema(live)));
  assert.doesNotMatch(rankedGuideSchema({ ...live, description: '</script><b>' }), /<\/script>|<b>/, 'a < in the copy cannot close the script');
  const [page, howTo, faqPage] = graph;
  assert.equal(page.url, 'https://lestersarcade.io/how-ranked-works');
  assert.equal(page.description, meta(committed, 'name', 'description'));
  assert.equal(page.name, decode(committed.match(/<title>([^<]+)<\/title>/)[1]));
  const visible = text(committed);
  assert.equal(howTo.step.length, 8);
  for (const [index, step] of howTo.step.entries()) {
    assert.equal(step.position, index + 1);
    assert.equal(step.url, `https://lestersarcade.io/how-ranked-works#step-${index + 1}`);
    assert.ok(visible.includes(step.name) && visible.includes(step.text), step.name);
  }
  assert.equal(faqPage.mainEntity.length, live.questions.length);
  for (const entry of faqPage.mainEntity) {
    assert.equal(entry['@type'], 'Question');
    assert.ok(visible.includes(entry.name) && visible.includes(entry.acceptedAnswer.text), entry.name);
  }
  for (const [attribute, key] of [['name', 'description'], ['property', 'og:description'], ['name', 'twitter:description']]) {
    assert.equal(meta(committed, attribute, key), live.description, key);
  }
});

test('every number on the guide is a Ranked fact, and it promises nothing it should not', () => {
  const visible = text(committed);
  const amounts = new Set([...visible.matchAll(/\b(\d+\.\d+) (?:testnet )?zkLTC/g)].map((match) => match[1]));
  assert.deepEqual([...amounts].sort(), [RANKED_FACTS.entryZkLtc, RANKED_FACTS.publishZkLtc, RANKED_FACTS.totalZkLtc].sort());
  assert.ok(visible.includes(`${RANKED_FACTS.faucetZkLtc} per request`));
  assert.doesNotMatch(committed, /0\.102|0\.1 zkLTC|jackpot|prize|reward|\bNFTs?\b|soulbound|mainnet|airdrop|guarantee/i);
  assert.doesNotMatch(visible, /\b20\d\d\b|!/, 'no dates and no exclamation marks');
});

test('the page is accessible: landmarks, headings, unique ids, labelled sections and working anchors', () => {
  assert.match(committed, /<a class="skip-link" href="#main">Skip to content<\/a>/);
  assert.match(committed, /<main id="main" tabindex="-1">/);
  assert.equal(committed.match(/<h1>/g).length, 1);
  assert.match(committed, /<nav class="guide-topbar" aria-label="Lester's Arcade">/);
  assert.match(committed, /<footer class="guide-footer">/);
  const ids = [...committed.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const match of committed.matchAll(/<section id="([^"]+)"[^>]*aria-labelledby="([^"]+)"/g)) assert.ok(ids.includes(match[2]), `${match[1]} heading`);
  for (const match of committed.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), `#${match[1]} exists`);
  for (const match of committed.matchAll(/href="\/trust\.html#([^"]+)"/g)) assert.match(trust, new RegExp(`id="${match[1]}"`), `trust.html#${match[1]}`);
  for (const match of committed.matchAll(/<a [^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/g)) {
    assert.match(match[0], /rel="noopener noreferrer"/);
    assert.match(match[0], /<span class="visually-hidden"> \(opens in a new tab\)<\/span>/);
  }
  for (const match of committed.matchAll(/<img [^>]*>/g)) assert.match(match[0], /alt="[^"]+"/);
  assert.doesNotMatch(committed, /<script(?! id="guideStructuredData" type="application\/ld\+json")/, 'no script runs on the guide');
  const css = readFileSync(join(portal, 'how-ranked-works.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-height: 44px/);
  assert.match(committed, /href="\/how-ranked-works\.css\?v=[^"]+"/);
});

test('without live settlement the guide says Ranked is in preview and states no price', () => {
  assert.equal(preview.live, false);
  assert.deepEqual([preview.steps.length, preview.questions.length], [0, 0]);
  withRender('preview', (read) => {
    const html = read(RANKED_GUIDE_FILE);
    const visible = text(html);
    assert.match(visible, /Ranked is in preview right now: nothing is charged and no Ranked run is published on LitVM\./);
    assert.ok(visible.includes(RANKED_WORDING.free));
    assert.doesNotMatch(visible, /\d\.\d+ (?:testnet )?zkLTC|faucet|0\.012/i);
    assert.deepEqual(jsonLd(html)['@graph'].map((node) => node['@type']), ['WebPage']);
    assert.match(read('sitemap.xml'), /how-ranked-works/);
  });
});

test('the committed page carries the copy for the committed flags', () => {
  const page = readFileSync(join(portal, RANKED_GUIDE_FILE), 'utf8');
  assert.equal(page.includes('Play Ranked in 8 steps'), PORTAL_FLAGS.settlementLive);
});
