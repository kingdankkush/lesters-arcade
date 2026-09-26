// Public, non-personal discovery facts shared by prerendered HTML and SPA views.
// The flags come from settlement.mjs, which imports arcade-core.mjs and the
// generated address module, so this module is for the browser and the page
// builder only: server/** and api/** never import it (tests/portal-copy.test.mjs).
import { SETTLEMENT_LIVE, HOSTED_PROFILE_SYNC } from './settlement.mjs';
import { JACKPOT_LIVE } from './jackpot-config.mjs';

export const PORTAL_ORIGIN = 'https://lestersarcade.io';
export const PORTAL_GAMES = Object.freeze([
  Object.freeze({
    id: 'lester-blaster', slug: 'hard-money-heroes', title: 'Hard Money Heroes', genre: 'Survival shooter',
    tag: 'Build your survivor', status: 'Playable now',
    description: 'Fight through the Crypto Wasteland in a top-down roguelite. Choose a hero, collect weapons, complete field objectives, and hold out against the horde.',
    controls: 'Keyboard and mouse or on-screen touch controls. Move with WASD or arrows; aim with the mouse. On mobile, use MOVE and AIM.',
    goal: 'Survive longer, find stronger weapons, and try a different build on the next run.',
    art: '/assets/generated/hmh-banners/hard-money-heroes-free-mode-banner.jpg',
    cabinet: '/assets/hard-money-heroes/cabinet/rotation/hmh-cabinet-rotation-00-front.png',
    sprite: 'hard-money-heroes-arcade-cabinet-rotation',
  }),
  Object.freeze({
    id: 'chikun', slug: 'chikun', title: "Chikun's Escape", genre: 'Run & fly',
    tag: 'Take the ground. Take the sky.', status: 'Playable now',
    description: 'Run, jump, and fly through the Ground & Sky course. Time your taps, collect coins, and find a way through hazards as the pace picks up.',
    controls: 'Tap, click, or press Space to jump and flap. Release to descend and land; running resumes on the ground.',
    goal: 'Travel farther, collect coins, and compare your daily best on this device.',
    art: '/assets/generated/chikun-mode-select/chikuns-escape-free-mode.webp',
    cabinet: '/assets/generated/chikun-cabinet/chikun-cabinet-front.png?v=transparent-v2',
    sprite: 'chikun-cabinet',
  }),
  Object.freeze({
    id: 'stacked', slug: 'stacked', title: 'STACKED', genre: 'Falling-block puzzle',
    tag: 'Find your rhythm', status: 'Public beta',
    description: 'Stack, spin, and seal falling ledger blocks to the arcade soundtrack. Chase cleaner clears while music-driven worlds react around the board.',
    controls: 'Use keyboard or touch controls to move, rotate, hold, and drop blocks. Review the control guide before your first run.',
    goal: 'Build clean rows, keep the board under control, and improve your score.',
    art: '/assets/stacked-mode-select/stacked-free-v1.png',
    cabinet: '/assets/stacked-cabinet/stacked-cabinet-turnaround-v1.png',
    sprite: 'stacked-cabinet',
  }),
]);

// Contract A33: every public statement about Ranked, profiles and leaderboards
// comes from these two client flags, so the step-7 flip regenerates launch
// wording (node scripts/build-portal-pages.mjs) and no preview claim stays live.
// Ranked statements follow SETTLEMENT_LIVE (entry fee, publishing); profile and
// leaderboard statements follow HOSTED_PROFILE_SYNC (sign-in, the server index).
// chikunJackpotLive follows JACKPOT_LIVE (apps/portal/src/jackpot-config.mjs, design §D.6): the Weekly
// Jackpot's public statements, its rules page's indexing and its sitemap and llms.txt entries.
export const PORTAL_FLAGS = Object.freeze({
  settlementLive: SETTLEMENT_LIVE === true,
  hostedProfileSync: HOSTED_PROFILE_SYNC === true,
  chikunJackpotLive: JACKPOT_LIVE === true,
});

// Launch Ranked terms (guide §3.2). The server refuses a session that paid less
// than fee + reserve (contract A27, RANKED_MIN_PAID_WEI = 102000000000000000);
// tests/portal-copy.test.mjs pins these against the code.
export const RANKED_LAUNCH_TERMS = Object.freeze({
  feeZkLtc: '0.1',
  reserveZkLtc: '0.002',
  totalZkLtc: '0.102',
  developerPercent: 85,
  arcadePercent: 15,
});

// The Weekly Jackpot's prize token on the LiteForge testnet (TestChikunToken, design §A.17;
// tests/jackpot-ui-rules-page.test.mjs pins it against the contract). A real $CHIKUN needs a new
// instance, new rules and new copy (design §A.19, §F).
export const JACKPOT_TEST_TOKEN_SYMBOL = 'tCHIKUN';
export const JACKPOT_NAME = "Chikun's Escape Weekly Jackpot";
// JACKPOT_RULES_PATH of jackpot-config.mjs, as a literal: an import would add a shared chunk to the
// initial bundle (tests/jackpot-ui-rules-page.test.mjs pins the two equal).
const JACKPOT_RULES_URL_PATH = '/jackpot/chikun';

const joinList = items => items.length < 3 ? items.join(' and ') : items.slice(0, -1).join('; ')+'; and '+items[items.length-1];

// Returns the public copy for one flag state. Contract §9.1 requires
// SETTLEMENT_LIVE => HOSTED_PROFILE_SYNC, so live settlement always gets the
// hosted profile wording. The states in use are preview (both false), hosted
// preview (profile sync only) and launch (both true). chikunJackpotLive adds the Weekly
// Jackpot's live statements, only on top of live settlement (JACKPOT_LIVE => SETTLEMENT_LIVE).
export function portalCopyFor({ settlementLive = false, hostedProfileSync = false, chikunJackpotLive = false } = {}) {
  return siteCopy(settlementLive, hostedProfileSync, jackpotCopy(settlementLive === true && chikunJackpotLive === true));
}

// The Weekly Jackpot's copy for the pages (design §D.6). Whatever the flag: the serverRecords lines
// (the seed-ticket log, and the jackpot review data with its published replays). When live: also the
// live noValue, the FAQ entry and one sentence each for trustStatus and llmsScope. Only the page
// builder renders the FAQ, trust and llms copy, and only it calls portalCopyFor, so esbuild leaves this
// function (and its strings) out of the SPA bundle: PORTAL_COPY below is built without it, and its
// builder-only fields (faq, trustStatus, trustStorage, llmsScope) are not the pages' copy.
function jackpotCopy(live) {
  const records = ['the seed tickets issued for your Ranked runs', "the Weekly Jackpot's review of your candidate runs, whose recorded inputs are published as replays once their week closes"];
  if (!live) return { records };
  const pays = `The ${JACKPOT_NAME} pays the best verified Ranked Chikun's Escape score of each funded week in ${JACKPOT_TEST_TOKEN_SYMBOL}, a testnet token with no value, after a review by a person`;
  return {
    records,
    noValue: `Testnet zkLTC has no value. The only prize is the ${JACKPOT_NAME}, paid in ${JACKPOT_TEST_TOKEN_SYMBOL}, a testnet token with no value; see the rules.`,
    faq: ['Is there a jackpot?', `Yes. ${pays}. Entry fees do not fund the prize. The rules are at lestersarcade.io${JACKPOT_RULES_URL_PATH}.`],
    trust: ' Weekly Jackpot candidates are checked automatically and reviewed by a person before any payout, and every review decision is published on LitVM.',
    scope: `${pays}; its rules are at https://lestersarcade.io${JACKPOT_RULES_URL_PATH}.`,
  };
}

function siteCopy(settlementLive, hostedProfileSync, jackpot) {
  const live = settlementLive === true;
  const hosted = live || hostedProfileSync === true;
  const { feeZkLtc: fee, reserveZkLtc: reserve, totalZkLtc: total, developerPercent: developer, arcadePercent: arcade } = RANKED_LAUNCH_TERMS;
  const games = "Play Hard Money Heroes, Chikun's Escape, and STACKED Free";
  const description = "Lester's Arcade is a browser arcade inspired by Litecoin culture. "+games+(live
    ? `, or play Ranked for ${total} testnet zkLTC per run, with verified scores published on LitVM.`
    : hosted ? ', with wallet sign-in, online profiles, and a Ranked preview that publishes nothing.'
    : ', with optional wallet profiles and device-local Ranked previews.');
  const entryTerms = `Ranked costs ${total} zkLTC per run on the LitVM LiteForge testnet: a ${fee} zkLTC entry, split ${developer}% to the game's developer and ${arcade}% to the arcade, plus a ${reserve} zkLTC settlement reserve that pays the arcade's relayer to publish your result.`;
  const retries = 'If publishing fails, it retries automatically, and you can retry it from your profile.';
  // Design §D.6: while the jackpot flag is off, the soft-launch week (§E E9) may pay a test prize, so
  // the copy never says "there are no prizes".
  const noValue = jackpot?.noValue ?? 'Testnet zkLTC has no value. Any test prizes are paid in testnet tokens that also have no value.';
  const boards = 'Each game has global Weekly, Monthly, and All-time leaderboards that rank the best verified Ranked score of each wallet.';
  const resets = 'Weekly boards reset on Monday at 00:00 UTC and monthly boards on the 1st at 00:00 UTC.';
  const names = "You choose your display name and avatar on chain, with a small transaction you pay for. Names that break the arcade's rules are hidden on its pages by moderation.";
  const faq = [
    ['Do I need a wallet to play?', live
      ? 'No. Free Mode is always free and needs no wallet. Browse the cabinets, choose a game, and start playing in your browser. You need a wallet only for Ranked.'
      : "No. Every active game on Lester's Arcade has Free Mode. Browse the cabinets, choose a game, and start playing in your browser."],
    hosted
      ? ['What does signing in with a wallet do?', 'You sign one message to prove the wallet is yours. Signing in costs nothing and sends no transaction. Your wallet address is your player identity, so your profile'+(live ? ', Ranked runs, and achievements follow' : ' follows')+' you to any device.']
      : ['What does connecting a wallet do?', "A connected wallet identifies your Lester's Arcade profile and local Ranked preview runs. You can set a display name and avatar and review supported achievements and run history."],
    ['Are profiles and leaderboards online?', hosted
      ? ['Yes.', boards, resets, live ? 'Every wallet has a public profile with its best scores, verified runs, and the achievements the arcade server recorded for it.' : 'Every wallet has a profile that follows it to any device.', live ? names : 'Ranked is still a preview, so no runs are published or ranked yet.'].join(' ')
      : 'Profiles and Ranked preview results are currently device-local: they stay in this browser. Scoreboards offer time-period views of those records. Cross-device history and verified global leaderboards are not available yet.'],
    ['Does Ranked cost money or pay prizes?', live
      ? `${entryTerms} ${noValue} Testnet entries are not refunded. Free Mode is always free.`
      : "The current Ranked preview requires no entry fee and pays no prizes. No score transaction is sent. Lester's Arcade is developing its wallet features for LitVM LiteForge testnet."],
    ...(jackpot?.faq ? [jackpot.faq] : []),
    ...(live ? [['How are Ranked runs checked and published?', "When a Ranked run ends, the arcade server checks it. Chikun's Escape and STACKED runs are replayed on the server from their recorded inputs. Hard Money Heroes runs are plausibility-checked against the game's limits; they are not replayed. The arcade's relayer then publishes the result on LitVM, and your results screen links to the transaction. "+retries]] : []),
    ['Can I play on my phone?', 'The three active games support on-screen touch controls as well as desktop input. A current browser is required. Performance varies by device; the games include settings for controls, audio, and visual effects.'],
  ];
  const serverRecords = joinList([
    'your wallet address',
    ...(live ? [
      "your verified Ranked sessions with their evidence (the recorded inputs that replay a Chikun's Escape or STACKED run, or the run summary of a Hard Money Heroes run), scores, stats, check results, and publishing status",
      'the achievements recorded for your wallet',
      ...(jackpot?.records ?? []),
    ] : []),
    'a copy of your on-chain display name and avatar',
    'your profile preferences',
    'the one-time codes used to sign in',
  ]);
  return Object.freeze({
    state: live ? 'launch' : hosted ? 'hosted-preview' : 'preview',
    description,
    manifestDescription: description,
    faq: Object.freeze(faq.map(pair => Object.freeze(pair))),
    // Landing page "How it works" steps and the scores section.
    howIntro: "Lester's Arcade brings original browser games, a shared jukebox, and wallet-"+(hosted ? 'based' : 'connected')+' player profiles into one arcade. Start with Free Mode. '+(live
      ? "Sign in with a wallet when you're ready to play Ranked on the LitVM testnet."
      : hosted ? "Sign in with a wallet when you're ready to try the Ranked preview."
      : "Connect a wallet when you're ready to try the local Ranked preview."),
    howConnectTitle: hosted ? 'Sign in with your wallet.' : 'Connect your wallet.',
    howConnect: (hosted ? 'Choose your wallet and sign one message. Signing in costs nothing and sends no transaction. ' : 'Connect a browser wallet and follow its prompts. Your wallet identifies your local player profile. ')
      +(live ? `Each Ranked run then costs ${total} testnet zkLTC, confirmed once in your wallet.` : 'The current preview needs no entry fee or score transaction.'),
    howConnectAction: hosted ? 'Sign in with a wallet →' : 'Connect a wallet →',
    howProfile: live
      ? 'Choose a display name and avatar on chain; each change is a small transaction you pay for. Your public profile shows your best scores, verified Ranked runs, and the achievements recorded for your wallet.'
      : hosted ? 'Your profile follows your wallet to any device. Ranked publishing is not open yet, so it lists no verified runs.'
      : 'Set a display name and avatar. Review supported achievements, game records, and Ranked preview history in your profile. Those records currently stay in this browser.',
    // Preview wording names no board periods: the preview Scores page still
    // offers other time windows until the profile-boards slice drops its tabs.
    scoresLead: (hosted ? boards : "See your Ranked preview records on this device's scoreboards.")+' Revisit a run, change your approach, and come back for another try.',
    scoresNote: live
      ? 'Ranked runs are checked by the arcade server and published on the LitVM LiteForge testnet, and each leaderboard row links to its transaction. '+resets
      : hosted ? 'Ranked is still a preview, so no runs are published or ranked yet.'
      : 'Scoreboards and profiles are device-local previews today. Global rankings, cross-device history, and on-chain score publishing are still in development.',
    scoresWallet: live ? 'Sign in with a wallet to play Ranked and follow your runs on your profile.'
      : hosted ? 'Sign in with a wallet to see your profile on any device.'
      : 'Connect a wallet to identify your local profile and Ranked preview runs.',
    // Mode select. The builder prerenders these and the SPA mode-select route
    // (routes/official-play-routes.mjs) shows the same per-game lines, so the
    // flip cannot leave a preview card live. Every game has an entry: the live
    // UI audit (2026-09-24) found STACKED's Ranked card, still on its
    // descriptor in arcade-core.mjs, without the entry price. modeRanked is the
    // game-neutral line for a page without an entry. The HMH line no longer
    // opens with 'Your Lester’s Arcade session is active', which signed-out
    // visitors read too (live UI audit review, 2026-09-24).
    // `copy` is the signed-out line (the prerendered pages carry it);
    // `copySignedIn` is what a signed-in player reads (a connected wallet in
    // the local preview): no guest wording, nothing to sign in to, and no claim
    // about the session, which can end while the page stays open (polish-2).
    modeSelect: Object.freeze({
      'lester-blaster': Object.freeze({
        copy: live
          ? 'Choose Free Mode to play without a wallet, or sign in and choose Play Ranked to compete on the LitVM testnet.'
          : `Choose Free Mode for local guest practice, or ${hosted ? 'sign in with' : 'connect'} a wallet and choose Play Ranked for a Ranked preview.`,
        copySignedIn: live
          ? 'Choose Free Mode for practice, or Play Ranked to compete on the LitVM testnet.'
          : 'Choose Free Mode for local practice, or Play Ranked for a Ranked preview.',
        ranked: live
          ? `${total} testnet zkLTC per run. The arcade server plausibility-checks your run (it is not replayed) and publishes it on LitVM.`
          : 'A wallet-bound Ranked preview run. No entry fee and no prizes; nothing is published on chain yet.',
      }),
      chikun: Object.freeze({
        copy: live
          ? 'Choose Free Mode to practice without a wallet, or sign in and choose Play Ranked to compete on the LitVM testnet.'
          : `Choose Free Mode for local guest practice, or ${hosted ? 'sign in with' : 'connect'} a wallet and choose Play Ranked for a replay-verified Ranked preview.`,
        copySignedIn: live
          ? 'Choose Free Mode for practice, or Play Ranked to compete on the LitVM testnet.'
          : 'Choose Free Mode for local practice, or Play Ranked for a replay-verified Ranked preview.',
        ranked: live
          ? `${total} testnet zkLTC per run. The arcade server replays your run from its inputs and publishes it on LitVM.`
          : 'Wallet-bound play with replay verification. Accepted scores are saved on this device; nothing is published on chain yet.',
      }),
      stacked: Object.freeze({
        copy: live
          ? 'Public beta. Free Mode lets you pick your starting level. Ranked starts at level 1 with no undo: sign in and choose Play Ranked to compete on the LitVM testnet.'
          : `Public beta. Free Mode lets you pick your starting level. Ranked starts at level 1 with no undo: ${hosted ? 'sign in with' : 'connect'} a wallet and choose Play Ranked for a replay-verified Ranked preview.`,
        copySignedIn: live
          ? 'Public beta. Free Mode lets you pick your starting level. Ranked starts at level 1 with no undo: choose Play Ranked to compete on the LitVM testnet.'
          : 'Public beta. Free Mode lets you pick your starting level. Ranked starts at level 1 with no undo: choose Play Ranked for a replay-verified Ranked preview.',
        ranked: live
          ? `${total} testnet zkLTC per run. The arcade server replays your run from its inputs and publishes it on LitVM.`
          : 'Wallet-bound play from level 1 with no undo, checked by replay. Accepted scores are saved on this device; nothing is published on chain yet.',
      }),
    }),
    // The guest line under the mode-select cards.
    modeGuestRanked: hosted ? 'Sign in with a wallet when you want to play Ranked.' : 'Connect a wallet when you want to play Ranked.',
    modeRanked: live
      ? `${total} testnet zkLTC per run. The arcade server checks your run and publishes it on LitVM.`
      : 'A wallet-bound Ranked preview run. No entry fee and no prizes; nothing is published on chain yet.',
    // Heading of the connected-wallet Ranked tooltip on the mode-select screen.
    modeRankedTooltip: live ? 'verified and published on LitVM' : 'local verified-preview mode',
    // The Ranked entry modal's lead and footnote (prerendered, hidden until
    // opened). The live pair is the one main.js requestRankedEntry shows.
    rankedEntryCopy: live
      ? 'One confirmation in your wallet pays the entry. Your run starts as soon as it is sent, and the relayer publishes your score on LitVM.'
      : 'Ranked preview: your wallet identifies this run on this device. Verified on-chain publishing remains disabled, so no transaction is sent and no zkLTC is charged.',
    rankedEntryFootnote: live
      ? 'The entry contract quotes the exact total. Testnet entries are not refunded.'
      : 'The entry contract quotes the exact total before you confirm, and your wallet asks once. In this preview no transaction is sent.',
    // Game details "Free or Ranked?" (discover pages and the SPA game view).
    rankedDetail: Object.freeze(Object.fromEntries(PORTAL_GAMES.map(game => [game.id, live
      ? `Free Mode is open to everyone and needs no wallet. Ranked costs ${total} testnet zkLTC per run; the arcade server ${game.id === 'lester-blaster' ? 'plausibility-checks each run (it is not replayed)' : 'replays each run from your inputs'} before publishing it on LitVM.`
      : 'Free Mode is open to guests. Wallet-connected Ranked is a device-local preview with no fees or prizes.']))),
    // SPA headers of the Scores and Profile pages, and the splash wallet note.
    scoresView: hosted ? 'Global Weekly, Monthly, and All-time leaderboards of verified Ranked runs, best score per wallet.' : 'Browse the device-local Ranked preview records saved in this browser.',
    profileWalletView: live ? 'Your verified Ranked runs, achievements, and on-chain name are tied to this wallet and follow you to any device.'
      : hosted ? 'Your profile and preferences follow this wallet to any device. Ranked is still a preview, so no score transaction is sent.'
      : 'Local progress, preview scores, achievements, and uploads are assigned to the connected wallet. No score transaction is sent while verified settlement is disabled.',
    walletConnected: hosted ? 'Your arcade profile is connected.' : 'Your local arcade profile is connected.',
    profileGuestView: live ? 'Sign in with a wallet to see your verified Ranked runs and achievements on any device. Every wallet’s profile is public.'
      : hosted ? 'Sign in with a wallet to see your profile on any device. Verified Ranked publishing is not available yet.'
      : 'Guest stats are local to this browser. Permanent or cross-device history and verified Ranked publishing are not available yet.',
    // SPA header of another wallet's public profile (/profile/<wallet>).
    profilePublicView: live ? 'This wallet’s public profile: its best scores, verified Ranked runs published on LitVM, and the achievements the arcade server recorded for it.'
      : hosted ? 'This wallet’s public profile. Verified Ranked publishing is not available yet, so it lists no verified runs.'
      : 'Public wallet profiles open when verified Ranked publishing goes live. This preview only shows the profile recorded on this device.',
    // trust.html paragraphs. `text` in backticks renders as <code>.
    trustStatus: Object.freeze(live ? [
      `Ranked is live on the LitVM LiteForge testnet. A Ranked run costs ${total} zkLTC: a ${fee} zkLTC entry, split ${developer}% to the game's developer and ${arcade}% to the arcade, plus a ${reserve} zkLTC settlement reserve that pays the arcade's relayer to publish your result. Free Mode is always free and needs no wallet.`,
      "The arcade server checks every Ranked run before its relayer publishes it on LitVM. Chikun's Escape and STACKED runs are replayed from their recorded inputs; a replay proves that a run follows the game's rules, not who played it. Hard Money Heroes runs are plausibility-checked against the game's limits and are not replayed; the check rejects impossible results but cannot prove how a run was played.",
      `${retries} Testnet entries are not refunded. ${noValue}${jackpot?.trust ?? ''}`,
    ] : [
      'Live settlement is disabled in this candidate: `SETTLEMENT_LIVE=false`. Local Ranked previews and locally cached sessions are not proof of verified settlement. A connected wallet alone does not make a result official.',
    ]),
    trustStorage: Object.freeze(hosted ? [
      (live ? 'Signing in and playing Ranked' : 'Signing in')+` also stores data on the arcade server, in a Neon Postgres database: ${serverRecords}. Rate limiting stores keyed hashes (HMAC) of IP addresses in short time windows, not raw IP addresses.`,
      live
        ? 'Your wallet address, display name, best scores, verified runs, and achievements are public on your profile and the leaderboards. Published results are also public records on the LitVM LiteForge testnet, which the arcade cannot delete.'
        : 'Your wallet address and display name can appear on your public profile.',
    ] : [
      "Profiles, achievements, and Ranked preview runs stay in this browser. This version does not send them to a Lester's Arcade server.",
    ]),
    // llms.txt "How it works" line and "Current scope" section.
    llmsHowItWorks: live ? 'Free play with no wallet, and wallet sign-in for Ranked runs on the LitVM testnet.'
      : hosted ? 'Free play, wallet sign-in and online profiles, and a Ranked preview.'
      : 'Free play, wallet profiles, and local Ranked previews.',
    llmsScope: live ? [
      `Ranked costs ${total} zkLTC per run on the LitVM LiteForge testnet: a ${fee} zkLTC entry, split ${developer}% to the game's developer and ${arcade}% to the arcade, plus a ${reserve} zkLTC settlement reserve for publishing. Free Mode is always free and needs no wallet.`,
      "The arcade server checks each Ranked run, then the arcade's relayer publishes it on LitVM. Chikun's Escape and STACKED runs are replayed on the server; Hard Money Heroes runs are plausibility-checked, not replayed.",
      "Global Weekly, Monthly, and All-time leaderboards rank each wallet's best verified score. Achievements are recorded against the wallet on the arcade server. Display names are set on chain and can be hidden by moderation.",
      `Failed publishes retry automatically and can be retried from the profile. Testnet entries are not refunded. ${noValue}`,
      ...(jackpot?.scope ? [jackpot.scope] : []),
    ].join('\n') : hosted
      ? 'Wallet sign-in and online profiles are available. Ranked is a preview: runs stay in this browser, with no entry fees, prizes, or on-chain score publishing. LitVM LiteForge is a testnet.'
      : 'Profiles and Ranked preview results stay in this browser. No entry fees, prizes, global rankings, cross-device history, or on-chain score publishing are available. LitVM LiteForge is a testnet.',
  });
}

// The Weekly Jackpot rules page, /jackpot/chikun (design §D.4). scripts/build-portal-pages.mjs renders
// each section into its <!-- copy:jackpot-rules-<id>:start/end --> block of apps/portal/jackpot/chikun.html.
// A section body is a list of blocks: a string is a paragraph, { list: [...] } a bullet list whose items
// are strings or [lead, text] pairs (the lead in bold), and { lead } a bold line. The page is noindex and
// out of the sitemap until the jackpot is live (live settlement and JACKPOT_LIVE), and while it is off
// it carries the soft-launch banner (design §D.6). Nothing here states an amount: amounts come only from
// the API, in the page's lazy module.
export const JACKPOT_RULES_SECTIONS = /* @__PURE__ */ Object.freeze(['what', 'eligible', 'winner', 'timeline', 'verification', 'disqualification', 'challenges', 'rollover', 'funding', 'claims', 'end', 'published', 'no-guarantee', 'testnet', 'legal', 'history']);
export const JACKPOT_CONTACT = 'kingdankkush420@gmail.com';

// Design §F.1: the owner-requested draft legal block (2026-09-25; not legal advice), verbatim. The
// @__PURE__ marks keep these constants out of the SPA bundle, which never renders the rules page. The
// rules template keeps <!-- LEGAL-REVIEW-PENDING: owner confirms at E10 --> beside it, and a live
// build refuses the page until the owner confirms the text and the E10 commit removes that comment.
export const JACKPOT_LEGAL_DRAFT = /* @__PURE__ */ Object.freeze({
  title: 'Weekly Jackpot rules',
  items: /* @__PURE__ */ Object.freeze([
    /* @__PURE__ */ Object.freeze(['Skill contest.', "The eligible wallet with the highest verified Ranked Chikun's Escape score for the week (Monday 00:00 UTC to the next Monday 00:00 UTC) wins that week's funded prize, paid on chain after a 24-hour review."]),
    /* @__PURE__ */ Object.freeze(['Entry.', 'Only Ranked runs count (0.102 testnet zkLTC per run). Free Mode is always free but is not eligible.']),
    /* @__PURE__ */ Object.freeze(['Prizes.', 'A prize exists only when it is funded on chain; the amount shown is the funded amount. If no eligible run qualifies, the prize rolls over to the next week.']),
    /* @__PURE__ */ Object.freeze(['Fair play.', 'Runs are replay-verified by the arcade server. Bots, scripts, exploits, shared or rented accounts, or any attempt to manipulate results lead to disqualification. Review decisions are final.']),
    /* @__PURE__ */ Object.freeze(['Eligibility.', "You must be 18 or older (or the age of majority where you live). Lester's Arcade staff and service wallets are not eligible. Void where prohibited; you are responsible for the laws, age limits and taxes that apply to you."]),
    /* @__PURE__ */ Object.freeze(['Testnet.', 'During the LiteForge testnet, prizes are testnet tokens with no monetary value. Real $CHIKUN prizes will come with updated rules.']),
    /* @__PURE__ */ Object.freeze(['Changes.', 'We may change, pause or end the Weekly Jackpot at any time; prizes already paid are unaffected.']),
    'Nothing here is financial advice. Memecoins are volatile.',
  ]),
});

export function jackpotRulesCopy({ settlementLive = false, chikunJackpotLive = false, legal = JACKPOT_LEGAL_DRAFT } = {}) {
  const live = settlementLive === true && chikunJackpotLive === true;
  const token = JACKPOT_TEST_TOKEN_SYMBOL;
  const list = (...items) => Object.freeze({ list: Object.freeze(items) });
  const section = (title, ...blocks) => Object.freeze({ title, blocks: Object.freeze(blocks) });
  return Object.freeze({
    live,
    title: `${JACKPOT_NAME} rules`,
    description: `How the ${JACKPOT_NAME} works: who can win, how runs are checked, when prizes are paid, and what is published.`,
    // Design §D.6: the soft-launch banner while the flag is off. Without live settlement (the preview
    // render) no Ranked run is published, so nothing can be paid and the banner says so.
    banner: live
      ? `The Weekly Jackpot runs on the LitVM LiteForge testnet. Prizes are paid in ${token}, a testnet token with no value.`
      : settlementLive === true
        ? `Soft launch: test prizes in ${token}, a token with no value, may be paid to the week's top eligible Ranked Chikun player. Every payout is reviewed by hand.`
        : 'The Weekly Jackpot is not running: Ranked runs are not published on LitVM yet, so no prizes are paid.',
    sections: Object.freeze({
      what: section('What it is',
        `The ${JACKPOT_NAME} is a weekly high-score prize for Ranked Chikun's Escape. Each week, the eligible run with the best verified score wins that week's funded prize.`,
        `Lester's Arcade and Louie, Chikun's original developer, fund the prizes together. Questions and disputes: ${JACKPOT_CONTACT}.`),
      eligible: section('Who can win',
        list(
          "Ranked Chikun's Escape runs of that week only, counted by the time the entry was paid (Monday 00:00 UTC to the next Monday 00:00 UTC), with a paid entry of at least the Ranked flat fee and in that week's Ranked season.",
          'Runs that reach the 60-minute limit are not eligible (the survival cap is 3,599 seconds).',
          'One person, one wallet: a person found using several wallets is disqualified on all of them.',
          "Lester's Arcade staff, the game's developers, prize funders and their households cannot win, as people and not only as wallets. Test wallets and blocked wallets cannot win.",
          'Entry fees do not fund the prize.')),
      winner: section('How the winner is chosen',
        'The highest verified score wins. A tie goes to the run published on LitVM first, then to the lower session id.'),
      timeline: section('Timeline',
        'The week closes every Monday at 00:00 UTC. A run must be published on LitVM within 6 hours of the close. For 12 hours after the close, anyone can add a better eligible run to the candidate list. The prize is paid 24 hours after the close.',
        'For an incident, such as a publishing outage near the close, the organiser can extend one week by up to 72 hours in total, and announces the extension.'),
      verification: section('How runs are checked',
        'The arcade server replays every Ranked run from its recorded inputs before it is published on LitVM. Candidate runs are checked again: the replay, the on-chain record, and automated checks.',
        'The automated checks catch only unsophisticated automation; a person reviews the leading runs and decides. "In review" means a run is waiting for that review. Runs that finish long after their entry was paid are always reviewed by a person.'),
      disqualification: section('Disqualification',
        'A run can be disqualified for automation, for failing the integrity checks, for breaking these rules, for an excluded wallet, or for one person using several wallets. The organiser may disqualify a run it believes was not played by a person in real time.',
        `Every decision is published on LitVM with its reason. Decisions are final: send a dispute to ${JACKPOT_CONTACT} within 7 days, and the organiser's answer is final.`),
      challenges: section('Challenges',
        'Anyone can put an eligible, better run of the week on the candidate list until 12 hours after the close. The best run that passes review is paid.'),
      rollover: section('Rollover and caps',
        "A week's pot that nobody wins rolls into the next week, with no time limit. When a week has a prize cap, the part of the pot above the cap rolls over too."),
      funding: section('Funding',
        `Lester's Arcade and Louie fund each week's prize in ${token} through the jackpot contract. Fund only through the contract: tokens sent to its address directly count toward no week.`,
        'The rules of a week funded in advance can still change before that week starts.'),
      claims: section('Unclaimed prizes',
        'If the token refuses to transfer a prize, the winner can claim it to another address from their profile. A prize still unclaimed 180 days after the payout returns to the prize pool.'),
      end: section('End of the jackpot',
        'The jackpot ends only with at least one week of notice. Funders get back what they paid in for weeks after the end. A final pot that nobody wins goes to the published contest wallet 30 days after the end.'),
      published: section('What is published',
        'The winning and candidate wallets, their display names (unless a name is hidden), their scores, replays of candidate runs that anyone can download once the week closes, and every review decision, which stays on LitVM permanently.'),
      'no-guarantee': section('No promised prize',
        'A week may have no prize, or its pot may roll over, be held for review, or be paused. The Weekly Jackpot is provided as is.'),
      testnet: section('Testnet',
        `${token} is a testnet token with no value. It cannot be redeemed or exchanged through the arcade. Testnet records are wiped at mainnet. Real $CHIKUN prizes need a new contract, new rules and a legal review.`),
      // The heading only: the §F.1 text renders into the page's own copy:jackpot-legal block (legalBlocks).
      legal: section('Taxes, eligibility and age'),
      history: section('Past weeks',
        live
          ? 'Past weeks, their winners and their replays load from the arcade server.'
          : 'Past weeks are listed here once the Weekly Jackpot is live.'),
    }),
    legalBlocks: Object.freeze([Object.freeze({ lead: legal.title }), list(...legal.items)]),
  });
}

// The copy for the committed flags. PORTAL_DESCRIPTION and PORTAL_FAQ keep
// their names for the builder and the SPA. It never carries the Weekly Jackpot's copy (jackpotCopy:
// the live statements and the serverRecords lines), which only the builder renders (faq, trustStatus,
// trustStorage, llmsScope): the SPA reads none of those fields (tests/jackpot-ui-rules-page.test.mjs),
// and this keeps their strings out of main.js.
export const PORTAL_COPY = siteCopy(PORTAL_FLAGS.settlementLive, PORTAL_FLAGS.hostedProfileSync, null);
export const PORTAL_DESCRIPTION = PORTAL_COPY.description;
export const PORTAL_FAQ = PORTAL_COPY.faq;

export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const gameFor = slug => PORTAL_GAMES.find(game => game.slug === slug || game.id === slug);

export function portalPageMeta(path = '/', copy = PORTAL_COPY) {
  const clean = path.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  const game = ['games','play'].includes(parts[0]) ? gameFor(parts[1]) : null;
  const privateView = ['profile','settings','scores','leaderboards'].includes(parts[0]) || parts.length > 2;
  const canonicalPath = game ? '/games/'+game.slug : clean === '/play' ? '/games' : clean;
  const title = game ? game.title+" — Play Free | Lester's Arcade" : canonicalPath === '/games' ? "Browse Games — Lester's Arcade" : privateView ? (parts[0][0].toUpperCase()+parts[0].slice(1))+" — Lester's Arcade" : "Lester's Arcade — Free Browser Games";
  return { title, description: game ? game.description+' Play Free in your browser on Lester’s Arcade.' : copy.description,
    canonical: PORTAL_ORIGIN+canonicalPath, image: PORTAL_ORIGIN+(game?.art ?? '/assets/video/arcade-splash-poster.jpg'),
    robots: privateView ? 'noindex, follow' : 'index, follow' };
}

export function portalSchema(path = '/', copy = PORTAL_COPY) {
  const meta = portalPageMeta(path, copy);
  const game = gameFor(path.split('/')[2]);
  const organization = PORTAL_ORIGIN+'/#organization';
  const website = PORTAL_ORIGIN+'/#website';
  const graph = [
    { '@type':'Organization', '@id':organization, name:"Lester's Arcade", url:PORTAL_ORIGIN+'/', logo:PORTAL_ORIGIN+'/assets/brand/lesters-arcade-logo-horizontal.png' },
    { '@type':'WebSite', '@id':website, name:"Lester's Arcade", url:PORTAL_ORIGIN+'/', description:copy.description, publisher:{'@id':organization}, inLanguage:'en' },
    { '@type':path === '/games' ? 'CollectionPage' : 'WebPage', '@id':meta.canonical+'#webpage', url:meta.canonical, name:meta.title, description:meta.description, isPartOf:{'@id':website}, ...(game ? {about:{'@id':PORTAL_ORIGIN+'/games/'+game.slug+'#game'}} : {}) },
    ...(game ? [game] : PORTAL_GAMES).map(item => ({
      '@type':'VideoGame', '@id':PORTAL_ORIGIN+'/games/'+item.slug+'#game', name:item.title,
      url:PORTAL_ORIGIN+'/games/'+item.slug, description:item.description, genre:item.genre,
      image:PORTAL_ORIGIN+item.art, gamePlatform:'Web browser', applicationCategory:'Game',
      operatingSystem:'Web browser', playMode:'SinglePlayer', isAccessibleForFree:true, publisher:{'@id':organization},
    })),
  ];
  if (path === '/games') graph.push({'@type':'ItemList', itemListElement:PORTAL_GAMES.map((item,index)=>({'@type':'ListItem',position:index+1,url:PORTAL_ORIGIN+'/games/'+item.slug,name:item.title}))});
  if (game) graph.push({'@type':'BreadcrumbList',itemListElement:[["Lester's Arcade",'/'],['Games','/games'],[game.title,'/games/'+game.slug]].map(([name,url],index)=>({'@type':'ListItem',position:index+1,name,item:PORTAL_ORIGIN+url}))});
  return JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c');
}

export function renderGameDetails(slug, copy = PORTAL_COPY) {
  const game=gameFor(slug);
  if(!game)return '';
  return `<section class="game-detail-story" aria-label="About ${escapeHtml(game.title)}">
    <div><p class="portal-kicker">${escapeHtml(game.genre)}</p><h2>${escapeHtml(game.tag)}</h2><p>${escapeHtml(game.description)}</p></div>
    <dl><div><dt>Your goal</dt><dd>${escapeHtml(game.goal)}</dd></div><div><dt>How to play</dt><dd>${escapeHtml(game.controls)}</dd></div><div><dt>Free or Ranked?</dt><dd>${escapeHtml(copy.rankedDetail[game.id])}</dd></div></dl>
    <a href="/games" class="portal-text-link">Explore all games →</a></section>`;
}

export function renderCatalog() {
  return PORTAL_GAMES.map((game,index)=>`<a class="official-cabinet-card playable featured-cabinet-card" data-game-slug="${game.slug}" href="/play/${game.slug}">
    <div class="cabinet-card-media"><span class="cabinet-number" aria-hidden="true">0${index+1}</span><span class="catalog-static-cabinet ${game.slug}" role="img" aria-label="${escapeHtml(game.title)} arcade cabinet"></span></div>
    <div class="cabinet-card-copy"><span class="cabinet-status-label">${game.status}</span><h2>${escapeHtml(game.title)}</h2><span class="cabinet-genre">${escapeHtml(game.genre)}</span><p>${escapeHtml(game.description)}</p><span class="cabinet-entry">Choose game <span aria-hidden="true">↗</span></span></div></a>`).join('');
}
