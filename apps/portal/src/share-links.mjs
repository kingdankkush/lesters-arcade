// End-of-run sharing shared by all three cabinets and the Ranked results
// screen (contract §7.4; guide §3.4, §5.12, decisions D12 and D13). Pure
// text/URL builders plus one DOM row built with createElement only (the
// portal forbids innerHTML). Posting is always user-initiated: the row only
// opens an intent page, hands the payload to the Web Share API, or copies
// text; nothing is sent anywhere by itself.
//
// X is primary: `@LestersArcade` rides in the text once, `related` suggests
// the account after posting, and there are no hashtags (D13). The URL goes in
// the X text itself, on its own line after a blank line (1.9.3): X's composer
// only fetched the card image when the link was typed or pasted, not for the
// intent's `url` parameter, which it glued straight onto the mention. X
// counts the URL as 23 weighted characters.
// This file also ships in the Chikun and STACKED children, so keep it small.
// The Ranked and Free templates live here too, as §7.4 specifies; the
// children call only the Free one (a Free run links to its /f/ page, whose
// card the token fully determines: free-share-token.mjs).

export const SHARE_ORIGIN = 'https://lestersarcade.io';
export const X_MENTION = '@LestersArcade';
export const X_RELATED = 'LestersArcade';

export const SHARE_TARGETS = Object.freeze({
  x: Object.freeze({ id: 'x', label: 'Share on X', endpoint: 'https://x.com/intent/post' }),
  facebook: Object.freeze({ id: 'facebook', label: 'Facebook', endpoint: 'https://www.facebook.com/sharer/sharer.php' }),
  discord: Object.freeze({ id: 'discord', label: 'Copy for Discord' }),
});

// X counts every URL as 23, after a blank-line separator: text + 2 + 23 ≤ 280.
const MAX_TEXT_WEIGHT = 255;
// Closes the call-to-action line after the mention, so the mention is never
// the last thing before the link.
const CALL_EMOJI = '🎮';

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// Multi-line text keeps its newlines; each line is trimmed and collapsed.
function lines(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map(clean).join('\n').replace(/^\n+|\n+$/g, '');
}

function number(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

// Stats display at most 9,999,999 (no real run gets near it) and scores at
// most 999,999,999,999, which keeps every template inside X's limit.
function count(value, cap = 9_999_999) {
  return Math.min(number(value), cap).toLocaleString('en-US');
}

// m:ss (minutes never roll over into hours), capped at 359,999 seconds.
function shareClock(totalSeconds) {
  const seconds = Math.min(number(totalSeconds), 359_999);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Player- or caller-supplied fragments never add a mention, a hash, an
// address or a session handle to the text (§7.4 invariants). `#` and `@`
// (and the fullwidth forms X also reads as hashtags and mentions) go first,
// then addresses and `session-` are removed until nothing changes, so
// a removal can never splice a new forbidden token together ("sess#ion-",
// "sess0x…ion-"). Truncating the result cannot create one either.
export function safeShareFragment(value, max = 24) {
  let text = clean(value).replace(/[#@＃＠]/g, '');
  for (let previous = null; previous !== text;) {
    previous = text;
    text = text.replace(/0x[0-9a-f]{40}/gi, '').replace(/session-/gi, '');
  }
  return [...clean(text)].slice(0, max).join('').trim();
}

export function shareUrlFor(gamePath = '') {
  const path = clean(gamePath).replace(/^\/+/, '');
  return path ? `${SHARE_ORIGIN}/${path}` : SHARE_ORIGIN;
}

// §2.5: the share id is the session key without 0x, 64 lowercase hex.
export function sharePageUrl(sessionId32OrShareId) {
  const match = /^(?:0x)?([0-9a-f]{64})$/.exec(clean(sessionId32OrShareId).toLowerCase());
  if (!match) throw new TypeError('sharePageUrl needs a 32-byte session key');
  return `${SHARE_ORIGIN}/s/${match[1]}`;
}

// twitter-text v3 weights: code points in U+0000-U+10FF, U+2000-U+200D,
// U+2010-U+201F and U+2032-U+2037 weigh 1, everything else 2. URLs are not
// in the text (X adds them).
export function xWeightedLength(text) {
  let weight = 0;
  for (const char of String(text ?? '')) {
    const code = char.codePointAt(0);
    weight += code <= 0x10ff || (code >= 0x2000 && code <= 0x200d) || (code >= 0x2010 && code <= 0x201f) || (code >= 0x2032 && code <= 0x2037) ? 1 : 2;
  }
  return weight;
}

// Safety net only: every template is tested to fit with worst-case values.
function fitWeight(text) {
  const chars = [...text];
  if (xWeightedLength(text) <= MAX_TEXT_WEIGHT) return text;
  while (chars.length && xWeightedLength(chars.join('')) > MAX_TEXT_WEIGHT - 2) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

// Guide §5.12 templates, minus the URL line (X appends the url parameter).
// `detail`, `stats` and `call` are shared by Ranked and Free; `freeIcon`,
// `freeDetail` and `freeExtra` are Free-only (plan free-share-20260926 §5).
const TEMPLATES = Object.freeze({
  'lester-blaster': {
    icon: '🏆',
    freeIcon: '🧟',
    title: 'Hard Money Heroes',
    detail: () => '',
    freeDetail: (s) => {
      const hero = safeShareFragment(s.heroName, 16);
      return `${hero ? ` · ${hero}` : ''}${number(s.level) >= 1 ? ` · Lv ${count(s.level)}` : ''}`;
    },
    freeExtra: (s) => (s.bossDefeated === true || number(s.bossKills) >= 1 ? '💀 Liquidator liquidated' : ''),
    stats: (s) => `☠ ${count(s.kills)} kills · 🔥 ×${count(s.maxCombo)} combo · ⏱ ${shareClock(s.survivalSeconds)}`,
    call: 'Can you beat it?',
  },
  chikun: {
    icon: '🐔',
    freeIcon: '🐔',
    title: "Chikun's Escape",
    detail: (s) => {
      const region = safeShareFragment(s.regionName ?? s.regionReached ?? '', 12);
      return ` · Lap ${count(number(s.laps) + 1)}${region ? ` · ${region[0].toUpperCase()}${region.slice(1)}` : ''}`;
    },
    freeDetail: (s) => {
      const daily = safeShareFragment(s.dailyLabel, 16);
      return daily ? ` · ${daily}` : '';
    },
    freeExtra: (s) => (number(s.survivalSeconds) > 0 ? `⏱ ${shareClock(s.survivalSeconds)} flight · 🔥 ×${count(s.bestCombo)} combo` : ''),
    stats: (s) => `🌾 ${count(s.forksPassed)} forks · ⚡ ${count(s.nearMisses)} near-misses · 🪙 ${count(s.coinsCollected)} coins`,
    call: 'Beat my flight',
  },
  stacked: {
    icon: '🧱',
    freeIcon: '🧱',
    title: 'STACKED',
    detail: () => '',
    freeDetail: (s) => `${number(s.survivalSeconds) > 0 ? ` · ⏱ ${shareClock(s.survivalSeconds)}` : ''}${number(s.maxCombo) > 1 ? ` · 🔥 ×${count(s.maxCombo)} combo` : ''}${s.assisted === true ? ' · Assisted' : ''}`,
    freeExtra: () => '',
    stats: (s) => `📈 ${count(s.lines)} lines · Lv ${count(Math.max(1, number(s.level)))} · ${count(s.quadClears)} ${number(s.quadClears) === 1 ? 'Halving' : 'Halvings'}`,
    call: 'Stack higher',
  },
});

function templateFor(gameId) {
  if (!Object.hasOwn(TEMPLATES, gameId)) throw new TypeError(`no share template for ${gameId}`);
  return TEMPLATES[gameId];
}

// Used only for a published (confirmed) run: it carries the verification line.
export function buildRankedShareText(gameId, { score = 0, standingLabel = '', stats = {}, personalBest = false } = {}) {
  const template = templateFor(gameId);
  const standing = safeShareFragment(standingLabel);
  return [
    `${template.icon} RANKED · ${template.title}`,
    `${count(score, 999_999_999_999)} pts${standing ? ` · ${standing}` : ''}${template.detail(stats ?? {})}`,
    template.stats(stats ?? {}),
    ...(personalBest ? ['🔥 New personal best!'] : []),
    '⛓ Verified on LitVM',
    `${template.call} ${X_MENTION} ${CALL_EMOJI}`,
  ].join('\n');
}

// Free, preview and practice runs: the Ranked family with the game's Free
// icon and "FREE PLAY" on line 1, the Ranked stats line verbatim, the Free
// detail and extra line, and the Ranked call to action; never a
// verification line (guide §5.12, amended by plan free-share-20260926 §5).
export function buildFreeShareText(gameId, { score = 0, stats = {} } = {}) {
  const template = templateFor(gameId);
  const s = stats ?? {};
  const extra = template.freeExtra(s);
  return [
    `${template.freeIcon} FREE PLAY · ${template.title}`,
    `${count(score, 999_999_999_999)} pts${template.detail(s)}${template.freeDetail(s)}`,
    template.stats(s),
    ...(extra ? [extra] : []),
    `${template.call} ${X_MENTION} ${CALL_EMOJI}`,
  ].join('\n');
}

// x.com/intent/post carries the text with the link on its last line, and
// related; never hashtags or via.
// Facebook's sharer takes only the URL. Discord has no intent endpoint, so it
// is a copy: the text, a newline, then the URL (which unfurls the card).
// `card` is the Free card's same-origin path (free-share-token.mjs) for the
// native file share, or null.
export function buildShareLinks({ text, url = SHARE_ORIGIN, card = null } = {}) {
  const message = fitWeight(lines(text));
  if (!message) throw new TypeError('share text is required');
  const link = String(url);
  return Object.freeze({
    text: message,
    url: link,
    card: card == null ? null : String(card),
    x: `${SHARE_TARGETS.x.endpoint}?text=${encodeURIComponent(`${message}\n\n${link}`)}&related=${X_RELATED}`,
    facebook: `${SHARE_TARGETS.facebook.endpoint}?u=${encodeURIComponent(link)}`,
    discord: `${message}\n${link}`,
  });
}

// Free-run one-liners for the HMH summary and the STACKED child.
export function buildHmhShareText({ score = 0, kills = 0, level = 1, elapsedSeconds = 0, maxCombo = 0, killedBy = '', bossDefeated = false, ranked = false } = {}) {
  const parts = [`${number(kills)} enemies down`, `level ${Math.max(1, number(level))}`, `${shareClock(elapsedSeconds)} survived`];
  if (number(maxCombo) > 1) parts.push(`best combo ×${number(maxCombo)}`);
  if (bossDefeated) parts.push('the Liquidator liquidated');
  const cause = safeShareFragment(killedBy);
  const ending = bossDefeated ? '' : cause ? ` Fell to ${cause}.` : '';
  return `I scored ${number(score).toLocaleString('en-US')} points in Hard Money Heroes: ${parts.join(', ')}.${ending} ${ranked ? 'Ranked run' : 'Free run'} on ${X_MENTION}`;
}

export function buildStackedShareText({ score = 0, lines: cleared = 0, level = 1, tick = 0, quadClears = 0, maxCombo = 0, ranked = false, assisted = false } = {}) {
  const parts = [`${number(cleared)} lines`, `level ${Math.max(1, number(level))}`, shareClock(number(tick) / 60)];
  if (number(quadClears) > 0) parts.push(`${number(quadClears)} ${number(quadClears) === 1 ? 'halving' : 'halvings'}`);
  if (number(maxCombo) > 1) parts.push(`best combo ${number(maxCombo)}`);
  const label = assisted ? 'Assisted practice' : ranked ? 'Ranked run' : 'Free practice';
  return `I scored ${number(score).toLocaleString('en-US')} points in STACKED: ${parts.join(', ')}. ${label} on ${X_MENTION}`;
}

let menuSerial = 0;
const wait = (ms) => new Promise((resolve) => { setTimeout(() => resolve(null), ms); });

// 1.9.4: every run's share link is new to X, and X's composer shows the card
// only once X has fetched it, so a slow first render (about 2 s for a fresh
// card) leaves the composer blank. Once a results row has been on screen,
// fetch its share page (what X reads) and the og:image that page names, so
// the CDN already holds both when X asks. Once per link; errors are ignored.
const warmedPages = new Set();
function warmSharePreview(url, fetchRef, pageOrigin) {
  const page = String(url ?? '');
  const key = `${pageOrigin ?? ''}|${page}`;
  if (typeof fetchRef !== 'function' || !page.startsWith(`${SHARE_ORIGIN}/`) || !/^https:\/\/[^/]+\/(?:s|f)\//.test(page) || warmedPages.has(key)) return;
  // A preview/local run exists on its serving backend. Warm that backend,
  // while keeping the public link and social metadata canonical.
  const fetchUrl = value => pageOrigin && pageOrigin !== SHARE_ORIGIN && value.startsWith(`${SHARE_ORIGIN}/`) ? value.slice(SHARE_ORIGIN.length) : value;
  warmedPages.add(key);
  fetchRef(fetchUrl(page), { credentials: 'omit' })
    .then((response) => (response.ok ? response.text() : ''))
    .then((html) => {
      const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, '&');
      return image && (image.startsWith(`${SHARE_ORIGIN}/`) || /^\/api\/(?:share-card|free-card)\//.test(image)) ? fetchRef(fetchUrl(image), { credentials: 'omit' }) : null;
    })
    .catch(() => {});
}

// The Web Share API path: the card image as a file when the browser can share
// files and the links carry a card, else text + URL. The card is fetched
// through the lazy share-file chunk ahead of the tap once the results have
// stayed on screen for idleMs (a quick restart downloads nothing and renders
// nothing), or at the latest on the tap; share() waits at most 700 ms for it,
// so the tap keeps its transient activation, and falls back to text on any
// failure but a cancel. prepare(links) re-arms it for the next run.
export function createNativeShare({ navigatorRef = globalThis.navigator, title = "Lester's Arcade", links, loadShareFile = () => import('./share-file.mjs'), idleMs = 1_200, stillShown = () => true, fetchRef = typeof window === 'object' ? globalThis.fetch?.bind(globalThis) : undefined, pageOrigin = globalThis.location?.origin } = {}) {
  let current = links;
  let prepared = null;
  let timer = null;
  const fetchCard = () => {
    const card = current?.card;
    if (!prepared && card && typeof navigatorRef?.canShare === 'function' && typeof File === 'function') {
      prepared = Promise.resolve().then(loadShareFile).then((m) => (m.canShareFiles(navigatorRef) ? m.fetchShareCardFile(card) : null)).catch(() => null);
    }
    return prepared;
  };
  const native = {
    prepare(next = current) {
      current = next;
      prepared = null;
      clearTimeout(timer);
      // A row can be built before its panel appears (Chikun shows the
      // results after the death animation), so an unseen row keeps checking,
      // for up to 30 checks, until it has been on screen for idleMs.
      let checks = 30;
      const arm = () => { timer = setTimeout(() => { if (stillShown()) { fetchCard(); warmSharePreview(current?.url, fetchRef, pageOrigin); } else if (--checks) arm(); }, idleMs); };
      arm();
    },
    async share() {
      clearTimeout(timer);
      const pending = fetchCard();
      const file = pending ? await Promise.race([pending, wait(700)]) : null;
      const payload = { title, text: current.text, url: current.url };
      if (file && navigatorRef.canShare?.({ files: [file] })) {
        try {
          await navigatorRef.share({ ...payload, files: [file] });
          return 'card';
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
        }
      }
      await navigatorRef.share(payload);
      return 'text';
    },
  };
  native.prepare();
  return native;
}

// One row: "Share on X" first, then a "More sharing" disclosure holding Copy
// for Discord, Facebook and the native share sheet (when the browser has
// one, unless `nativeButton` is false because the page has its own).
// `documentRef`/`navigatorRef`/`loadShareFile` are injectable for tests.
// Returns the row element with `links`, `native` (createNativeShare) and a
// `refresh(links)` method so a panel can reuse it across runs.
export function createShareRow({
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  title = "Lester's Arcade",
  links,
  className = 'share-row',
  buttonClassName = 'share-button',
  onStatus = () => {},
  nativeButton = true,
  loadShareFile,
} = {}) {
  if (!documentRef?.createElement) throw new TypeError('share row needs a document');
  if (!links?.x || !links?.facebook) throw new TypeError('share row needs links from buildShareLinks');
  let current = links;
  const row = documentRef.createElement('div');
  row.className = className;
  row.dataset.shareRow = 'true';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Share this run');
  const status = (message) => { row.dataset.shareStatus = message; onStatus(message); };
  const make = (tag, share, text) => {
    const node = documentRef.createElement(tag);
    node.className = buttonClassName;
    node.dataset.share = share;
    node.textContent = text;
    if (tag === 'button') node.type = 'button';
    return node;
  };
  const link = (target) => {
    const anchor = make('a', target.id, target.label);
    anchor.href = current[target.id];
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.addEventListener('click', () => status(`Opening ${target.label}…`));
    return anchor;
  };

  const x = link(SHARE_TARGETS.x);
  x.className = `${buttonClassName} share-primary`;
  const more = make('button', 'more', 'More sharing');
  const menu = documentRef.createElement('div');
  menu.id = `share-menu-${++menuSerial}`;
  menu.className = 'share-menu';
  menu.dataset.shareMenu = 'true';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'More ways to share');
  const setOpen = (open) => {
    // display:contents keeps the menu items in the row's own flex flow.
    menu.style.display = open ? 'contents' : 'none';
    more.setAttribute('aria-expanded', String(open));
  };
  more.setAttribute('aria-controls', menu.id);
  more.addEventListener('click', (event) => { event.preventDefault(); setOpen(more.getAttribute('aria-expanded') !== 'true'); });
  // Escape anywhere in the row (the toggle included) closes an open menu
  // first and keeps focus on the toggle; it never reaches an enclosing
  // dialog while the menu is open.
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || more.getAttribute('aria-expanded') !== 'true') return;
    event.preventDefault?.();
    event.stopPropagation();
    setOpen(false);
    more.focus?.();
  });
  setOpen(false);

  const discord = make('button', 'discord', SHARE_TARGETS.discord.label);
  discord.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      if (!navigatorRef?.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigatorRef.clipboard.writeText(current.discord);
      discord.textContent = 'Copied';
      status('Run summary copied. Paste it into Discord.');
    } catch {
      discord.textContent = 'Copy unavailable';
      status('Copying is unavailable in this browser.');
    }
    setTimeout(() => { discord.textContent = SHARE_TARGETS.discord.label; }, 1_500);
  });
  const facebook = link(SHARE_TARGETS.facebook);
  menu.append(discord, facebook);

  row.links = current;
  // Prefetch the card only while the row is actually on screen.
  const stillShown = () => row.isConnected !== false && row.offsetParent !== null && documentRef.visibilityState !== 'hidden';
  row.native = createNativeShare({ navigatorRef, title, links: current, stillShown, ...(loadShareFile ? { loadShareFile } : {}) });
  if (nativeButton && typeof navigatorRef?.share === 'function') {
    const native = make('button', 'native', 'Share…');
    native.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await row.native.share();
        status('Run shared.');
      } catch (error) {
        if (error?.name !== 'AbortError') status('Sharing is unavailable in this browser.');
      }
    });
    menu.append(native);
  }
  row.append(x, more, menu);

  row.refresh = (nextLinks) => {
    if (!nextLinks?.x || !nextLinks?.facebook) throw new TypeError('share row refresh needs links');
    current = nextLinks;
    row.links = current;
    row.native.prepare(current);
    x.href = current.x;
    facebook.href = current.facebook;
    delete row.dataset.shareStatus;
  };
  return row;
}
