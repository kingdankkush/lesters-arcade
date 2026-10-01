// W4a: the 2.0.x ten-area Free preview produces no Ranked submission, and the
// server verifier keeps the frozen legacy map contexts for schema 6 and 7.
// From game 2.1.0 the ten-area world is Level 1 under its own schema-8 context
// (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md); the legacy contexts, catalogues
// and validators do not move.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolveHmhMapContext } from '../server/verify/hmh-map-context.mjs';
import { validateV6RunPlausibility, validateV7RunPlausibility } from '../server/verify/hmh-plausibility.mjs';
import { validateV8RunPlausibility } from '../server/verify/hmh-plausibility-v8.mjs';
import { RANKED_GAMES } from '../apps/portal/src/ranked-identity.mjs';
import { createStandaloneInitPayload } from '../apps/hmh-reboot/src/standalone-session.mjs';
import { resolveHmhWorldSelection, sessionAllowedForWorld } from '../apps/hmh-reboot/src/world-context.mjs';
import { createWorldV2RuntimeContext } from '../apps/hmh-reboot/src/world-v2-runtime-context.mjs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const identity = (buildHash) => ({ gameId: 'lester-blaster', buildHash });
const legacyBuild = 'site-1.8.4:game-1.8.4';
const v7Build = 'site-1.9.0:game-1.9.0';
const v8Build = 'site-2.1.0:game-2.1.0:cabinet-0.6.0';

test('schema 6 and 7 still resolve the frozen forked-frontier v1 contexts, and schema 8 the ten-area v2 context only from 2.1.0', () => {
  assert.ok(RANKED_GAMES['lester-blaster'].buildHashPattern.test(legacyBuild));
  const six = resolveHmhMapContext({ identity: identity(legacyBuild), schemaVersion: 6 });
  const seven = resolveHmhMapContext({ identity: identity(v7Build), schemaVersion: 7 });
  for (const context of [six, seven]) {
    assert.equal(context.mapId, 'forked-frontier');
    assert.equal(context.mapVersion, 1);
    assert.equal(Object.isFrozen(context), true);
  }
  assert.equal(six.schemaVersion, 6);
  assert.equal(six.validatePlausibility, validateV6RunPlausibility);
  assert.equal(seven.schemaVersion, 7);
  assert.equal(seven.validatePlausibility, validateV7RunPlausibility);
  assert.equal(resolveHmhMapContext({ identity: identity(v7Build), schemaVersion: 8 }), null);
  const eight = resolveHmhMapContext({ identity: identity(v8Build), schemaVersion: 8 });
  assert.deepEqual({ ...eight }, { mapId: 'ten-area-frontier', mapVersion: 2, schemaVersion: 8, validatePlausibility: validateV8RunPlausibility });
  assert.equal(Object.isFrozen(eight), true);
  assert.equal(resolveHmhMapContext({ identity: identity(v8Build), schemaVersion: 7 }).mapId, 'forked-frontier', 'a cached 1.9.x/2.0.x child under a 2.1.0 portal keeps the legacy map');
  assert.equal(resolveHmhMapContext({ identity: identity(v7Build), schemaVersion: 7, mapId: 'ten-area-frontier' }).mapId, 'forked-frontier', 'a claimed map label has no authority');
  assert.equal(resolveHmhMapContext({ identity: identity(v7Build), schemaVersion: 7, world: 'ten-area' }).mapVersion, 1);
});

test('no legacy verifier, schema or run-contract source knows the ten-area world', () => {
  const sources = [
    ...readdirSync(new URL('../server/verify/', import.meta.url)).filter((name) => name.endsWith('.mjs') && !['hmh-map-context.mjs', 'hmh-plausibility-v8.mjs'].includes(name)).map((name) => `../server/verify/${name}`),
    '../sdk/hmh-run-summary-schema-v7.mjs',
    '../sdk/hmh-run-contract-v7.mjs',
    '../sdk/hmh-run-summary-schema.mjs',
    '../sdk/hmh-run-summary.mjs',
  ];
  for (const source of sources) assert.doesNotMatch(read(source), /ten-area|world-v2|WORLD_V2/, source);
});

test('the 2.0.x ten-area selection is unofficial in every session shape the child can receive', () => {
  const selection = resolveHmhWorldSelection({ params: 'mode=free&world=ten-area&evidenceSafe=1', tenAreaLevelOne: false });
  const context = createWorldV2RuntimeContext({ selection });
  assert.equal(context.official, false);
  assert.equal(context.rankedEligible, false);
  assert.equal(context.world.officialRun, false);
  assert.equal(context.world.rankedEligible, false);
  assert.equal(context.gameplay.officialRun, false);
  const standalone = createStandaloneInitPayload();
  assert.equal(sessionAllowedForWorld(context, standalone), true, 'the standalone Free session is the intended playtest path');
  for (const payload of [
    { ...standalone, mode: 'ranked' },
    { ...standalone, mode: 'ranked', session: { ...standalone.session, rankedEligible: true } },
    { ...standalone, session: { ...standalone.session, rankedEligible: true } },
    { ...standalone, mode: 'daily' },
  ]) assert.equal(sessionAllowedForWorld(context, payload), false);
  assert.throws(() => createWorldV2RuntimeContext({ selection: { ...selection, official: true } }), /unofficial/);
  assert.throws(() => createWorldV2RuntimeContext({ selection: { ...selection, rankedEligible: true } }), /unranked/);
});

test('the portal forwards a world request only for explicit unranked Free sessions, so a Ranked frame cannot select one', () => {
  const host = read('../apps/portal/src/hmh-reboot-host.mjs');
  // The portal URL's own query still forwards only the two QA switches.
  const forwarded = [...host.matchAll(/runtimeParams\.set\('([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(forwarded, ['evidenceSafe', 'terminalPilot']);
  // The preview (2.0.x) or the original map (2.1.0) adds world=<value> behind one guard: Free mode and rankedEligible === false.
  assert.match(host, /if \(HMH_REQUESTABLE_WORLDS\.includes\(world\) && session\.mode === 'free' && session\.session\?\.rankedEligible === false\) \{/);
  assert.equal((host.match(/params\.set\(HMH_FRONTIER_PREVIEW_WORLD_PARAM, world\)/g) ?? []).length, 1);
  const main = read('../apps/hmh-reboot/src/main.mjs');
  assert.match(main, /RUN_SUMMARY_ENABLED = context\.official === true;/);
  assert.match(main, /if \(bridge\?\.initialized && RUN_SUMMARY_ENABLED\) \{/);
  assert.match(main, /bridge\?\.send\('game:error', \{ code: 'unofficial-world-session'/);
});
