import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  PORTAL_COPY, PORTAL_DESCRIPTION, PORTAL_FAQ, PORTAL_FLAGS, PORTAL_GAMES, RANKED_LAUNCH_TERMS,
  escapeHtml, portalCopyFor, portalPageMeta, portalSchema, renderGameDetails,
} from '../apps/portal/src/portal-content.mjs';
import { SETTLEMENT_LIVE, HOSTED_PROFILE_SYNC } from '../apps/portal/src/settlement.mjs';
import { DEFAULT_REVENUE_SPLIT_BPS, RANKED_ENTRY_FEE_WEI, RANKED_ENTRY_FEE_ZKLTC, RANKED_SETTLEMENT_GAS_RESERVE_WEI } from '../apps/portal/src/arcade-core.mjs';
import { DEFAULT_MIN_PAID_WEI } from '../server/config.mjs';
import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';

const deployConfig = JSON.parse(readFileSync(new URL('../contracts/deploy-config.testnet.json', import.meta.url), 'utf8'));

const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
const hostedPreview = portalCopyFor({ settlementLive: false, hostedProfileSync: true });
const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
const STATES = { preview, hostedPreview, launch };
const COPY_KEYS = [
  'description', 'faq', 'scoresNote', 'trustStatus', 'trustStorage', 'llmsScope', 'llmsHowItWorks',
  'manifestDescription', 'howIntro', 'howConnectTitle', 'howConnect', 'howConnectAction', 'howProfile',
  'scoresLead', 'scoresWallet', 'modeSelect', 'modeRanked', 'modeRankedTooltip', 'rankedDetail', 'scoresView', 'profileGuestView',
  'profileWalletView', 'walletConnected',
];

// Every string a copy object can put on a page, flattened.
const strings = copy => {
  const out = [];
  const walk = value => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(copy);
  return out;
};
const allText = copy => strings(copy).join('\n');
const answer = (copy, pattern) => copy.faq.find(([question]) => pattern.test(question))?.[1] ?? '';
const sentences = text => text.split(/(?<=[.;:])\s+/);
const toWei = decimal => {
  const [whole, fraction = ''] = decimal.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
};

test('every flag state provides each block the builder and the SPA render', () => {
  for (const [name, copy] of Object.entries(STATES)) {
    for (const key of COPY_KEYS) assert.ok(copy[key] !== undefined && copy[key] !== '', `${name}.${key}`);
    assert.ok(Object.isFrozen(copy) && Object.isFrozen(copy.faq), `${name} copy is frozen`);
    for (const pair of copy.faq) assert.equal(pair.length, 2);
    for (const game of PORTAL_GAMES) assert.equal(typeof copy.rankedDetail[game.id], 'string', `${name} ranked detail for ${game.id}`);
    assert.deepEqual(Object.keys(copy.modeSelect), ['lester-blaster', 'chikun'], `${name} mode-select games (STACKED's cards belong to ranked-client)`);
    for (const entry of Object.values(copy.modeSelect)) {
      assert.ok(Object.isFrozen(entry) && entry.copy && entry.ranked, `${name} mode-select entry`);
      assert.doesNotMatch(entry.copy + entry.ranked, /—|\bpaid\b|\bprototype\b/i, 'HMH copy style rules (hmh-copy-sheet.mjs)');
    }
    assert.ok(copy.trustStatus.length >= 1 && copy.trustStorage.length >= 1);
  }
  assert.deepEqual([preview.state, hostedPreview.state, launch.state], ['preview', 'hosted-preview', 'launch']);
});

test('the exported copy follows the committed settlement flags', () => {
  assert.deepEqual(PORTAL_FLAGS, { settlementLive: SETTLEMENT_LIVE, hostedProfileSync: HOSTED_PROFILE_SYNC });
  assert.deepEqual(PORTAL_COPY, portalCopyFor(PORTAL_FLAGS));
  assert.equal(PORTAL_DESCRIPTION, PORTAL_COPY.description);
  assert.equal(PORTAL_FAQ, PORTAL_COPY.faq);
  assert.equal(portalPageMeta('/').description, PORTAL_COPY.description);
});

test('preview copy says device-local and no fees', () => {
  assert.match(preview.description, /device-local Ranked previews/);
  assert.match(answer(preview, /cost money/), /requires no entry fee and pays no prizes\. No score transaction is sent\./);
  assert.match(answer(preview, /online/), /device-local: they stay in this browser/);
  assert.match(preview.scoresNote, /device-local previews today/);
  assert.match(preview.trustStatus.join(' '), /`SETTLEMENT_LIVE=false`/);
  assert.match(preview.trustStorage.join(' '), /stay in this browser/);
  assert.match(preview.llmsScope, /No entry fees, prizes, global rankings, cross-device history, or on-chain score publishing/);
  assert.match(preview.howConnect, /needs no entry fee or score transaction/);
  for (const game of PORTAL_GAMES) assert.match(preview.rankedDetail[game.id], /device-local preview with no fees or prizes/);
  for (const entry of Object.values(preview.modeSelect)) assert.match(entry.ranked, /nothing is published on chain yet/);
  assert.match(preview.modeRanked, /No entry fee and no prizes; nothing is published on chain yet/);
  assert.equal(preview.modeRankedTooltip, 'local verified-preview mode');
  // The preview Scores page still offers other time windows until the
  // profile-boards slice drops its tabs, so preview copy names no period.
  assert.doesNotMatch(preview.scoresLead + preview.scoresView, /daily|weekly|monthly|yearly|all-time/i);
  const text = allText(preview);
  assert.doesNotMatch(text, /0\.102|zkLTC per run|Neon|replayed|plausibility|published on LitVM|not refunded/i);
});

test('launch copy states the fee, the split and the testnet', () => {
  const fee = answer(launch, /cost money/);
  const terms = /0\.102 zkLTC per run on the LitVM LiteForge testnet: a 0\.1 zkLTC entry, split 85% to the game's developer and 15% to the arcade, plus a 0\.002 zkLTC settlement reserve/;
  assert.match(fee, terms);
  assert.match(launch.trustStatus[0], /costs 0\.102 zkLTC: a 0\.1 zkLTC entry, split 85% to the game's developer and 15% to the arcade, plus a 0\.002 zkLTC settlement reserve/);
  assert.match(launch.llmsScope, terms);
  for (const text of [fee, launch.trustStatus.join(' '), launch.llmsScope]) {
    assert.match(text, /Free Mode is always free/);
    assert.match(text, /Testnet zkLTC has no value, and there are no prizes\./);
    assert.match(text, /Testnet entries are not refunded\./);
  }
  assert.match(answer(launch, /wallet to play/), /Free Mode is always free and needs no wallet/);
  assert.match(launch.description, /0\.102 testnet zkLTC per run/);
  assert.match(launch.modeRanked, /^0\.102 testnet zkLTC per run\./);
  for (const entry of Object.values(launch.modeSelect)) {
    assert.match(entry.ranked, /^0\.102 testnet zkLTC per run\. The arcade server .* and publishes it on LitVM\.$/);
    assert.match(entry.copy, /sign in and choose Play Ranked to compete on the LitVM testnet/);
  }
  assert.match(launch.howConnect, /costs nothing and sends no transaction\. Each Ranked run then costs 0\.102 testnet zkLTC/);
});

test('launch copy says HMH is plausibility-checked and the other games are replayed', () => {
  const blocks = [answer(launch, /checked and published/), launch.trustStatus.join(' '), launch.llmsScope];
  for (const text of blocks) {
    assert.match(text, /Chikun's Escape and STACKED runs are replayed/);
    assert.match(text, /Hard Money Heroes runs are plausibility-checked/);
    assert.match(text, /relayer/);
    assert.match(text, /LitVM/);
  }
  assert.match(launch.rankedDetail['lester-blaster'], /plausibility-checks each run \(it is not replayed\)/);
  assert.match(launch.rankedDetail.chikun, /replays each run from your inputs/);
  assert.match(launch.rankedDetail.stacked, /replays each run from your inputs/);
  assert.match(launch.modeSelect['lester-blaster'].ranked, /plausibility-checks your run \(it is not replayed\)/);
  assert.match(launch.modeSelect.chikun.ranked, /replays your run from its inputs/);
  // No sentence ever claims a Hard Money Heroes replay (contract A9).
  for (const text of strings(launch)) {
    for (const sentence of sentences(text)) {
      if (/Hard Money Heroes/.test(sentence) && /replay/i.test(sentence) && !/Chikun|STACKED/.test(sentence)) assert.match(sentence, /not replayed/, sentence);
    }
  }
});

test('launch copy discloses server-side storage', () => {
  const storage = launch.trustStorage.join(' ');
  for (const phrase of [
    'Neon Postgres database', 'your wallet address', 'verified Ranked sessions with their evidence',
    'recorded inputs that replay a Chikun', 'run summary of a Hard Money Heroes run', 'the achievements recorded for your wallet',
    'on-chain display name and avatar', 'your profile preferences', 'keyed hashes (HMAC) of IP addresses', 'not raw IP addresses',
    'public on your profile and the leaderboards', 'public records on the LitVM LiteForge testnet',
  ]) assert.ok(storage.includes(phrase), `storage disclosure names: ${phrase}`);
  assert.match(hostedPreview.trustStorage.join(' '), /Neon Postgres database: your wallet address; a copy of your on-chain display name and avatar; your profile preferences; and the one-time codes used to sign in\. Rate limiting stores keyed hashes \(HMAC\)/);
  assert.doesNotMatch(hostedPreview.trustStorage.join(' '), /evidence|achievements/);
});

test('launch copy covers boards, achievements, names, retries and refunds', () => {
  const online = answer(launch, /online/);
  assert.match(online, /global Weekly, Monthly, and All-time leaderboards that rank the best verified Ranked score of each wallet/);
  assert.match(online, /Weekly boards reset on Monday at 00:00 UTC and monthly boards on the 1st at 00:00 UTC\./);
  assert.match(online, /achievements the arcade server recorded/);
  assert.match(online, /display name and avatar on chain/);
  assert.match(online, /hidden on its pages by moderation/);
  assert.match(answer(launch, /checked and published/), /retries automatically, and you can retry it from your profile/);
  assert.match(launch.llmsScope, /Achievements are recorded against the wallet on the arcade server\. Display names are set on chain and can be hidden by moderation\./);
  assert.match(launch.llmsScope, /Failed publishes retry automatically and can be retried from the profile\./);
  assert.match(launch.scoresView, /Weekly, Monthly, and All-time/);
});

// The orchestrator shows the owner these launch texts, quoted in the slice's
// final commit message, before step 7. They are pinned word for word so the
// flip ships exactly the reviewed wording: a later edit fails here until the
// new text is quoted and reviewed again.
test('the launch wording quoted for owner review is what the flip ships', () => {
  assert.equal(answer(launch, /cost money/),
    "Ranked costs 0.102 zkLTC per run on the LitVM LiteForge testnet: a 0.1 zkLTC entry, split 85% to the game's developer and 15% to the arcade, plus a 0.002 zkLTC settlement reserve that pays the arcade's relayer to publish your result. Testnet zkLTC has no value, and there are no prizes. Testnet entries are not refunded. Free Mode is always free.");
  assert.deepEqual([...launch.trustStatus], [
    "Ranked is live on the LitVM LiteForge testnet. A Ranked run costs 0.102 zkLTC: a 0.1 zkLTC entry, split 85% to the game's developer and 15% to the arcade, plus a 0.002 zkLTC settlement reserve that pays the arcade's relayer to publish your result. Free Mode is always free and needs no wallet.",
    "The arcade server checks every Ranked run before its relayer publishes it on LitVM. Chikun's Escape and STACKED runs are replayed from their recorded inputs; a replay proves that a run follows the game's rules, not who played it. Hard Money Heroes runs are plausibility-checked against the game's limits and are not replayed; the check rejects impossible results but cannot prove how a run was played.",
    'If publishing fails, it retries automatically, and you can retry it from your profile. Testnet entries are not refunded. Testnet zkLTC has no value, and there are no prizes.',
  ]);
  assert.deepEqual([...launch.trustStorage], [
    "Signing in and playing Ranked also stores data on the arcade server, in a Neon Postgres database: your wallet address; your verified Ranked sessions with their evidence (the recorded inputs that replay a Chikun's Escape or STACKED run, or the run summary of a Hard Money Heroes run), scores, stats, check results, and publishing status; the achievements recorded for your wallet; a copy of your on-chain display name and avatar; your profile preferences; and the one-time codes used to sign in. Rate limiting stores keyed hashes (HMAC) of IP addresses in short time windows, not raw IP addresses.",
    'Your wallet address, display name, best scores, verified runs, and achievements are public on your profile and the leaderboards. Published results are also public records on the LitVM LiteForge testnet, which the arcade cannot delete.',
  ]);
});

test('no copy mentions NFTs, hashtags, hype or daily and yearly boards', () => {
  for (const [name, copy] of Object.entries(STATES)) {
    const text = allText(copy);
    assert.doesNotMatch(text, /\bNFTs?\b|soulbound|\bmint(?:s|ed|ing)?\b|token id/i, `${name}: no NFT wording (contract A32)`);
    assert.doesNotMatch(text, /(?:^|\s)#\w/, `${name}: no hashtags (D13)`);
    assert.doesNotMatch(text, /\byearly\b|\bdaily\b/i, `${name}: only Weekly, Monthly and All-time boards (D2)`);
    assert.doesNotMatch(text, /guarantee|profit|invest|earn (?:money|crypto|rewards)|!/i, `${name}: plain wording`);
  }
});

test('launch copy drops every preview statement', () => {
  const text = allText(launch);
  assert.doesNotMatch(text, /device-local|preview|no entry fee|No score transaction|SETTLEMENT_LIVE|stay in this browser|temporarily disabled/i);
  const launchStrings = new Set(strings(launch));
  for (const statement of strings(preview).filter(value => !launchStrings.has(value) && /Ranked|profile|leaderboard|scoreboard|wallet/i.test(value))) {
    assert.ok(!text.includes(statement), `launch copy repeats a preview statement: ${statement}`);
  }
});

test('hosted preview promises neither a fee nor on-chain publishing', () => {
  const text = allText(hostedPreview);
  assert.doesNotMatch(text, /0\.102|zkLTC per run|published on LitVM|replayed|plausibility|not refunded/i);
  assert.doesNotMatch(hostedPreview.description+hostedPreview.scoresNote+answer(hostedPreview, /online/), /device-local|stay in this browser/, 'profiles and boards are online');
  assert.match(answer(hostedPreview, /cost money/), /requires no entry fee/);
  assert.match(answer(hostedPreview, /online/), /Ranked is still a preview, so no runs are published or ranked yet\./);
  assert.match(hostedPreview.trustStatus.join(' '), /`SETTLEMENT_LIVE=false`/);
});

test('live settlement always gets the hosted wording (contract §9.1 invariant)', () => {
  assert.deepEqual(portalCopyFor({ settlementLive: true, hostedProfileSync: false }), launch);
  assert.deepEqual(portalCopyFor(), preview);
  assert.deepEqual(portalCopyFor({ settlementLive: 'true', hostedProfileSync: 1 }), preview, 'only real booleans switch the copy');
});

test('launch terms match the entry fee, the split and the server minimum paid amount', () => {
  const { feeZkLtc, reserveZkLtc, totalZkLtc, developerPercent, arcadePercent } = RANKED_LAUNCH_TERMS;
  assert.equal(feeZkLtc, RANKED_ENTRY_FEE_ZKLTC);
  assert.equal(toWei(feeZkLtc), BigInt(RANKED_ENTRY_FEE_WEI));
  assert.equal(toWei(feeZkLtc) + toWei(reserveZkLtc), BigInt(DEFAULT_MIN_PAID_WEI), 'fee + reserve is what E3 requires (A27)');
  assert.equal(toWei(totalZkLtc), BigInt(DEFAULT_MIN_PAID_WEI));
  assert.equal(developerPercent * 100, DEFAULT_REVENUE_SPLIT_BPS.dev);
  assert.equal(arcadePercent * 100, DEFAULT_REVENUE_SPLIT_BPS.treasury);
});

// The quote must match what the contracts charge, not only the server minimum:
// a retuned reserve (setSettlementGasReserve, a new deploy config) or a changed
// per-game fee or split fails here until the public copy is updated with it.
// The client's RANKED_SETTLEMENT_GAS_RESERVE_WEI (arcade-core.mjs) must match too:
// the Ranked modal shows it before the chain quote arrives.
test('launch terms match the deployment reserve and every game fee and split', () => {
  const { feeZkLtc, reserveZkLtc, developerPercent, arcadePercent } = RANKED_LAUNCH_TERMS;
  assert.equal(toWei(reserveZkLtc), BigInt(RANKED_SETTLEMENT_GAS_RESERVE_WEI), 'arcade-core.mjs client reserve');
  assert.equal(toWei(reserveZkLtc), BigInt(LITVM_DEPLOYMENT.settlementGasReserveWei), 'generated/litvm-addresses.mjs reserve');
  assert.equal(toWei(reserveZkLtc), BigInt(deployConfig.settlementGasReserveWei), 'deploy-config.testnet.json reserve');
  assert.deepEqual(deployConfig.games.map(game => game.slug).sort(), PORTAL_GAMES.map(game => game.id).sort());
  for (const game of deployConfig.games) {
    assert.equal(BigInt(game.entryFeeWei), toWei(feeZkLtc), `${game.slug} entry fee`);
    assert.deepEqual([game.devBps, game.treasuryBps, game.platformBps, game.liquidityBps], [developerPercent * 100, arcadePercent * 100, 0, 0], `${game.slug} split`);
  }
});

test('server code never imports the flag-bound portal copy', () => {
  // portal-content.mjs reads the flags from settlement.mjs, whose import graph
  // (arcade-core.mjs, asset manifests) does not belong in a Vercel function.
  const sources = [];
  const walk = dir => {
    for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
      if (entry.isDirectory()) walk(`${dir}${entry.name}/`);
      else if (/\.m?js$/.test(entry.name)) sources.push(`${dir}${entry.name}`);
    }
  };
  walk('../server/');
  walk('../api/');
  assert.ok(sources.length > 20);
  for (const source of sources) assert.doesNotMatch(readFileSync(new URL(source, import.meta.url), 'utf8'), /portal-content\.mjs/, source);
});

test('meta, structured data and game details render the copy they are given', () => {
  for (const copy of [preview, launch]) {
    assert.equal(portalPageMeta('/', copy).description, copy.description);
    assert.equal(portalPageMeta('/games', copy).description, copy.description);
    const website = JSON.parse(portalSchema('/', copy))['@graph'].find(node => node['@type'] === 'WebSite');
    assert.equal(website.description, copy.description);
    for (const game of PORTAL_GAMES) assert.ok(renderGameDetails(game.slug, copy).includes(escapeHtml(copy.rankedDetail[game.id])));
  }
  assert.equal(renderGameDetails('hard-money-heroes'), renderGameDetails('hard-money-heroes', PORTAL_COPY));
  assert.doesNotMatch(portalSchema('/games', launch), /aggregateRating|prize/i);
});

// The rendering tests live with each view: tests/official-app-routes.test.mjs,
// tests/official-shell-routes.test.mjs, tests/portal-discovery.test.mjs and
// tests/portal-mode-select-copy.test.mjs render the launch copy into the DOM.
test('SPA views default to the copy for the committed flags', () => {
  const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const discovery = source('../apps/portal/src/portal-discovery.mjs');
  const appRoutes = source('../apps/portal/src/routes/official-app-routes.mjs');
  const shellRoutes = source('../apps/portal/src/routes/official-shell-routes.mjs');
  const playRoutes = source('../apps/portal/src/routes/official-play-routes.mjs');
  for (const route of [appRoutes, shellRoutes, playRoutes]) assert.match(route, /\n  portalCopy = PORTAL_COPY,\n/);
  assert.equal(discovery.match(/copy=PORTAL_COPY/g)?.length, 3, 'gameDetailsNode, syncDiscoveryMeta and installPortalDiscovery');
  assert.doesNotMatch(shellRoutes + appRoutes, /walletLockCopy/, 'the settlement-disabled wallet note never reaches a launch page');
  assert.doesNotMatch(playRoutes, /local verified-preview mode/, 'the Ranked tooltip heading follows the flags');
  for (const text of [discovery, appRoutes, shellRoutes]) assert.doesNotMatch(text, /device-local|yearly/i);
});
