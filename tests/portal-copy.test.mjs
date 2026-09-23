import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PORTAL_COPY, PORTAL_DESCRIPTION, PORTAL_FAQ, PORTAL_FLAGS, PORTAL_GAMES, RANKED_LAUNCH_TERMS,
  escapeHtml, portalCopyFor, portalPageMeta, portalSchema, renderGameDetails,
} from '../apps/portal/src/portal-content.mjs';
import { SETTLEMENT_LIVE, HOSTED_PROFILE_SYNC } from '../apps/portal/src/settlement.mjs';
import { DEFAULT_REVENUE_SPLIT_BPS, RANKED_ENTRY_FEE_WEI, RANKED_ENTRY_FEE_ZKLTC } from '../apps/portal/src/arcade-core.mjs';
import { DEFAULT_MIN_PAID_WEI } from '../server/config.mjs';

const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
const hostedPreview = portalCopyFor({ settlementLive: false, hostedProfileSync: true });
const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
const STATES = { preview, hostedPreview, launch };
const COPY_KEYS = [
  'description', 'faq', 'scoresNote', 'trustStatus', 'trustStorage', 'llmsScope', 'llmsHowItWorks',
  'manifestDescription', 'howIntro', 'howConnectTitle', 'howConnect', 'howConnectAction', 'howProfile',
  'scoresLead', 'scoresWallet', 'modeCopy', 'modeRanked', 'rankedDetail', 'scoresView', 'profileGuestView',
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
  const text = allText(preview);
  assert.doesNotMatch(text, /0\.1001|zkLTC per run|Neon|replayed|plausibility|published on LitVM|not refunded/i);
});

test('launch copy states the fee, the split and the testnet', () => {
  const fee = answer(launch, /cost money/);
  const terms = /0\.1001 zkLTC per run on the LitVM LiteForge testnet: a 0\.1 zkLTC entry, split 85% to the game's developer and 15% to the arcade, plus a 0\.0001 zkLTC settlement reserve/;
  assert.match(fee, terms);
  assert.match(launch.trustStatus[0], /costs 0\.1001 zkLTC: a 0\.1 zkLTC entry, split 85% to the game's developer and 15% to the arcade, plus a 0\.0001 zkLTC settlement reserve/);
  assert.match(launch.llmsScope, terms);
  for (const text of [fee, launch.trustStatus.join(' '), launch.llmsScope]) {
    assert.match(text, /Free Mode is always free/);
    assert.match(text, /Testnet zkLTC has no value, and there are no prizes\./);
    assert.match(text, /Testnet entries are not refunded\./);
  }
  assert.match(answer(launch, /wallet to play/), /Free Mode is always free and needs no wallet/);
  assert.match(launch.description, /0\.1001 testnet zkLTC per run/);
  assert.match(launch.modeRanked, /^0\.1001 testnet zkLTC per run\./);
  assert.match(launch.howConnect, /costs nothing and sends no transaction\. Each Ranked run then costs 0\.1001 testnet zkLTC/);
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
  assert.doesNotMatch(text, /0\.1001|zkLTC per run|published on LitVM|replayed|plausibility|not refunded/i);
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

test('SPA views read the same copy source as the builder', () => {
  const discovery = readFileSync(new URL('../apps/portal/src/portal-discovery.mjs', import.meta.url), 'utf8');
  const appRoutes = readFileSync(new URL('../apps/portal/src/routes/official-app-routes.mjs', import.meta.url), 'utf8');
  assert.match(discovery, /\['Free or Ranked\?',PORTAL_COPY\.rankedDetail\[game\.id\]\]/);
  assert.match(appRoutes, /leaderboards: PORTAL_COPY\.scoresView/);
  assert.match(appRoutes, /: PORTAL_COPY\.profileGuestView/);
  assert.match(appRoutes, /\? PORTAL_COPY\.profileWalletView/);
  const shellRoutes = readFileSync(new URL('../apps/portal/src/routes/official-shell-routes.mjs', import.meta.url), 'utf8');
  assert.match(shellRoutes, /: PORTAL_COPY\.scoresWallet;/);
  assert.doesNotMatch(shellRoutes + appRoutes, /walletLockCopy/, 'the settlement-disabled wallet note never reaches a launch page');
  for (const source of [discovery, appRoutes, shellRoutes]) assert.doesNotMatch(source, /device-local|yearly/i);
});
