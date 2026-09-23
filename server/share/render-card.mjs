// E11 share card element (contract §7.5, §4.3.9; guide §3.4, §5.12 item 4).
//
// buildShareCardElement() returns a Satori element tree of plain objects (no
// JSX) for a 1200×630 card: the game's key-art background, score, handle (or
// the short wallet when the profile is hidden or the name blocked), standing,
// three headline stats, up to four badges, and "Verified on LitVM" ONLY when
// the session is confirmed ("Publishing to LitVM…" otherwise).
//
// Satori rules this file follows: every element with more than one child is
// display:flex; images are data URIs (a URL would make Satori fetch); text is
// restricted to glyphs the bundled Geist font covers, so Satori never loads a
// fallback font or emoji from a CDN (no network on render).
import { achievementById } from '../../apps/portal/src/achievements/index.mjs';

export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;
export const SHARE_CARD_MAX_BADGES = 4;

const TIER_COLOURS = Object.freeze({
  bronze: '#cd7f32', silver: '#c7d0dc', gold: '#ffd54a', platinum: '#7bf6ff', diamond: '#19f7ff', mythic: '#ff5fa2',
});
const GAME_TITLES = Object.freeze({ 'lester-blaster': 'Hard Money Heroes', chikun: "Chikun's Escape", stacked: 'STACKED' });
const CYAN = '#19f7ff';
const GOLD = '#ffe84d';
const GREEN = '#45ff8a';
const AMBER = '#ffb347';
const INK = '#f9f7ff';
const MUTED = '#b4c4df';

// Printable ASCII, Latin-1 letters and a few typographic marks: all in Geist.
export function cardText(value, max = 64) {
  const text = String(value ?? '').replace(/[^\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2022\u2026]/gu, '').replace(/\s+/g, ' ').trim();
  return [...text].slice(0, max).join('');
}

function whole(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function count(value) {
  const number = whole(value);
  return number === null ? '-' : number.toLocaleString('en-US');
}

function clock(value) {
  const seconds = whole(value);
  if (seconds === null) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

const HEADLINE_STATS = Object.freeze({
  'lester-blaster': [['Kills', (s) => count(s.kills)], ['Time', (s) => clock(s.survivalSeconds)], ['Combo', (s) => (whole(s.maxCombo) === null ? '-' : `×${count(s.maxCombo)}`)]],
  chikun: [['Forks', (s) => count(s.forksPassed)], ['Near-misses', (s) => count(s.nearMisses)], ['Coins', (s) => count(s.coinsCollected)]],
  stacked: [['Lines', (s) => count(s.lines)], ['Level', (s) => count(s.level)], ['Halvings', (s) => count(s.quadClears)]],
});

export function cardStandingText(standing) {
  const weekly = whole(standing?.weekly);
  const monthly = whole(standing?.monthly);
  const allTime = whole(standing?.allTime);
  const parts = [];
  if (weekly) parts.push(`#${weekly.toLocaleString('en-US')} this week`);
  else if (monthly) parts.push(`#${monthly.toLocaleString('en-US')} this month`);
  if (allTime) parts.push(`#${allTime.toLocaleString('en-US')} all-time`);
  return parts.join(' · ');
}

// Name on the card and page: the display name, or the short wallet when the
// name is null (hidden profile or blocked name, A29).
export function cardHandle(session) {
  const name = cardText(session?.displayName ?? '', 24);
  return name || cardText(session?.walletShort ?? '', 24) || 'Player';
}

const node = (type, style, children) => ({ type, props: { style, ...(children === undefined ? {} : { children }) } });
const flex = (style, children) => node('div', { display: 'flex', ...style }, children);
const text = (style, value) => node('div', { display: 'flex', ...style }, cardText(value, 80));

function badgeNode(badge) {
  const colour = TIER_COLOURS[badge.tier] ?? TIER_COLOURS.bronze;
  const inner = badge.image
    ? { type: 'img', props: { src: badge.image, width: 52, height: 52, style: { width: 52, height: 52, objectFit: 'contain' } } }
    : text({ fontSize: 30, color: colour }, cardText(badge.title, 1).toUpperCase() || '*');
  return flex({
    width: 72, height: 72, marginLeft: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 36,
    border: `3px solid ${colour}`, backgroundColor: 'rgba(5, 7, 18, 0.82)', boxShadow: `0 0 18px ${colour}`,
  }, [inner]);
}

function statNode([label, value], index) {
  return flex({
    flexDirection: 'column', minWidth: 190, marginLeft: index === 0 ? 0 : 14, padding: '12px 20px', borderRadius: 14,
    border: '2px solid rgba(25, 247, 255, 0.35)', backgroundColor: 'rgba(5, 7, 18, 0.78)',
  }, [
    text({ fontSize: 18, color: MUTED, letterSpacing: 3, textTransform: 'uppercase' }, label),
    text({ fontSize: 40, color: INK, marginTop: 2 }, value),
  ]);
}

// badgeImages: optional { [achievementId]: data URI } read by the handler.
export function buildShareCardElement({ session, background = null, badgeImages = {} } = {}) {
  if (!session || typeof session !== 'object') throw new TypeError('buildShareCardElement needs a session');
  const gameId = session.gameId;
  const confirmed = session.status === 'confirmed';
  const title = cardText(session.gameTitle ?? GAME_TITLES[gameId] ?? 'Ranked run', 32);
  const stats = session.stats && typeof session.stats === 'object' ? session.stats : {};
  const headline = (HEADLINE_STATS[gameId] ?? []).map(([label, read]) => [label, read(stats)]);
  const standing = cardStandingText(session.standing);
  const handle = cardHandle(session);
  const badges = (Array.isArray(session.achievements) ? session.achievements : []).slice(0, SHARE_CARD_MAX_BADGES).map((item) => {
    let entry = null;
    try { entry = achievementById(gameId, item?.id); } catch { entry = null; }
    const image = typeof badgeImages?.[item?.id] === 'string' && badgeImages[item.id].startsWith('data:image/') ? badgeImages[item.id] : null;
    return { tier: entry?.tier ?? item?.tier ?? 'bronze', title: entry?.title ?? item?.id ?? '', image };
  });

  const status = confirmed
    ? flex({ alignItems: 'center', padding: '10px 22px', borderRadius: 999, border: `3px solid ${GREEN}`, backgroundColor: 'rgba(6, 40, 24, 0.85)', color: GREEN, fontSize: 24, letterSpacing: 3 }, 'VERIFIED ON LITVM')
    : flex({ alignItems: 'center', padding: '10px 22px', borderRadius: 999, border: `3px solid ${AMBER}`, backgroundColor: 'rgba(48, 30, 4, 0.85)', color: AMBER, fontSize: 24, letterSpacing: 3 }, 'PUBLISHING TO LITVM…');

  const layers = [];
  if (typeof background === 'string' && background.startsWith('data:image/')) {
    layers.push({ type: 'img', props: { src: background, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, style: { position: 'absolute', top: 0, left: 0, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT } } });
  }
  layers.push(flex({
    position: 'absolute', top: 0, left: 0, width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, flexDirection: 'column', justifyContent: 'space-between',
    padding: '44px 56px 40px', border: `4px solid ${confirmed ? 'rgba(69, 255, 138, 0.55)' : 'rgba(25, 247, 255, 0.35)'}`,
  }, [
    flex({ justifyContent: 'space-between', alignItems: 'flex-start' }, [
      flex({ flexDirection: 'column' }, [
        text({ fontSize: 22, color: CYAN, letterSpacing: 6 }, "LESTER'S ARCADE · RANKED"),
        text({ fontSize: 44, color: INK, marginTop: 6 }, title),
      ]),
      status,
    ]),
    flex({ flexDirection: 'column' }, [
      flex({ alignItems: 'flex-end' }, [
        text({ fontSize: 148, color: '#ffffff', lineHeight: 1, textShadow: '0 0 24px rgba(25, 247, 255, 0.7)' }, count(session.score)),
        text({ fontSize: 40, color: CYAN, marginLeft: 18, marginBottom: 20, letterSpacing: 6 }, 'PTS'),
      ]),
      flex({ alignItems: 'center', marginTop: 10 }, [
        flex({ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundImage: `linear-gradient(135deg, ${CYAN}, #ff3df2)`, color: '#05070f', fontSize: 22 }, 'LA'),
        text({ fontSize: 36, color: CYAN, marginLeft: 16 }, handle),
        ...(standing ? [text({ fontSize: 30, color: GOLD, marginLeft: 26 }, standing)] : []),
      ]),
    ]),
    flex({ justifyContent: 'space-between', alignItems: 'flex-end' }, [
      flex({ alignItems: 'flex-end' }, headline.map(statNode)),
      flex({ flexDirection: 'column', alignItems: 'flex-end' }, [
        flex({ alignItems: 'center' }, badges.map(badgeNode)),
        text({ fontSize: 22, color: MUTED, marginTop: 14, letterSpacing: 2 }, 'lestersarcade.io'),
      ]),
    ]),
  ]));

  return flex({ position: 'relative', width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, backgroundColor: '#070512', fontFamily: 'Geist', color: INK }, layers);
}
