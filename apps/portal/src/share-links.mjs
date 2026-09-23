// End-of-run sharing shared by all three cabinets and the Ranked results
// screen (contract §7.4; guide §3.4, §5.12, decisions D12 and D13). Pure
// text/URL builders plus one DOM row built with createElement only (the
// portal forbids innerHTML). Posting is always user-initiated: the row only
// opens an intent page, hands the payload to the Web Share API, or copies
// text; nothing is sent anywhere by itself.
//
// X is primary: `@LestersArcade` rides in the text once, `related` suggests
// the account after posting, and there are no hashtags (D13). The URL is not
// part of the text: X appends it and counts it as 23 weighted characters.
// This file also ships in the Chikun and STACKED children, so keep it small.
// The Ranked and Free templates of the parent results screen live here too,
// as §7.4 specifies; the children never call them.

export const SHARE_ORIGIN = 'https://lestersarcade.io';
export const X_MENTION = '@LestersArcade';
export const X_RELATED = 'LestersArcade';

export const SHARE_TARGETS = Object.freeze({
  x: Object.freeze({ id: 'x', label: 'Share on X', endpoint: 'https://x.com/intent/post' }),
  facebook: Object.freeze({ id: 'facebook', label: 'Facebook', endpoint: 'https://www.facebook.com/sharer/sharer.php' }),
  discord: Object.freeze({ id: 'discord', label: 'Copy for Discord' }),
});

// X counts every URL as 23 and needs one separator before it: text + 24 ≤ 280.
const MAX_TEXT_WEIGHT = 256;

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
const TEMPLATES = Object.freeze({
  'lester-blaster': {
    icon: '🏆',
    title: 'Hard Money Heroes',
    detail: () => '',
    stats: (s) => `☠ ${count(s.kills)} kills · 🔥 ×${count(s.maxCombo)} combo · ⏱ ${shareClock(s.survivalSeconds)}`,
    call: 'Can you beat it?',
  },
  chikun: {
    icon: '🐔',
    title: "Chikun's Escape",
    detail: (s) => {
      const region = safeShareFragment(s.regionName ?? s.regionReached ?? '', 12);
      return ` · Lap ${count(number(s.laps) + 1)}${region ? ` · ${region[0].toUpperCase()}${region.slice(1)}` : ''}`;
    },
    stats: (s) => `🌾 ${count(s.forksPassed)} forks · ⚡ ${count(s.nearMisses)} near-misses · 🪙 ${count(s.coinsCollected)} coins`,
    call: 'Beat my flight',
  },
  stacked: {
    icon: '🧱',
    title: 'STACKED',
    detail: () => '',
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
    `${template.call} ${X_MENTION}`,
  ].join('\n');
}

// Free, preview and practice runs: no verification line (guide §5.12).
export function buildFreeShareText(gameId, { score = 0, stats = {} } = {}) {
  const template = templateFor(gameId);
  return [
    `🕹 FREE PLAY · ${template.title}`,
    `${count(score, 999_999_999_999)} pts${template.detail(stats ?? {})}`,
    template.stats(stats ?? {}),
    `Practising on ${X_MENTION}`,
  ].join('\n');
}

// x.com/intent/post carries text, url and related; never hashtags or via.
// Facebook's sharer takes only the URL. Discord has no intent endpoint, so it
// is a copy: the text, a newline, then the URL (which unfurls the card).
export function buildShareLinks({ text, url = SHARE_ORIGIN } = {}) {
  const message = fitWeight(lines(text));
  if (!message) throw new TypeError('share text is required');
  const link = String(url);
  return Object.freeze({
    text: message,
    url: link,
    x: `${SHARE_TARGETS.x.endpoint}?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link)}&related=${X_RELATED}`,
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

// One row: "Share on X" first, then a "More sharing" disclosure holding Copy
// for Discord, Facebook and the native share sheet (when the browser has
// one). `documentRef`/`navigatorRef` are injectable for tests. Returns the row
// element with a `refresh(links)` method so a panel can reuse it across runs.
export function createShareRow({
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  title = "Lester's Arcade",
  links,
  className = 'share-row',
  buttonClassName = 'share-button',
  onStatus = () => {},
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

  if (typeof navigatorRef?.share === 'function') {
    const native = make('button', 'native', 'Share…');
    native.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await navigatorRef.share({ title, text: current.text, url: current.url });
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
    x.href = current.x;
    facebook.href = current.facebook;
    delete row.dataset.shareStatus;
  };
  return row;
}
