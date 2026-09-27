// The HMH share-card background changed on 2026-09-26 (docs/art/HMH-BANNERS-20260926.md 6.1).
// Its art revision moves every HMH card revision, so CDNs and X/Discord re-fetch the new image
// for old shared links (the stale ?v= answers 302 to the current one); Chikun and STACKED keep theirs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

import { SHARE_CARD_ART, shareCardArtRevision } from '../server/share/card-art.mjs';
import { cardRevision } from '../server/neon/queries.mjs';
import { shareCardBackgroundUrl } from '../api/share-card.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fields = { status: 'confirmed', displayName: 'Ace Pilot', avatarUri: null, hidden: false, verification: 'plausibility' };

test('each listed background matches its recorded hash, so a new PNG needs a new revision', () => {
  assert.deepEqual(Object.keys(SHARE_CARD_ART), ['lester-blaster']);
  for (const [gameId, art] of Object.entries(SHARE_CARD_ART)) {
    const bytes = readFileSync(shareCardBackgroundUrl(gameId));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), art.sha256,
      `${gameId}.png changed: give SHARE_CARD_ART['${gameId}'] a new revision and hash (server/share/card-art.mjs)`);
    assert.match(art.revision, /^[a-z0-9-]+$/);
  }
});

test('the art revision moves HMH card revisions only', async () => {
  assert.equal(shareCardArtRevision('lester-blaster'), 'hmh-art-2026-09-26');
  for (const gameId of ['chikun', 'stacked', 'toString', '__proto__', undefined]) assert.equal(shareCardArtRevision(gameId), null, String(gameId));
  const plain = await cardRevision(fields);
  const hmh = await cardRevision({ ...fields, art: shareCardArtRevision('lester-blaster') });
  assert.notEqual(hmh, plain);
  assert.match(hmh, /^[0-9a-f]{12}$/);
  assert.equal(await cardRevision({ ...fields, art: shareCardArtRevision('chikun') }), plain, 'no art revision keeps every existing card revision');
  assert.equal(await cardRevision({ status: 'confirmed', displayName: null, avatarUri: null, hidden: false, verification: 'replay', art: null }), '9aad35cebaa9');
});

test('the HMH Ranked and Free share backgrounds are 1200x630 PNGs at or under 280 KB', () => {
  for (const name of ['lester-blaster', 'lester-blaster-free']) {
    const url = new URL(`../apps/portal/assets/share-cards/${name}.png`, import.meta.url);
    const bytes = readFileSync(url);
    assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, name);
    assert.equal(bytes.readUInt32BE(16), 1200, name);
    assert.equal(bytes.readUInt32BE(20), 630, name);
    assert.ok(statSync(url).size <= 280_000, `${name} at or under 280 KB`);
  }
});
