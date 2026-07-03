import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PROP_GROUNDING_POLICY_ID,
  propDrawRectForGroundContact,
  propFrontEdgeDepth,
  propGroundContactPoint,
  propShadowEllipseForGroundContact,
} from '../apps/portal/src/hmh-prop-grounding.mjs';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const syntaxSource = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

test('WO-64 prop grounding anchors sprite bottoms to the isometric tile front edge', () => {
  assert.equal(PROP_GROUNDING_POLICY_ID, 'wo64-prop-grounding-front-edge-v1');
  const projected = { x: 640, y: 360 };
  const contact = propGroundContactPoint(projected, { tileHeight: 64 });
  assert.deepEqual(contact, { x: 640, y: 392 });

  const rect = propDrawRectForGroundContact({ projected, drawWidth: 128, drawHeight: 180, tileHeight: 64 });
  assert.equal(rect.x, 576);
  assert.equal(rect.y, 212);
  assert.equal(rect.bottomY, 392);
  assert.deepEqual(rect.contact, contact);
});

test('WO-64 prop shadows share the same ground contact and stay below the sprite', () => {
  const shadow = propShadowEllipseForGroundContact({ projected: { x: 320, y: 240 }, drawWidth: 160, drawHeight: 220, tileHeight: 64 });
  assert.equal(shadow.x, 320);
  assert.equal(shadow.y, 274);
  assert.equal(shadow.radiusX >= 54, true);
  assert.equal(shadow.radiusY > 0 && shadow.radiusY <= 18, true);
  assert.equal(shadow.alpha > 0 && shadow.alpha < 0.5, true);
});

test('WO-64 front-edge depth sorts wider/taller footprints in front of same-center actors', () => {
  const projected = { x: 100, y: 200 };
  const small = propFrontEdgeDepth({ projected, footprint: { h: 0.5 }, radius: 0.25, tileHeight: 64 });
  const wide = propFrontEdgeDepth({ projected, footprint: { h: 3 }, radius: 1.5, tileHeight: 64 });
  assert.equal(wide > small, true);
  assert.equal(propFrontEdgeDepth({ projected, drawOrderBias: 8, tileHeight: 64 }) - propFrontEdgeDepth({ projected, tileHeight: 64 }), 8);
});

test('main renderer uses the WO-64 ground-contact, shadow, and front-edge depth helpers', () => {
  assert.match(mainSource, /hmh-prop-grounding\.mjs/);
  const renderBody = mainSource.slice(mainSource.indexOf('function buildObstacleRenderEntries'), mainSource.indexOf('function drawRoguelikeMinimap'));
  assert.match(renderBody, /propDrawRectForGroundContact\(/);
  assert.match(renderBody, /propShadowEllipseForGroundContact\(/);
  assert.match(renderBody, /propFrontEdgeDepth\(/);
  assert.doesNotMatch(renderBody, /projected\.y \+ style\.ground - drawH/);
  assert.doesNotMatch(renderBody, /Contact shadows are disabled/);
});

test('WO-64 grounding helper is covered by the explicit syntax gate', () => {
  assert.match(syntaxSource, /apps\/portal\/src\/hmh-prop-grounding\.mjs/);
  assert.match(syntaxSource, /tests\/hmh-prop-grounding\.test\.mjs/);
});
