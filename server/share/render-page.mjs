// E10 share page HTML (contract §7.5, §4.3.9; guide §3.4, §5.12 item 3).
//
// renderSharePage({ session /* E9 shape */ | null, status }) → { status, headers, html }
//
// Server-rendered so X, Discord and Facebook read the OG and Twitter tags
// without running JavaScript; the page itself has no JS and inline CSS only.
// Every interpolated value goes through escapeHtml (names are moderated
// upstream, but the page never trusts that). A confirmed session shows
// "Verified on LitVM" and its transaction link; any other status shows
// "Publishing to LitVM…", no transaction link, and noindex (S14, C16). A null
// displayName (hidden profile or blocked name, A29) shows the short wallet and
// the default avatar. og:image is the versioned card URL (?v=cardRev, §7.5).
import { achievementById } from '../../apps/portal/src/achievements/index.mjs';
import { LITVM_DEPLOYMENT } from '../../apps/portal/src/generated/litvm-addresses.mjs';
import { INDEX_GAMES } from '../neon/rows.mjs';
import { cardHandle, cardStandingText } from './render-card.mjs';

export const SHARE_SITE_ORIGIN = 'https://lestersarcade.io';
export const SHARE_SITE_NAME = "Lester's Arcade";
export const SHARE_SITE_IMAGE = 'https://lestersarcade.io/assets/brand/lesters-arcade-logo-horizontal.png';
export const SHARE_DEFAULT_AVATAR = '/assets/lester-pilot.svg';
export const CONFIRMED_PAGE_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';
export const UNPUBLISHED_PAGE_CACHE = 'public, s-maxage=15';
export const MISSING_PAGE_CACHE = 'public, s-maxage=30';
const EXPLORER_TX = /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-f]{64}$/;
const SHARE_ID = /^[0-9a-f]{64}$/;
const TIERS = new Set(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic']);

const ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' });
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (char) => ESCAPES[char]);
}

function whole(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function count(value) {
  const number = whole(value);
  return number === null ? '—' : number.toLocaleString('en-US');
}

function clock(value) {
  const seconds = whole(value);
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function region(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : '—';
}

// The E9 headline stats (§6.3) per game, in the guide §3.3 order.
const PAGE_STATS = Object.freeze({
  'lester-blaster': [['Kills', (s) => count(s.kills)], ['Time', (s) => clock(s.survivalSeconds)], ['Best combo', (s) => (whole(s.maxCombo) === null ? '—' : `×${count(s.maxCombo)}`)], ['Level', (s) => count(s.level)], ['Boss', (s) => (whole(s.bossKills) === null ? '—' : whole(s.bossKills) > 0 ? 'Defeated' : 'Not defeated')]],
  chikun: [['Region', (s) => region(s.regionReached)], ['Laps', (s) => count(s.laps)], ['Forks', (s) => count(s.forksPassed)], ['Near-misses', (s) => count(s.nearMisses)], ['Coins', (s) => count(s.coinsCollected)], ['Best combo', (s) => (whole(s.bestCombo) === null ? '—' : `×${count(s.bestCombo)}`)]],
  stacked: [['Lines', (s) => count(s.lines)], ['Level', (s) => count(s.level)], ['Halvings', (s) => count(s.quadClears)], ['Perfect clears', (s) => count(s.perfectClears)], ['Best combo', (s) => (whole(s.maxCombo) === null ? '—' : `×${count(s.maxCombo)}`)], ['Time', (s) => clock(s.survivalSeconds)]],
});

// One line of stats for og:description (guide §5.12 wording).
const SUMMARY = Object.freeze({
  'lester-blaster': (s) => `${count(s.kills)} kills · ${clock(s.survivalSeconds)} survived · ×${count(s.maxCombo)} combo`,
  chikun: (s) => `${count(s.forksPassed)} forks · ${count(s.nearMisses)} near-misses · ${count(s.coinsCollected)} coins`,
  stacked: (s) => `${count(s.lines)} lines · level ${count(s.level)} · ${count(s.quadClears)} Halvings`,
});

const VERIFICATION_NOTE = Object.freeze({
  replay: 'Replayed and verified by the arcade server, then published on LitVM.',
  plausibility: 'Plausibility-checked by the arcade server, then published on LitVM.',
  'chain-index': 'Found on LitVM by the arcade indexer.',
});

const STYLE = `
:root{color-scheme:dark;--cyan:#19f7ff;--gold:#ffe84d;--green:#45ff8a;--amber:#ffb347;--ink:#f9f7ff;--muted:#b4aed4;--panel:rgba(4,11,26,.92);--edge:rgba(25,247,255,.28)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,rgba(255,61,242,.16),transparent 30rem),#070512;color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.45;overflow-x:hidden}
main{width:min(880px,100%);margin:0 auto;padding:clamp(16px,4vw,32px) 16px 48px;display:grid;gap:18px}
a{color:var(--cyan)}
.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.brand{color:var(--gold);font:900 .8rem/1.2 "Lucida Console",Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;text-decoration:none}
.panel{display:grid;gap:14px;padding:clamp(16px,4vw,28px);border:1px solid var(--edge);border-radius:24px;background:radial-gradient(circle at top right,rgba(255,232,77,.1),transparent 12rem),var(--panel);box-shadow:0 0 32px rgba(25,247,255,.12),inset 0 0 24px rgba(255,61,242,.06)}
.shot{width:100%;height:auto;aspect-ratio:1200/630;border-radius:16px;border:1px solid var(--edge);background:#05070f}
.eyebrow{margin:0;color:var(--gold);font:900 .75rem/1.2 "Lucida Console",Consolas,monospace;letter-spacing:.18em;text-transform:uppercase}
h1{margin:0;font:900 clamp(2.4rem,11vw,4.4rem)/1 "Trebuchet MS","Arial Black",sans-serif;text-shadow:0 0 18px rgba(25,247,255,.55)}
h1 small{font-size:.34em;color:var(--cyan);letter-spacing:.14em}
.who{display:flex;align-items:center;gap:12px;margin:0;font:700 1.05rem "Lucida Console",Consolas,monospace;color:var(--cyan);overflow-wrap:anywhere}
.who img{width:44px;height:44px;border-radius:50%;border:2px solid var(--cyan);background:#05070f}
.standing{margin:0;color:var(--gold);font-weight:800}
.status{justify-self:start;margin:0;padding:8px 16px;border-radius:999px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.status.verified{border:2px solid var(--green);color:var(--green);background:rgba(6,40,24,.8)}
.status.pending{border:2px solid var(--amber);color:var(--amber);background:rgba(48,30,4,.8)}
.note{margin:0;color:var(--muted);font-size:.92rem}
dl{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(120px,100%),1fr));gap:8px}
dl div{padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(7,17,36,.8)}
dt{color:var(--muted);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}
dd{margin:2px 0 0;font:900 1.25rem "Trebuchet MS",sans-serif}
h2{margin:0;color:var(--muted);font:.75rem "Lucida Console",Consolas,monospace;letter-spacing:.16em;text-transform:uppercase}
ul{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(170px,100%),1fr));gap:8px}
li{--tier:#cd7f32;display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--tier);border-radius:12px;background:rgba(7,17,36,.82)}
li img{width:40px;height:40px;border-radius:50%;border:2px solid var(--tier);image-rendering:pixelated}
li span{display:grid;font-weight:800;font-size:.9rem;min-width:0}
li small{color:var(--tier);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase}
li[data-tier=silver]{--tier:#c7d0dc}li[data-tier=gold]{--tier:#ffd54a}li[data-tier=platinum]{--tier:#7bf6ff}li[data-tier=diamond]{--tier:#19f7ff}li[data-tier=mythic]{--tier:#ff5fa2}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(7,17,36,.92);color:var(--ink);font-weight:900;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;flex:1 1 200px}
.button.primary{border-color:rgba(255,232,77,.75);background:linear-gradient(180deg,rgba(255,232,77,.24),rgba(201,163,78,.18)),#1c1205;color:#fff6c2;box-shadow:0 0 18px rgba(255,232,77,.22)}
a:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
footer{color:var(--muted);font-size:.85rem;text-align:center}
`.replace(/\n/g, '');

function metaTags({ title, description, url, image, imageAlt, noindex }) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    ...(noindex ? ['<meta name="robots" content="noindex">'] : []),
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${escapeHtml(SHARE_SITE_NAME)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    ...(image === SHARE_SITE_IMAGE ? [] : ['<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">']),
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:site" content="@LestersArcade">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ];
  return tags.join('\n');
}

function documentHtml(head, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<style>${STYLE}</style>
</head>
<body>
<main>
<div class="top"><a class="brand" href="/">${escapeHtml(SHARE_SITE_NAME)}</a><a href="/">Visit the arcade</a></div>
${body}
<footer>Lester's Arcade · retro arcade on LitVM LiteForge testnet</footer>
</main>
</body>
</html>
`;
}

const GENERIC = Object.freeze({
  404: { title: "Run not found · Lester's Arcade", heading: 'This run is not on the board', copy: 'The link may be mistyped, or the run has not been verified yet. Every Ranked run gets its own page once the arcade server verifies it.' },
  503: { title: "Lester's Arcade", heading: 'The run board is resting', copy: 'Ranked run pages are unavailable for a moment. The arcade itself is open.' },
  400: { title: "Lester's Arcade", heading: 'That is not a run link', copy: 'Share links look like lestersarcade.io/s/ followed by 64 letters and digits.' },
});

function genericPage(status) {
  const copy = GENERIC[status] ?? GENERIC[503];
  const head = metaTags({
    title: copy.title,
    description: 'Retro arcade cabinets on LitVM: play free, or play Ranked for on-chain leaderboards.',
    url: `${SHARE_SITE_ORIGIN}/`,
    image: SHARE_SITE_IMAGE,
    imageAlt: "Lester's Arcade logo",
    noindex: true,
  });
  const body = `<section class="panel">
<p class="eyebrow">Lester's Arcade</p>
<h1>${escapeHtml(copy.heading)}</h1>
<p class="note">${escapeHtml(copy.copy)}</p>
<nav class="actions" aria-label="Play"><a class="button primary" href="/">Enter the arcade</a></nav>
</section>`;
  return {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': status === 404 ? MISSING_PAGE_CACHE : 'no-store',
      'X-Robots-Tag': 'noindex',
    },
    html: documentHtml(head, body),
  };
}

function tokenHref(gameId, tokenId) {
  const collection = String(LITVM_DEPLOYMENT?.addresses?.achievementRegistries?.[gameId] ?? '').toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(collection) && /^[0-9]{1,78}$/.test(String(tokenId)) ? `https://liteforge.explorer.caldera.xyz/token/${collection}/instance/${tokenId}` : null;
}

// avatarSrc(avatarUri) → site-root image path. Until the profile avatars ship
// a map, every avatar (and every hidden profile) uses the default one.
export function renderSharePage({ session = null, status = 200, avatarSrc = () => SHARE_DEFAULT_AVATAR } = {}) {
  if (!session || status !== 200) return genericPage(status === 200 ? 404 : status);
  const shareId = String(session.shareId ?? '').toLowerCase();
  if (!SHARE_ID.test(shareId)) return genericPage(404);
  const gameId = session.gameId;
  const game = INDEX_GAMES[gameId];
  const gameTitle = game?.title ?? String(session.gameTitle ?? 'Ranked run');
  const confirmed = session.status === 'confirmed';
  const hidden = !session.displayName;
  const handle = hidden ? cardHandle({ walletShort: session.walletShort }) : String(session.displayName);
  const avatar = hidden ? SHARE_DEFAULT_AVATAR : (avatarSrc(session.avatarUri) || SHARE_DEFAULT_AVATAR);
  const score = count(session.score);
  const standing = confirmed ? cardStandingText(session.standing) : '';
  const stats = session.stats && typeof session.stats === 'object' ? session.stats : {};
  const statRows = (PAGE_STATS[gameId] ?? []).map(([label, read]) => [label, read(stats)]);
  const pageUrl = `${SHARE_SITE_ORIGIN}/s/${shareId}`;
  const cardRev = /^[0-9a-f]{12}$/.test(String(session.cardRev ?? '')) ? session.cardRev : '';
  const cardPath = `/api/share-card/${shareId}.png${cardRev ? `?v=${cardRev}` : ''}`;
  const cardUrl = `${SHARE_SITE_ORIGIN}${cardPath}`;
  const explorerUrl = confirmed && typeof session.explorerUrl === 'string' && EXPLORER_TX.test(session.explorerUrl) ? session.explorerUrl : null;
  const headlineStats = (SUMMARY[gameId] ?? (() => ''))(stats);

  const title = confirmed ? `${handle} scored ${score} in ${gameTitle}` : `${handle}'s ${gameTitle} run is publishing to LitVM`;
  const description = confirmed
    ? `Verified on LitVM · ${standing ? `${standing} · ` : ''}${headlineStats}. Can you beat it? Play free or Ranked at Lester's Arcade.`
    : `Publishing to LitVM… ${score} pts · ${headlineStats}. Play free or Ranked at Lester's Arcade.`;

  const head = metaTags({
    title, description, url: pageUrl, image: cardUrl,
    imageAlt: `${gameTitle} score card: ${score} points by ${handle}`,
    noindex: !confirmed,
  });

  const achievements = (Array.isArray(session.achievements) ? session.achievements : []).map((item) => {
    let entry = null;
    try { entry = achievementById(gameId, item?.id); } catch { entry = null; }
    const tier = TIERS.has(entry?.tier ?? item?.tier) ? (entry?.tier ?? item?.tier) : 'bronze';
    const image = entry?.image && /^\/assets\/[a-z0-9/._-]+\.png$/.test(entry.image) ? entry.image : null;
    // A32: a token is shown only once it exists (phase 2).
    const token = item?.tokenId ? tokenHref(gameId, item.tokenId) : null;
    return `<li data-tier="${escapeHtml(tier)}">${image ? `<img src="${escapeHtml(image)}" alt="" width="40" height="40" loading="lazy">` : ''}<span>${escapeHtml(entry?.title ?? item?.id ?? '')}<small>${escapeHtml(tier)}</small>${token ? `<a href="${escapeHtml(token)}" rel="noopener noreferrer">Minted</a>` : ''}</span></li>`;
  });

  const slug = game?.slug ?? '';
  const body = `<article class="panel" aria-labelledby="run-title">
<p class="eyebrow">Ranked · ${escapeHtml(gameTitle)}</p>
<img class="shot" src="${escapeHtml(cardPath)}" width="1200" height="630" alt="${escapeHtml(`${gameTitle} score card: ${score} points by ${handle}`)}">
<h1 id="run-title">${escapeHtml(score)} <small>PTS</small></h1>
<p class="who"><img src="${escapeHtml(avatar)}" alt="" width="44" height="44">${escapeHtml(handle)}</p>
${standing ? `<p class="standing">${escapeHtml(standing)}</p>` : ''}
${confirmed
    ? `<p class="status verified">✓ Verified on LitVM</p>
<p class="note">${escapeHtml(VERIFICATION_NOTE[session.verification] ?? VERIFICATION_NOTE.replay)}${explorerUrl ? ` <a href="${escapeHtml(explorerUrl)}" rel="noopener noreferrer">View the transaction on the LiteForge explorer</a>` : ''}</p>`
    : `<p class="status pending">Publishing to LitVM…</p>
<p class="note">The arcade server verified this run and is publishing it to LitVM. This page updates once it is on chain.</p>`}
<h2>Run stats</h2>
<dl>${statRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
${achievements.length ? `<h2>Achievements earned</h2>\n<ul>${achievements.join('')}</ul>` : ''}
<nav class="actions" aria-label="Play">
<a class="button primary" href="/play/${escapeHtml(slug)}">Play ${escapeHtml(gameTitle)}</a>
<a class="button" href="/">All arcade games</a>
</nav>
</article>`;

  return {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': confirmed ? CONFIRMED_PAGE_CACHE : UNPUBLISHED_PAGE_CACHE,
      ...(confirmed ? {} : { 'X-Robots-Tag': 'noindex' }),
    },
    html: documentHtml(head, body),
  };
}
