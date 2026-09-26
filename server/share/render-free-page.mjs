// E13 Free share page HTML (plan docs/handoffs/free-share-20260926.md §7).
//
// renderFreeSharePage({ run /* decodeFreeRun */ | null, status, cacheable }) → { status, headers, html }
//
// Server-rendered so X, Discord and Facebook read the OG and Twitter tags
// without running JavaScript; the page itself has no JS and inline CSS only,
// reusing the Ranked page's tag set, document frame and stylesheet. Every
// value is a number or a label from free-run.mjs's tables, and every
// interpolation still goes through escapeHtml. The page says what it is
// ("Free Play · self-reported"), never "Verified" and never a transaction
// link; it is noindex on the page and in the headers; og:image is the Free
// card (E12), which the same token fully determines. The word "verified"
// appears nowhere on a Free page, not even in the stylesheet: the Free
// stylesheet is the Ranked one minus its verified/pending status pills plus
// the magenta Free accents, and the Ranked stylesheet itself is untouched.
import { FREE_GAMES, FREE_SHARE_CACHE, FREE_SHARE_INVALID_CACHE, count, imageAlt, pageDescription, pageTitle, statRows } from './free-run.mjs';
import { SHARE_PAGE_STYLE, SHARE_SITE_ORIGIN, documentHtml, escapeHtml, genericPage, metaTags } from './render-page.mjs';

export const FREE_PAGE_NOTE = "This score was reported by the player's browser; the arcade server has not checked it. Free runs never touch the Ranked boards or LitVM. Play Ranked to put a server-checked score on chain.";
const RANKED_PILLS = /\.status\.(?:verified|pending)\{[^}]*\}/g;
export const FREE_PAGE_STYLE = `${SHARE_PAGE_STYLE.replace(RANKED_PILLS, '').replace('--green:#45ff8a;', '')}:root{--magenta:#ff3df2}.eyebrow.free{color:var(--magenta)}.status.free{border:2px solid var(--magenta);color:var(--magenta);background:rgba(44,4,40,.8)}`;

const GENERIC = Object.freeze({
  400: { title: "Lester's Arcade", heading: 'That is not a run link', copy: 'Free share links look like lestersarcade.io/f/<game>/<code>.' },
  503: { title: "Lester's Arcade", heading: 'The arcade is resting', copy: 'Free run pages are unavailable for a moment. The arcade itself is open.' },
});

// A 400 for a pair that does not decode (invalid-game / invalid-token)
// depends on nothing but the URL, so it is held a minute at the edge; a 405
// (sent with the 400 copy), a conflicting query (`cacheable: false`) and a
// failure are no-store.
function freeGenericPage(status, { cacheable = true } = {}) {
  const code = status === 200 ? 400 : status;
  const copy = code === 400 || code === 405 ? GENERIC[400] : GENERIC[503];
  return genericPage(code, { copy, cacheControl: code === 400 && cacheable ? FREE_SHARE_INVALID_CACHE : 'no-store', style: FREE_PAGE_STYLE });
}

export function renderFreeSharePage({ run = null, status = 200, cacheable = true } = {}) {
  if (!run || typeof run !== 'object' || status !== 200) return freeGenericPage(status, { cacheable });
  const gameId = run.gameId;
  const title = String(run.title ?? FREE_GAMES[gameId]?.title ?? 'Free run');
  const slug = String(FREE_GAMES[gameId]?.slug ?? run.slug ?? '');
  const token = String(run.token ?? '');
  const score = count(run.values?.score);
  const pageUrl = `${SHARE_SITE_ORIGIN}/f/${slug}/${token}`;
  const cardPath = `/api/free-card/${slug}/${token}.png`;
  const cardUrl = `${SHARE_SITE_ORIGIN}${cardPath}`;
  const alt = imageAlt(run);

  const head = metaTags({
    title: pageTitle(run),
    description: pageDescription(run),
    url: pageUrl,
    image: cardUrl,
    imageAlt: alt,
    noindex: true,
  });

  const body = `<article class="panel" aria-labelledby="run-title">
<p class="eyebrow free">Free Play · ${escapeHtml(title)}</p>
<img class="shot" src="${escapeHtml(cardPath)}" width="1200" height="630" alt="${escapeHtml(alt)}">
<h1 id="run-title">${escapeHtml(score)} <small>PTS</small></h1>
<p class="status free">Free Play · self-reported</p>
<p class="note">${escapeHtml(FREE_PAGE_NOTE)}</p>
<h2>Run stats</h2>
<dl>${statRows(run).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
<nav class="actions" aria-label="Play">
<a class="button primary" href="/play/${escapeHtml(slug)}">Play ${escapeHtml(title)}</a>
<a class="button" href="/">All arcade games</a>
</nav>
</article>`;

  return {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': FREE_SHARE_CACHE,
      'X-Robots-Tag': 'noindex',
    },
    html: documentHtml(head, body, FREE_PAGE_STYLE),
  };
}
