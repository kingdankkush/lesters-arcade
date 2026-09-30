// W4a: the ten-area Free world produces no Ranked submission, and the server
// verifier still resolves only the legacy map contexts for schema 6 and 7.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolveHmhMapContext } from '../server/verify/hmh-map-context.mjs';
import { validateV6RunPlausibility, validateV7RunPlausibility } from '../server/verify/hmh-plausibility.mjs';
import { RANKED_GAMES } from '../apps/portal/src/ranked-identity.mjs';
import { createStandaloneInitPayload } from '../apps/hmh-reboot/src/standalone-session.mjs';
import { resolveHmhWorldSelection, sessionAllowedForWorld } from '../apps/hmh-reboot/src/world-context.mjs';
import { createWorldV2RuntimeContext } from '../apps/hmh-reboot/src/world-v2-runtime-context.mjs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const identity = (buildHash) => ({ gameId: 'lester-blaster', buildHash });
const legacyBuild = 'site-1.8.4:game-1.8.4';
const v7Build = 'site-1.9.0:game-1.9.0';

test('schema 6 and 7 still resolve the frozen forked-frontier v1 contexts and nothing else', () => {
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
  assert.equal(resolveHmhMapContext({ identity: identity(v7Build), schemaVersion: 7, mapId: 'ten-area-frontier' }).mapId, 'forked-frontier', 'a claimed map label has no authority');
  assert.equal(resolveHmhMapContext({ identity: identity(v7Build), schemaVersion: 7, world: 'ten-area' }).mapVersion, 1);
});

test('no verifier, schema or run-contract source knows the ten-area world', () => {
  const sources = [
    ...readdirSync(new URL('../server/verify/', import.meta.url)).filter((name) => name.endsWith('.mjs')).map((name) => `../server/verify/${name}`),
    '../sdk/hmh-run-summary-schema-v7.mjs',
    '../sdk/hmh-run-contract-v7.mjs',
    '../sdk/hmh-run-summary-schema.mjs',
    '../sdk/hmh-run-summary.mjs',
  ];
  for (const source of sources) assert.doesNotMatch(read(source), /ten-area|world-v2|WORLD_V2/, source);
});

test('the ten-area selection is unofficial in every session shape the child can receive', () => {
  const selection = resolveHmhWorldSelection({ params: 'mode=free&world=ten-area&evidenceSafe=1' });
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

test('the portal never forwards a world parameter to the embedded child, so a Ranked frame cannot select it', () => {
  const host = read('../apps/portal/src/hmh-reboot-host.mjs');
  const forwarded = [...host.matchAll(/runtimeParams\.set\('([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(forwarded, ['evidenceSafe', 'terminalPilot']);
  assert.doesNotMatch(host, /world=ten-area|'world'/);
  const main = read('../apps/hmh-reboot/src/main.mjs');
  assert.match(main, /RUN_SUMMARY_ENABLED = context\.official === true;/);
  assert.match(main, /if \(bridge\?\.initialized && RUN_SUMMARY_ENABLED\) \{/);
  assert.match(main, /bridge\?\.send\('game:error', \{ code: 'unofficial-world-session'/);
});
