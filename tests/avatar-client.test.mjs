// 1.9.3 custom avatars in the browser: the on-demand encoder
// (src/avatar-upload.mjs), the index client's PUT/DELETE, the hosted Profile
// editor's "Upload your own", and every hosted surface preferring the upload.
// Driven by DOM and canvas doubles; no network.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  AVATAR_UPLOAD_COPY, AVATAR_UPLOAD_RULES, bytesToBase64, centerSquareCrop, checkAvatarFile, prepareAvatarUpload,
} from '../apps/portal/src/avatar-upload.mjs';
import { ARCADE_AVATARS, defaultArcadeAvatar } from '../apps/portal/src/arcade-avatars.mjs';
import { INDEX_API_ENDPOINTS, createIndexApiClient } from '../apps/portal/src/index-api-client.mjs';
import { hostedLeaderboardEntry } from '../apps/portal/src/leaderboard-view.mjs';
import { avatarUploadFailureWords, createHostedProfileView } from '../apps/portal/src/routes/hosted-profile-view.mjs';

const ME = `0x${'aa'.repeat(20)}`;
const AVATAR_URL = `/api/avatar?wallet=${ME}&v=0123456789ab`;
const settle = () => new Promise((resolve) => setImmediate(resolve));

// --- the encoder ---

test('the file check runs on type and size before anything is read', () => {
  assert.deepEqual(checkAvatarFile({ type: 'image/png', size: 1000 }), { ok: true });
  assert.deepEqual(checkAvatarFile({ type: 'image/jpeg', size: AVATAR_UPLOAD_RULES.maxFileBytes }), { ok: true });
  assert.deepEqual(checkAvatarFile({ type: 'image/jpeg', size: AVATAR_UPLOAD_RULES.maxFileBytes + 1 }), { ok: false, message: AVATAR_UPLOAD_COPY.size });
  for (const file of [null, { type: 'image/gif', size: 10 }, { type: 'image/svg+xml', size: 10 }, { type: 'image/webp', size: 10 }, { type: '', size: 10 }]) {
    assert.deepEqual(checkAvatarFile(file), { ok: false, message: AVATAR_UPLOAD_COPY.type }, JSON.stringify(file));
  }
  assert.equal(AVATAR_UPLOAD_RULES.accept, 'image/jpeg,image/png');
  assert.deepEqual(centerSquareCrop(1200, 800), { sx: 200, sy: 0, side: 800 });
  assert.deepEqual(centerSquareCrop(300, 301), { sx: 0, sy: 0, side: 300 });
  assert.deepEqual(centerSquareCrop(0, 10), { sx: 0, sy: 5, side: 0 });
  assert.equal(bytesToBase64(new Uint8Array([0, 255, 1, 2]).buffer, (text) => Buffer.from(text, 'latin1').toString('base64')), 'AP8BAg==');
  const big = new Uint8Array(100_000).map((_, index) => index % 251);
  assert.equal(bytesToBase64(big.buffer, (text) => Buffer.from(text, 'latin1').toString('base64')), Buffer.from(big).toString('base64'), 'chunked for large buffers');
});

function fakeCanvasEnv({ webp = true, sizes = {} } = {}) {
  const draws = [];
  const exports = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect() {}, drawImage: (...args) => draws.push(args), set fillStyle(value) {}, set imageSmoothingQuality(value) {} }),
    toBlob(callback, type, quality) {
      exports.push([type, quality]);
      const actual = type === 'image/webp' && !webp ? 'image/png' : type;
      const size = sizes[`${actual}@${quality}`] ?? 20_000;
      callback({ type: actual, size, arrayBuffer: async () => new Uint8Array(4).fill(7).buffer });
    },
  };
  const urls = [];
  return {
    draws,
    exports,
    canvas,
    urls,
    deps: {
      documentRef: { createElement: (tag) => { assert.equal(tag, 'canvas'); return canvas; } },
      createImageBitmapImpl: async () => ({ width: 1200, height: 800, close() {} }),
      urlApi: { createObjectURL: (blob) => { urls.push(blob); return `blob:preview-${urls.length}`; }, revokeObjectURL() {} },
      btoaImpl: (text) => Buffer.from(text, 'latin1').toString('base64'),
    },
  };
}

test('a picture is center-cropped to 256 px and exported as WebP', async () => {
  const env = fakeCanvasEnv();
  const prepared = await prepareAvatarUpload({ type: 'image/jpeg', size: 3_000_000 }, env.deps);
  assert.deepEqual(prepared, { ok: true, type: 'image/webp', bytes: 20_000, base64: 'BwcHBw==', previewUrl: 'blob:preview-1' });
  assert.deepEqual([env.canvas.width, env.canvas.height], [256, 256]);
  assert.deepEqual(env.draws[0].slice(1), [200, 0, 800, 800, 0, 0, 256, 256], 'the centered square, scaled to 256');
  assert.deepEqual(env.exports, [['image/webp', 0.86]]);
});

test('without a WebP encoder the picture is exported as JPEG, and quality drops until it fits 96 KB', async () => {
  const env = fakeCanvasEnv({ webp: false, sizes: { 'image/jpeg@0.86': 120_000, 'image/jpeg@0.72': 99_000 } });
  const prepared = await prepareAvatarUpload({ type: 'image/png', size: 100 }, env.deps);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.type, 'image/jpeg');
  assert.deepEqual(env.exports, [['image/webp', 0.86], ['image/jpeg', 0.86], ['image/jpeg', 0.72], ['image/jpeg', 0.56]]);
  const hopeless = fakeCanvasEnv({ sizes: Object.fromEntries(AVATAR_UPLOAD_RULES.qualities.map((q) => [`image/webp@${q}`, 200_000])) });
  assert.deepEqual(await prepareAvatarUpload({ type: 'image/png', size: 100 }, hopeless.deps), { ok: false, message: AVATAR_UPLOAD_COPY.tooLarge });
});

test('a file over 5 MB or of another type is refused before it is decoded', async () => {
  let decoded = 0;
  const deps = { createImageBitmapImpl: async () => { decoded += 1; return { width: 1, height: 1 }; } };
  assert.deepEqual(await prepareAvatarUpload({ type: 'image/png', size: 6 * 1024 * 1024 }, deps), { ok: false, message: AVATAR_UPLOAD_COPY.size });
  assert.deepEqual(await prepareAvatarUpload({ type: 'image/gif', size: 10 }, deps), { ok: false, message: AVATAR_UPLOAD_COPY.type });
  assert.equal(decoded, 0);
  const broken = fakeCanvasEnv();
  broken.deps.createImageBitmapImpl = async () => { throw new Error('not an image'); };
  broken.deps.ImageClass = class { set src(value) { queueMicrotask(() => this.onerror?.()); } };
  assert.deepEqual(await prepareAvatarUpload({ type: 'image/png', size: 10 }, broken.deps), { ok: false, message: AVATAR_UPLOAD_COPY.decode });
});

// --- the index client ---

test('the index client PUTs and DELETEs /api/avatar with the Bearer token', async () => {
  const calls = [];
  const client = createIndexApiClient({
    hosted: true,
    getToken: () => 'token-1',
    fetchImpl: async (url, init) => { calls.push([url, init]); return { ok: true, status: 200, json: async () => ({ ok: true, avatarUrl: AVATAR_URL }) }; },
  });
  assert.equal(INDEX_API_ENDPOINTS.avatar, '/api/avatar');
  assert.deepEqual(await client.uploadAvatar('QUJD'), { ok: true, avatarUrl: AVATAR_URL });
  assert.deepEqual(calls[0], ['/api/avatar', { method: 'PUT', headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer token-1' }, body: '{"image":"QUJD"}', cache: 'no-store' }]);
  await client.removeAvatar();
  assert.deepEqual(calls[1], ['/api/avatar', { method: 'DELETE', headers: { accept: 'application/json', authorization: 'Bearer token-1' }, cache: 'no-store' }]);
  assert.deepEqual(await client.uploadAvatar(''), { ok: false, error: 'invalid-image' });
  const signedOut = createIndexApiClient({ hosted: true, getToken: () => null, fetchImpl: async () => { throw new Error('no request'); } });
  assert.deepEqual(await signedOut.uploadAvatar('QUJD'), { ok: false, error: 'sign-in-required' });
  assert.deepEqual(await signedOut.removeAvatar(), { ok: false, error: 'sign-in-required' });
  const preview = createIndexApiClient({ hosted: false });
  assert.deepEqual(await preview.uploadAvatar('QUJD'), { ok: false, error: 'offline-preview' });
});

// --- the hosted views ---

function node(tag = 'div', props = {}) {
  return {
    tag,
    children: [],
    listeners: {},
    attributes: {},
    classList: { add() {} },
    ...props,
    dataset: { ...(props.dataset ?? {}) },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
  };
}
const walk = (root, visit) => { visit(root); for (const child of root.children ?? []) walk(child, visit); };
const all = (root, predicate) => { const hits = []; walk(root, (candidate) => { if (predicate(candidate)) hits.push(candidate); }); return hits; };
const byClass = (root, className) => all(root, (candidate) => String(candidate.className ?? '').split(/\s+/).includes(className));
const buttons = (root, label) => all(root, (candidate) => candidate.tag === 'button' && candidate.textContent === label);
const text = (root) => { const parts = []; walk(root, (candidate) => { if (candidate.textContent) parts.push(candidate.textContent); }); return parts.join(' '); };

function e6({ avatarUrl = null, avatarUri = 'lestersarcade:avatar/chikun', customAvatarHidden = false } = {}) {
  const profile = { displayName: 'Pic Pilot', avatarUri, hidden: false, onchainUpdatedAt: null, nameBlocked: null };
  if (avatarUrl) profile.avatarUrl = avatarUrl;
  if (customAvatarHidden) profile.customAvatarHidden = true;
  return { ok: true, wallet: ME, profile, games: {}, recentSessions: [], achievements: [], preferences: {}, updatedAt: null, jackpot: { wins: [] } };
}

function profileView({ answers = [e6()], avatarApi = {}, prepared = { ok: true, type: 'image/webp', base64: 'UklGRg==', previewUrl: 'blob:preview-1' } } = {}) {
  const grid = node('grid');
  const calls = { profile: 0, uploads: [], removes: 0, loads: 0, revoked: [] };
  const queue = [...answers];
  const indexApi = {
    profile: async () => { calls.profile += 1; return queue.length > 1 ? queue.shift() : queue[0]; },
    uploadAvatar: async (base64) => { calls.uploads.push(base64); return avatarApi.upload ?? { ok: true, avatarUrl: AVATAR_URL }; },
    removeAvatar: async () => { calls.removes += 1; return avatarApi.remove ?? { ok: true, removed: true }; },
    ...(avatarApi.noUpload ? { uploadAvatar: undefined, removeAvatar: undefined } : {}),
  };
  let view;
  const renderPage = () => view.render();
  view = createHostedProfileView({
    appendText: (parent, tag, content, className = '') => { const child = node(tag, { textContent: content, className }); parent.append(child); return child; },
    connectWallet: () => {},
    copyText: async () => {},
    deployment: { status: 'deployed', addresses: { playerProfileRegistry: `0x${'3e'.repeat(20)}` } },
    dom: { officialCabinetGrid: grid },
    el: (tag, props = {}) => node(tag, props),
    getContext: () => ({ connectedWallet: ME }),
    indexApi,
    isAuthenticated: () => true,
    loadAvatarUpload: async () => { calls.loads += 1; return { prepareAvatarUpload: async () => prepared }; },
    revokeObjectUrl: (url) => calls.revoked.push(url),
    playSfxCue: () => {},
    renderAchievementIcon: () => node('img'),
    renderAvatarChip: (wallet, name, className) => node('img', { className: `avatar-chip-img avatar-chip-default ${className}`, src: 'default.jpg' }),
    renderPage,
    requestAnimationFrameRef: (callback) => callback(),
    routeState: { gameId: 'lester-blaster', viewedWallet: null },
    setView: () => {},
    jackpotLive: false,
  });
  return { grid, view, calls };
}

async function shown(harness) {
  harness.view.render();
  await harness.view.hydrate();
  await settle();
  return harness.grid;
}

test('the name & avatar editor offers "Upload your own", previews, saves and reloads', async () => {
  const h = profileView({ answers: [e6(), e6({ avatarUrl: AVATAR_URL })] });
  let grid = await shown(h);
  assert.equal(byClass(grid, 'profile-avatar-option').length, ARCADE_AVATARS.length, 'the six presets stay');
  const input = byClass(grid, 'profile-avatar-file')[0];
  assert.deepEqual([input.type, input.accept, input.attributes['aria-label']], ['file', 'image/jpeg,image/png', 'Choose your own avatar picture']);
  assert.equal(buttons(grid, 'Upload your own').length, 1);
  assert.equal(buttons(grid, 'Remove custom avatar').length, 0, 'nothing to remove yet');
  assert.equal(h.calls.loads, 0, 'the encoder is not downloaded until a picture is picked');
  let clicked = 0;
  input.click = () => { clicked += 1; };
  buttons(grid, 'Upload your own')[0].listeners.click();
  assert.equal(clicked, 1, 'the button opens the file picker');

  input.files = [{ type: 'image/png', size: 1000 }];
  await input.listeners.change();
  grid = h.grid;
  assert.equal(h.calls.loads, 1);
  assert.equal(byClass(grid, 'profile-avatar-upload-preview')[0].src, 'blob:preview-1');
  assert.match(text(grid), /Preview ready/);
  assert.equal(h.calls.uploads.length, 0, 'nothing is sent before Save');

  await buttons(grid, 'Save picture')[0].listeners.click();
  await settle();
  grid = h.grid;
  assert.deepEqual(h.calls.uploads, ['UklGRg==']);
  assert.deepEqual(h.calls.revoked, ['blob:preview-1'], 'the preview URL is freed');
  assert.equal(h.calls.profile, 2, 'the self profile is read again');
  assert.match(text(grid), /Saved\. Your picture now shows/);
  assert.equal(byClass(grid, 'profile-hero-avatar')[0].src, AVATAR_URL, 'the hero shows the upload');
  assert.equal(byClass(grid, 'profile-avatar-upload-preview')[0].src, AVATAR_URL);
  assert.equal(buttons(grid, 'Remove custom avatar').length, 1);
});

test('Remove custom avatar deletes the upload; refusals are plain words', async () => {
  const h = profileView({ answers: [e6({ avatarUrl: AVATAR_URL }), e6()] });
  let grid = await shown(h);
  await buttons(grid, 'Remove custom avatar')[0].listeners.click();
  await settle();
  grid = h.grid;
  assert.equal(h.calls.removes, 1);
  assert.match(text(grid), /Removed\. Your arcade avatar shows again/);
  assert.equal(byClass(grid, 'profile-hero-avatar')[0].src, ARCADE_AVATARS.find((avatar) => avatar.id === 'chikun').src, 'the on-chain preset is back');

  const refused = profileView({ answers: [e6()], avatarApi: { upload: { ok: false, status: 429, error: 'rate-limited' } } });
  grid = await shown(refused);
  const input = byClass(grid, 'profile-avatar-file')[0];
  input.files = [{ type: 'image/jpeg', size: 10 }];
  await input.listeners.change();
  await buttons(refused.grid, 'Save picture')[0].listeners.click();
  assert.match(text(refused.grid), /Too many picture changes just now/);
  assert.equal(buttons(refused.grid, 'Save picture').length, 1, 'the preview stays for another try');

  const bad = profileView({ prepared: { ok: false, message: AVATAR_UPLOAD_COPY.size } });
  grid = await shown(bad);
  const badInput = byClass(grid, 'profile-avatar-file')[0];
  badInput.files = [{ type: 'image/png', size: 9e9 }];
  await badInput.listeners.change();
  assert.match(text(bad.grid), /over 5 MB/);
  assert.equal(buttons(bad.grid, 'Save picture').length, 0);

  for (const [answer, words] of [
    [{ error: 'avatar-hidden' }, /moderator hid/],
    [{ status: 401, error: 'http-401' }, /sign-in expired/],
    [{ error: 'unsupported-image-type' }, /JPG or PNG/],
    [{ error: 'something-else' }, /could not be saved/],
  ]) assert.match(avatarUploadFailureWords(answer), words, JSON.stringify(answer));
});

test('a moderated upload says so to its owner only; no upload controls without the endpoint', async () => {
  const hidden = await shown(profileView({ answers: [e6({ customAvatarHidden: true })] }));
  assert.match(text(hidden), /A moderator hid your uploaded picture/);
  const legacy = await shown(profileView({ avatarApi: { noUpload: true } }));
  assert.equal(byClass(legacy, 'profile-avatar-upload').length, 0);
  assert.equal(byClass(legacy, 'profile-avatar-option').length, ARCADE_AVATARS.length);
});

test('boards keep the row upload for the view, which renders it only through resolveAvatar', async () => {
  const row = { rank: 1, wallet: ME, displayName: 'Pic Pilot', avatarUri: 'lestersarcade:avatar/lilly', avatarUrl: AVATAR_URL, score: 10, stats: {} };
  assert.equal(hostedLeaderboardEntry(row).avatarUrl, AVATAR_URL);
  assert.equal(hostedLeaderboardEntry({ ...row, avatarUrl: undefined }).avatarUrl, null);
  const board = readFileSync(new URL('../apps/portal/src/routes/hosted-leaderboard-view.mjs', import.meta.url), 'utf8');
  assert.match(board, /const avatar = resolveAvatar\(entry\);/, 'podium and rows resolve upload, preset, default');
  assert.doesNotMatch(board, /arcadeAvatarForUri/);
  assert.equal(defaultArcadeAvatar().id, 'litecoin-chad');
});

test('the encoder stays out of the HMH game and the portal first paint', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /avatar-upload\.mjs/, 'main.js never imports the encoder');
  const view = readFileSync(new URL('../apps/portal/src/routes/hosted-profile-view.mjs', import.meta.url), 'utf8');
  assert.match(view, /loadAvatarUpload = \(\) => import\('\.\.\/avatar-upload\.mjs'\)/, 'the hosted profile loads it on demand');
  assert.doesNotMatch(view, /^import .*avatar-upload/m);
});
