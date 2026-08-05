import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthoredWorldPropPlacements,
  AUTHORED_DRESSING_DENSITY,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

// W1. Waves A1-A4 took the authored prop library from 26 world props to 49,
// but every one of those waves deliberately held district counts flat, so the
// world still placed 75 dressing items. This is where the library actually
// gets used.
//
// Two changes: higher per-district counts, and clustered placement. Scattered
// singles read as noise however many you add -- the art direction's rule is
// anchor plus satellites, so a few visual groups rather than confetti.

const build = (seed = 0x484d4807) => buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed });

test('the density table is exported so counts are reviewable in one place', () => {
  assert.ok(AUTHORED_DRESSING_DENSITY, 'density table must be exported');
  const total = Object.values(AUTHORED_DRESSING_DENSITY).reduce((sum, count) => sum + count, 0);
  assert.equal(Object.keys(AUTHORED_DRESSING_DENSITY).length, 6);
  assert.equal(total, 128);
});

test('dressing density rises across every district', () => {
  const placements = build();
  const byDistrict = new Map();
  for (const placement of placements) {
    byDistrict.set(placement.districtId, (byDistrict.get(placement.districtId) ?? 0) + 1);
  }
  assert.equal(placements.length, 128);
  assert.equal(byDistrict.size, 6);
  for (const [districtId, count] of byDistrict) {
    assert.equal(count, AUTHORED_DRESSING_DENSITY[districtId], `${districtId} count`);
    // The placement helper caps a district at 24; going over it would silently
    // truncate rather than fail.
    assert.ok(count <= 24, `${districtId} exceeds the placement cap`);
  }
});

test('placement stays deterministic and inside world bounds', () => {
  assert.deepEqual(build(), build());
  const placements = build();
  assert.ok(placements.every((p) => p.x >= 0 && p.x <= 12_000 && p.y >= 0 && p.y <= 4_800));
  assert.equal(new Set(placements.map((p) => p.id)).size, placements.length);
  assert.ok(placements.every((p) => p.runtimeAuthority === 'projection-only'));
});

// The route runs through the middle of the map. Dressing has always lived
// toward the district shoulders to keep it readable; more dressing must not
// start creeping into the corridor.
test('denser dressing still clears the central route corridor', () => {
  const placements = build();
  const inCorridor = placements.filter((p) => p.y > 1_700 && p.y < 3_100);
  assert.equal(
    inCorridor.length,
    0,
    `${inCorridor.length} dressing placements sit in the central route corridor`,
  );
});

// Anchor-plus-satellite is the point of the pass. Every placement carries the
// cluster it belongs to, so the grouping is inspectable rather than implied.
test('dressing is composed into clusters, not scattered singles', () => {
  const placements = build();
  assert.ok(
    placements.every((p) => typeof p.clusterId === 'string' && p.clusterId.length > 0),
    'every placement must name its cluster',
  );
  const clusters = new Map();
  for (const placement of placements) {
    const members = clusters.get(placement.clusterId) ?? [];
    members.push(placement);
    clusters.set(placement.clusterId, members);
  }
  // Clusters of one are allowed -- a lone tree is legitimate -- but most
  // dressing has to be grouped or nothing has changed.
  const grouped = [...clusters.values()].filter((members) => members.length > 1);
  const groupedCount = grouped.reduce((sum, members) => sum + members.length, 0);
  assert.ok(
    groupedCount / placements.length >= 0.6,
    `only ${groupedCount}/${placements.length} placements are in a group`,
  );
  assert.ok(clusters.size >= 24, `only ${clusters.size} clusters across six districts`);
});

test('satellites sit close to their anchor', () => {
  const placements = build();
  const anchors = new Map();
  for (const placement of placements) {
    if (placement.clusterRole === 'anchor') anchors.set(placement.clusterId, placement);
  }
  assert.ok(anchors.size > 0, 'no anchors found');
  for (const placement of placements) {
    if (placement.clusterRole !== 'satellite') continue;
    const anchor = anchors.get(placement.clusterId);
    assert.ok(anchor, `satellite ${placement.id} has no anchor`);
    const distance = Math.hypot(placement.x - anchor.x, placement.y - anchor.y);
    // Close enough to read as one group at gameplay zoom, far enough not to
    // overlap into a single blob.
    assert.ok(distance >= 40 && distance <= 320, `${placement.id} sits ${Math.round(distance)} from its anchor`);
  }
});

test('every cluster has exactly one anchor', () => {
  const placements = build();
  const roles = new Map();
  for (const placement of placements) {
    const counts = roles.get(placement.clusterId) ?? { anchor: 0, satellite: 0 };
    counts[placement.clusterRole] += 1;
    roles.set(placement.clusterId, counts);
  }
  for (const [clusterId, counts] of roles) {
    assert.equal(counts.anchor, 1, `${clusterId} has ${counts.anchor} anchors`);
  }
});

test('clusters do not collapse a district onto one prop', () => {
  const placements = build();
  const byDistrict = new Map();
  for (const placement of placements) {
    const list = byDistrict.get(placement.districtId) ?? [];
    list.push(placement.assetId);
    byDistrict.set(placement.districtId, list);
  }
  for (const [districtId, assetIds] of byDistrict) {
    const distinct = new Set(assetIds).size;
    assert.ok(distinct >= 6, `${districtId} draws on only ${distinct} distinct props`);
  }
});
