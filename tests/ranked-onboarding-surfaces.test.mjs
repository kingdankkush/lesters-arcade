// Every surface the ranked-onboarding brief (2026-09-26) asks to explain Ranked:
// the homepage path, the mode select, the game pages, the Ranked modal and the
// wallet prompts, the trust page, llms.txt, the README and the developer docs.
// Numbers come from apps/portal/src/ranked-facts.mjs (tests/ranked-facts.test.mjs
// ties those to the contracts, the server floor, the faucet and the catalogs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPortalPages } from '../scripts/build-portal-pages.mjs';
import { PORTAL_GAMES, portalCopyFor, portalSchema } from '../apps/portal/src/portal-content.mjs';
import { FAUCET_CHIP_TEXT, FAUCET_LINK_TEXT, RANKED_FACTS, RANKED_WORDING } from '../apps/portal/src/ranked-facts.mjs';
import { rankedSurfaceCopy } from '../apps/portal/src/ranked-guide-content.mjs';
import { classifyWalletError, walletErrorAction } from '../apps/portal/src/wallet-auth.mjs';
import { renderBalanceChip } from '../apps/portal/src/wallet-chips.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (html) => html.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);
const text = (html) => decode(html.replace(/<span class="visually-hidden">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const block = (html, key) => html.match(new RegExp(`<!-- copy:${key}:start -->([\\s\\S]*?)<!-- copy:${key}:end -->`))?.[1];
const FAUCET_LINK = /<a [^>]*href="https:\/\/liteforge\.hub\.caldera\.xyz" target="_blank" rel="noopener noreferrer">[^<]+<span class="visually-hidden"> \(opens in a new tab\)<\/span><\/a>/;

function render(flags) {
  const dir = mkdtempSync(join(tmpdir(), 'ranked-surfaces-'));
  try {
    buildPortalPages({ flags, outDir: dir });
    const pages = {};
    for (const name of ['index.html', 'trust.html', 'llms.txt', 'sitemap.xml', 'discover/games.html', ...PORTAL_GAMES.map((game) => `discover/${game.slug}.html`)]) pages[name] = readFileSync(join(dir, name), 'utf8');
    return pages;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const live = render('live');
const previewPages = render('preview');

test('the homepage leads with Play free now, then a three-step Play Ranked path to the guide', () => {
  const index = live['index.html'];
  const actions = index.match(/<div class="portal-actions">([\s\S]*?)<\/div>/)[1];
  assert.match(actions, /^\s*<a id="officialGuestEnterButton" class="portal-button" href="\/games">Play free now<\/a>\s*<button id="officialConnectButton" class="portal-button portal-button-outline" type="button">Sign in<\/button>/);
  const strip = block(index, 'home-ranked');
  assert.match(index, /<div class="portal-ranked-path" role="group" aria-labelledby="homeRankedTitle"><!-- copy:home-ranked:start -->/);
  const steps = [...strip.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
  assert.equal(steps.length, 3);
  assert.match(steps[0], /^<button type="button" class="portal-ranked-step" data-portal-connect><span class="portal-ranked-step-number" aria-hidden="true">1<\/span>Connect a wallet<\/button>$/);
  assert.match(steps[1], /^<a class="portal-ranked-step" href="https:\/\/liteforge\.hub\.caldera\.xyz" target="_blank" rel="noopener noreferrer">[\s\S]*<span class="visually-hidden"> \(opens in a new tab\)<\/span><\/a>$/);
  assert.equal(text(steps[1]), '2 Get free zkLTC');
  assert.match(steps[2], /href="\/games"/);
  assert.equal(text(steps[2]), `3 Play Ranked, ${RANKED_FACTS.totalZkLtc} zkLTC`);
  assert.match(strip, /<a class="portal-text-link" href="\/how-ranked-works">How Ranked works →<\/a>$/);
  // The strip sits in the hero, after the Free actions: Free stays the primary path.
  assert.ok(index.indexOf('officialGuestEnterButton') < index.indexOf('portal-ranked-path'));
  const heroCopy = index.match(/<div class="portal-hero-copy">([\s\S]*?)<figure class="portal-hero-film">/)[1];
  assert.ok(heroCopy.includes('portal-ranked-path'), 'the Ranked path is part of the hero');
});

test('without live settlement the homepage path says Ranked is in preview and names no price', () => {
  const strip = block(previewPages['index.html'], 'home-ranked');
  assert.doesNotMatch(strip, /<ol|zkLTC|faucet/i);
  assert.match(text(strip), /Ranked is in preview right now: nothing is charged and no run is published on chain\./);
  assert.match(strip, /href="\/how-ranked-works"/);
});

test('the homepage FAQ and How it works point to the faucet and the guide', () => {
  const faucetAnswer = launch.faq.find(([question]) => question === 'Where do I get zkLTC for Ranked?')?.[1];
  assert.equal(faucetAnswer, `${RANKED_WORDING.faucet} ${RANKED_WORDING.value} The player guide at lestersarcade.io/how-ranked-works walks through every step, from connecting a wallet to your first Ranked run.`);
  assert.ok(!preview.faq.some(([question]) => /zkLTC/.test(question)), 'the preview has no faucet question');
  // The homepage structured data describes the site with the same description the meta tags carry.
  const website = JSON.parse(portalSchema('/', launch))['@graph'].find((node) => node['@type'] === 'WebSite');
  assert.equal(website.description, launch.description);
  assert.ok(text(live['index.html']).includes(faucetAnswer));
  assert.ok(launch.howConnect.endsWith(RANKED_WORDING.faucet));
});

test('the mode select states Free and Ranked prices and links the guide on every game page', () => {
  for (const copy of [launch, preview]) {
    for (const game of PORTAL_GAMES) {
      assert.match(copy.modeSelect[game.id].free, /^Free play needs no wallet and never touches the chain\. It costs nothing/, `${game.id} Free line`);
    }
  }
  for (const game of PORTAL_GAMES) assert.match(launch.modeSelect[game.id].ranked, /^\d+\.\d+ testnet zkLTC per run\. The arcade server/, `${game.id} Ranked line`);
  for (const [name, gameId] of [['index.html', 'lester-blaster'], ['discover/games.html', 'lester-blaster'], ...PORTAL_GAMES.map((game) => [`discover/${game.slug}.html`, game.id])]) {
    const page = live[name];
    assert.equal(decode(block(page, 'mode-free')), launch.modeSelect[gameId].free, name);
    assert.match(page, /<p class="mode-guide-note"><a id="officialModeGuideLink" class="portal-text-link" href="\/how-ranked-works">How Ranked works: price, free zkLTC and steps →<\/a><\/p>/, name);
  }
  const routes = read('apps/portal/src/routes/official-play-routes.mjs');
  assert.match(routes, /const free = siteCopy\?\.free \? \{ \.\.\.modeSelect\.free, copy: siteCopy\.free \} : modeSelect\.free;/);
  assert.match(routes, /textContent: FAUCET_LINK_TEXT, href: ranked\.faucetUrl, target: '_blank', rel: 'noopener noreferrer'/);
});

test('each game page has a Ranked section: price, faucet, what is checked, boards, achievements, guide', () => {
  for (const game of PORTAL_GAMES) {
    const page = live[`discover/${game.slug}.html`];
    const section = page.match(new RegExp(`<section class="game-detail-ranked" aria-labelledby="gameRanked-${game.slug}"><h3 id="gameRanked-${game.slug}">Ranked</h3>([\\s\\S]*?)</section>`))?.[1];
    assert.ok(section, `${game.slug} Ranked section`);
    const visible = text(section);
    assert.ok(visible.includes(`Price ${RANKED_WORDING.price}`), game.slug);
    assert.ok(visible.includes(`Free zkLTC ${RANKED_WORDING.faucet} Open the LiteForge faucet`), game.slug);
    assert.match(section, FAUCET_LINK);
    assert.match(visible, game.id === 'lester-blaster' ? /What is checked The arcade's server plausibility-checks your run against the game's limits; it is not replayed\./ : /What is checked The arcade's server replays your run from its recorded inputs/);
    assert.match(visible, /Boards Weekly, Monthly and All-time boards rank the best verified score of each wallet\. Weekly boards reset every Monday 00:00 UTC\./);
    assert.ok(visible.includes(`Achievements ${RANKED_FACTS.achievements[game.id]} achievements to earn from verified Ranked runs`), game.slug);
    assert.match(section, /<a href="\/how-ranked-works" class="portal-text-link">How Ranked works: steps, free zkLTC and fixes →<\/a>$/);
    assert.doesNotMatch(previewPages[`discover/${game.slug}.html`], /game-detail-ranked/, 'no Ranked section while Ranked is a preview');
  }
});

test('the Ranked modal rows and What happens next come from the facts and follow the flags', () => {
  const modal = (html) => html.match(/<div id="rankedEntryModal"[\s\S]*?(?=<nav\b)/)[0];
  const livePage = modal(live['index.html']);
  assert.deepEqual(['entry-fee', 'entry-reserve', 'entry-total'].map((key) => block(livePage, key)), ['0.01 zkLTC', '0.002 zkLTC', '0.012 zkLTC']);
  assert.equal(decode(block(livePage, 'entry-split')), "85% to the game's developer · 15% to the arcade");
  const next = rankedSurfaceCopy({ settlementLive: true }).entryNext;
  assert.equal(next.length, 3);
  assert.equal(text(block(livePage, 'entry-next')), next.join(' '));
  assert.match(next.join(' '), /usually within about a minute/);
  const previewNext = rankedSurfaceCopy({ settlementLive: false }).entryNext;
  assert.equal(text(block(modal(previewPages['index.html']), 'entry-next')), previewNext.join(' '));
  assert.match(previewNext[0], /Nothing is charged and no transaction is sent\./);
});

test('wallet prompts name the faucet amount when the balance is short', () => {
  const action = walletErrorAction(classifyWalletError({ code: 'INSUFFICIENT_FUNDS', shortMessage: 'insufficient funds' }), {});
  assert.equal(action.message, `You need about ${RANKED_FACTS.totalZkLtc} zkLTC. Balance unknown.`, 'the static fallback is the new total');
  assert.deepEqual(action.actions.map((entry) => entry.label), [FAUCET_LINK_TEXT, 'Re-check']);

  const element = (tag) => ({
    tag, className: '', textContent: '', dataset: {}, children: [],
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    querySelector(selector) { return this.children.find((child) => selector === `.${child.className}`) ?? null; },
  });
  const documentRef = { head: element('head'), createElement: element, getElementById: () => null };
  const container = element('div');
  const chip = renderBalanceChip({ documentRef, container, balanceWei: 5_000_000_000_000_000n, needWei: 12_500_000_000_000_000n });
  const faucet = chip.children.find((child) => child.className === 'wallet-balance-faucet');
  assert.deepEqual([faucet.textContent, faucet.href, faucet.target, faucet.rel], [FAUCET_CHIP_TEXT, RANKED_FACTS.faucetUrl, '_blank', 'noopener noreferrer']);
  assert.equal(FAUCET_CHIP_TEXT, 'Get 0.05 free zkLTC');
  const funded = renderBalanceChip({ documentRef, container: element('div'), balanceWei: 10n ** 18n, needWei: 12_500_000_000_000_000n });
  assert.equal(funded.children.some((child) => child.className === 'wallet-balance-faucet'), false, 'no faucet link when funded');
});

test('the trust page states the faucet and links the guide', () => {
  const howTo = block(live['trust.html'], 'ranked-howto');
  assert.match(howTo, FAUCET_LINK);
  assert.ok(text(howTo).includes(RANKED_WORDING.faucet));
  assert.match(howTo, /The <a href="\/how-ranked-works">player guide<\/a> explains every step/);
  assert.match(read('apps/portal/trust.css'), /\.visually-hidden \{/);
  const previewHowTo = block(previewPages['trust.html'], 'ranked-howto');
  assert.doesNotMatch(previewHowTo, /faucet|zkLTC/i);
  assert.match(text(previewHowTo), /Ranked is in preview right now/);
});

test('llms.txt carries a Ranked summary and the guide URL', () => {
  const llms = live['llms.txt'];
  assert.match(llms, /- \[How Ranked works\]\(https:\/\/lestersarcade\.io\/how-ranked-works\): How to play Ranked: the steps, the 0\.012 zkLTC price, free testnet zkLTC from the faucet/);
  const section = llms.split('\n## How Ranked works\n')[1];
  assert.ok(section, 'a How Ranked works section');
  for (const line of [RANKED_WORDING.price, RANKED_WORDING.faucet, RANKED_WORDING.free, RANKED_WORDING.proof, RANKED_WORDING.value]) assert.ok(section.includes(line), line);
  assert.match(section, /split 85% to the game's developer and 15% to the arcade/);
  assert.match(section, /124 achievements \(Hard Money Heroes 44, Chikun's Escape 40, STACKED 40\)/);
  assert.doesNotMatch(llms, /jackpot/i);
  assert.doesNotMatch(previewPages['llms.txt'], /## How Ranked works|0\.012/);
});

test('the README opens with How to play: Free and Ranked steps, price, faucet and the guide', () => {
  const readme = read('README.md');
  const start = readme.indexOf('\n## How to play\n');
  assert.ok(start > 0 && start < readme.indexOf('\n# ', 10), 'How to play sits under the latest release summary, near the top');
  const section = readme.slice(start, readme.indexOf('\n# ', start));
  assert.match(section, /\*\*Free:\*\* open \[lestersarcade\.io\/games\]\(https:\/\/lestersarcade\.io\/games\)/);
  assert.equal((section.match(/^\d\. /gm) ?? []).length, 5, 'five Ranked steps');
  assert.ok(section.includes('[LiteForge faucet](https://liteforge.hub.caldera.xyz) (0.05 per request, enough for 4 Ranked runs)'));
  assert.ok(section.includes(RANKED_WORDING.price));
  assert.ok(section.includes("85% to the game's developer and 15% to the arcade"));
  assert.ok(section.includes('[lestersarcade.io/how-ranked-works](https://lestersarcade.io/how-ranked-works)'));
  assert.doesNotMatch(section, /jackpot|NFT|prize|reward/i);
});

test('the developer docs state the new price, the split, the faucet and the guide', () => {
  const onboarding = read('docs/THIRD_PARTY_GAME_ONBOARDING.md');
  const section = onboarding.slice(onboarding.indexOf('### How Ranked works for players'), onboarding.indexOf('## 2. SDK Contract'));
  assert.ok(section.includes('0.012 testnet zkLTC per run: 0.01 entry + 0.002 to publish the score on chain'));
  assert.ok(section.includes("85% to the game's developer wallet and 15% to the arcade"));
  assert.ok(section.includes('(https://liteforge.hub.caldera.xyz) (0.05 per request, enough for 4 Ranked runs)'));
  assert.ok(section.includes('https://lestersarcade.io/how-ranked-works'));
  assert.doesNotMatch(onboarding, /device-local replay previews/, 'STACKED Ranked is published like every Ranked run');
  const contracts = read('contracts/README.md');
  assert.match(contracts, /entryFeeWei = 0\.01 zkLTC/);
  assert.match(contracts, /`entryFeeWei 10000000000000000` \(0\.01 zkLTC/);
  assert.match(read('docs/web3/litvm-liteforge-integration-spec.md'), /\| Faucet \| \*\*https:\/\/liteforge\.hub\.caldera\.xyz\*\* \(0\.05 zkLTC per request/);
});
