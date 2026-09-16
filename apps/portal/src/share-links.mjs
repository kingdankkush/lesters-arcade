// End-of-run sharing shared by all three cabinets (owner direction
// 2026-09-16). Pure text/URL builders plus one DOM row built with
// createElement only (the portal forbids innerHTML). Posting is always
// user-initiated: the row only opens an intent page, hands the payload to the
// Web Share API, or copies text; nothing is sent anywhere by itself.

export const SHARE_ORIGIN = 'https://lestersarcade.io';

export const SHARE_TARGETS = Object.freeze({
  x: Object.freeze({ id: 'x', label: 'Post on X', endpoint: 'https://x.com/intent/post' }),
  facebook: Object.freeze({ id: 'facebook', label: 'Facebook', endpoint: 'https://www.facebook.com/sharer/sharer.php' }),
  discord: Object.freeze({ id: 'discord', label: 'Copy for Discord' }),
});

const MAX_TEXT = 280;

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function clock(totalSeconds) {
  const seconds = number(totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function shareUrlFor(gamePath = '') {
  const path = clean(gamePath).replace(/^\/+/, '');
  return path ? `${SHARE_ORIGIN}/${path}` : SHARE_ORIGIN;
}

// x.com/intent/post: text, url and comma-separated hashtags. Facebook's sharer
// only reliably honours the URL; the text rides along as `quote` where the
// composer still shows it. Discord has no intent endpoint, so it is a copy.
export function buildShareLinks({ text, url = SHARE_ORIGIN, hashtags = [] } = {}) {
  const message = clean(text).slice(0, MAX_TEXT);
  if (!message) throw new TypeError('share text is required');
  const tags = [...new Set(hashtags.map((tag) => clean(tag).replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '')).filter(Boolean))];
  const x = new URL(SHARE_TARGETS.x.endpoint);
  x.searchParams.set('text', message);
  x.searchParams.set('url', url);
  if (tags.length) x.searchParams.set('hashtags', tags.join(','));
  const facebook = new URL(SHARE_TARGETS.facebook.endpoint);
  facebook.searchParams.set('u', url);
  facebook.searchParams.set('quote', message);
  return Object.freeze({
    text: message,
    url,
    hashtags: Object.freeze(tags),
    x: x.toString(),
    facebook: facebook.toString(),
    discord: `${message}${tags.length ? ` ${tags.map((tag) => `#${tag}`).join(' ')}` : ''}\n${url}`,
  });
}

export function buildHmhShareText({ score = 0, kills = 0, level = 1, elapsedSeconds = 0, maxCombo = 0, killedBy = '', bossDefeated = false, ranked = false } = {}) {
  const parts = [`${number(kills)} enemies down`, `level ${Math.max(1, number(level))}`, `${clock(elapsedSeconds)} survived`];
  if (number(maxCombo) > 1) parts.push(`best combo ×${number(maxCombo)}`);
  if (bossDefeated) parts.push('the Liquidator liquidated');
  const cause = clean(killedBy);
  const ending = bossDefeated ? '' : cause ? ` Fell to ${cause}.` : '';
  return `I scored ${number(score).toLocaleString('en-US')} points in Hard Money Heroes: ${parts.join(', ')}.${ending} ${ranked ? 'Ranked run' : 'Free run'} at lestersarcade.io`;
}

export function buildStackedShareText({ score = 0, lines = 0, level = 1, tick = 0, quadClears = 0, maxCombo = 0, ranked = false, assisted = false } = {}) {
  const parts = [`${number(lines)} lines`, `level ${Math.max(1, number(level))}`, clock(number(tick) / 60)];
  if (number(quadClears) > 0) parts.push(`${number(quadClears)} ${number(quadClears) === 1 ? 'halving' : 'halvings'}`);
  if (number(maxCombo) > 1) parts.push(`best combo ${number(maxCombo)}`);
  const label = assisted ? 'Assisted practice' : ranked ? 'Ranked run' : 'Free practice';
  return `I scored ${number(score).toLocaleString('en-US')} points in STACKED: ${parts.join(', ')}. ${label} at lestersarcade.io`;
}

// One row: native share (when the browser has it), X, Facebook and a Discord
// copy. `documentRef` builds the nodes; `navigatorRef`/`windowRef` are
// injectable for tests. Returns the row element with a `refresh(links)` method
// so a panel can reuse it across runs without rebuilding listeners.
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

  const canNativeShare = typeof navigatorRef?.share === 'function';
  if (canNativeShare) {
    const native = documentRef.createElement('button');
    native.type = 'button';
    native.className = buttonClassName;
    native.dataset.share = 'native';
    native.textContent = 'Share…';
    native.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await navigatorRef.share({ title, text: current.text, url: current.url });
        status('Run shared.');
      } catch (error) {
        if (error?.name !== 'AbortError') status('Sharing is unavailable in this browser.');
      }
    });
    row.appendChild(native);
  }

  const anchors = {};
  for (const target of [SHARE_TARGETS.x, SHARE_TARGETS.facebook]) {
    const anchor = documentRef.createElement('a');
    anchor.className = buttonClassName;
    anchor.dataset.share = target.id;
    anchor.href = current[target.id];
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = target.label;
    anchor.addEventListener('click', () => status(`Opening ${target.label}…`));
    row.appendChild(anchor);
    anchors[target.id] = anchor;
  }

  const discord = documentRef.createElement('button');
  discord.type = 'button';
  discord.className = buttonClassName;
  discord.dataset.share = 'discord';
  discord.textContent = SHARE_TARGETS.discord.label;
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
  row.appendChild(discord);

  row.refresh = (nextLinks) => {
    if (!nextLinks?.x || !nextLinks?.facebook) throw new TypeError('share row refresh needs links');
    current = nextLinks;
    anchors.x.href = current.x;
    anchors.facebook.href = current.facebook;
    delete row.dataset.shareStatus;
  };
  return row;
}
