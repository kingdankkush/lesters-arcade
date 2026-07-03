import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  GROUND_PLANE_Y_OFFSET,
  groundPatternAnchorForOrigin,
  groundTileLatticePointForProjection,
} from '../apps/portal/src/hmh-ground-plane-rendering.mjs';
import {
  DEFAULT_ISO_TILE_HEIGHT,
  PROP_CONTACT_SHADOW_ALPHA,
  PROP_CONTACT_SHADOW_SCREEN_Y_OFFSET,
  propGroundContactPoint,
} from '../apps/portal/src/hmh-prop-grounding.mjs';

const coordinateDoc = readFileSync(new URL('../docs/game-design/hmh-coordinate-spaces.md', import.meta.url), 'utf8');
const groundSource = readFileSync(new URL('../apps/portal/src/hmh-ground-plane-rendering.mjs', import.meta.url), 'utf8');
const propSource = readFileSync(new URL('../apps/portal/src/hmh-prop-grounding.mjs', import.meta.url), 'utf8');
const syntaxSource = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

test('WO-68 coordinate-space doc names every render space and conversion helper', () => {
  assert.match(coordinateDoc, /World tile space/);
  assert.match(coordinateDoc, /Isometric projection space/);
  assert.match(coordinateDoc, /Ground texture lattice space/);
  assert.match(coordinateDoc, /Prop contact space/);
  assert.match(coordinateDoc, /Depth-sort space/);
  assert.match(coordinateDoc, /isoToScreen/);
  assert.match(coordinateDoc, /groundTileLatticePointForProjection/);
  assert.match(coordinateDoc, /propGroundContactPoint/);
  assert.match(coordinateDoc, /propFrontEdgeDepth/);
  assert.match(coordinateDoc, /npm run visual:regression/);
});

test('WO-68 render helpers expose named constants instead of unexplained offsets', () => {
  assert.equal(GROUND_PLANE_Y_OFFSET, 64);
  assert.equal(DEFAULT_ISO_TILE_HEIGHT, 64);
  assert.equal(PROP_CONTACT_SHADOW_ALPHA, 0.22);
  assert.equal(PROP_CONTACT_SHADOW_SCREEN_Y_OFFSET, 2);
  assert.equal(propGroundContactPoint({ x: 10, y: 20 }).y, 52);
  assert.match(groundSource, /World tile center projection/);
  assert.match(groundSource, /ground texture lattice/);
  assert.match(propSource, /front edge of the tile diamond/);
  assert.doesNotMatch(propSource, /tileHeight = 64/);
  assert.match(propSource, /DEFAULT_ISO_TILE_HEIGHT/);
});

test('WO-68 coordinate docs test is covered by the explicit syntax gate', () => {
  assert.match(syntaxSource, /tests\/hmh-coordinate-spaces\.test\.mjs/);
});
