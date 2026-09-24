// Public, non-personal discovery facts shared by prerendered HTML and SPA views.
// The flags come from settlement.mjs, which imports arcade-core.mjs and the
// generated address module, so this module is for the browser and the page
// builder only: server/** and api/** never import it (tests/portal-copy.test.mjs).
import { SETTLEMENT_LIVE, HOSTED_PROFILE_SYNC } from './settlement.mjs';

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
export const PORTAL_FLAGS = Object.freeze({
  settlementLive: SETTLEMENT_LIVE === true,
  hostedProfileSync: HOSTED_PROFILE_SYNC === true,
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

const joinList = items => items.length < 3 ? items.join(' and ') : items.slice(0, -1).join('; ')+'; and '+items[items.length-1];

// Returns the public copy for one flag state. Contract §9.1 requires
// SETTLEMENT_LIVE => HOSTED_PROFILE_SYNC, so live settlement always gets the
// hosted profile wording. The states in use are preview (both false), hosted
// preview (profile sync only) and launch (both true).
export function portalCopyFor({ settlementLive = false, hostedProfileSync = false } = {}) {
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
  const noValue = 'Testnet zkLTC has no value, and there are no prizes.';
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
    ...(live ? [['How are Ranked runs checked and published?', "When a Ranked run ends, the arcade server checks it. Chikun's Escape and STACKED runs are replayed on the server from their recorded inputs. Hard Money Heroes runs are plausibility-checked against the game's limits; they are not replayed. The arcade's relayer then publishes the result on LitVM, and your results screen links to the transaction. "+retries]] : []),
    ['Can I play on my phone?', 'The three active games support on-screen touch controls as well as desktop input. A current browser is required. Performance varies by device; the games include settings for controls, audio, and visual effects.'],
  ];
  const serverRecords = joinList([
    'your wallet address',
    ...(live ? [
      "your verified Ranked sessions with their evidence (the recorded inputs that replay a Chikun's Escape or STACKED run, or the run summary of a Hard Money Heroes run), scores, stats, check results, and publishing status",
      'the achievements recorded for your wallet',
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
    // flip cannot leave a preview card live. STACKED's runtime cards come from
    // its own descriptor in arcade-core.mjs (ranked-client, contract §10.2);
    // pages without a per-game entry prerender the game-neutral modeRanked.
    modeSelect: Object.freeze({
      'lester-blaster': Object.freeze({
        copy: live
          ? 'Your Lester’s Arcade session is active. Choose Free Mode to play without a wallet, or sign in and choose Play Ranked to compete on the LitVM testnet.'
          : `Your Lester’s Arcade session is active. Choose Free Mode for local guest practice, or ${hosted ? 'sign in with' : 'connect'} a wallet and choose Play Ranked for a Ranked preview.`,
        ranked: live
          ? `${total} testnet zkLTC per run. The arcade server plausibility-checks your run (it is not replayed) and publishes it on LitVM.`
          : 'A wallet-bound Ranked preview run. No entry fee and no prizes; nothing is published on chain yet.',
      }),
      chikun: Object.freeze({
        copy: live
          ? 'Choose Free Mode for endless guest practice, or sign in and choose Play Ranked to compete on the LitVM testnet.'
          : `Choose Free Mode for endless guest practice, or ${hosted ? 'sign in with' : 'connect'} a wallet and choose Play Ranked for a replay-verified Ranked preview.`,
        ranked: live
          ? `${total} testnet zkLTC per run. The arcade server replays your run from its inputs and publishes it on LitVM.`
          : 'Wallet-bound play with replay verification. Accepted scores are saved on this device; nothing is published on chain yet.',
      }),
    }),
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
      `${retries} Testnet entries are not refunded. ${noValue}`,
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
      'Failed publishes retry automatically and can be retried from the profile. Testnet entries are not refunded. Testnet zkLTC has no value, and there are no prizes.',
    ].join('\n') : hosted
      ? 'Wallet sign-in and online profiles are available. Ranked is a preview: runs stay in this browser, with no entry fees, prizes, or on-chain score publishing. LitVM LiteForge is a testnet.'
      : 'Profiles and Ranked preview results stay in this browser. No entry fees, prizes, global rankings, cross-device history, or on-chain score publishing are available. LitVM LiteForge is a testnet.',
  });
}

// The copy for the committed flags. PORTAL_DESCRIPTION and PORTAL_FAQ keep
// their names for the builder and the SPA.
export const PORTAL_COPY = portalCopyFor(PORTAL_FLAGS);
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
