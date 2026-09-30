// The Chikun visual upgrade (scenery, lighting, audio) must never change gameplay.
// These modules decide the course, collision, evidence and replay, so they stay
// byte-identical to release 1.8.2 (65d8ae4a). The hashes are constants because
// Vercel builds have no .git to diff against. Changing one of these files is a
// gameplay change: it needs its own reviewed cycle, not an art commit.
//
// Two reviewed 2.0 exceptions, both from 1ad8881e0:
// - chikun-cabinet.mjs carries the course-two gated dispatch: three added
//   lines that route only COURSE_V2_EVIDENCE to chikun-course-v2-runtime.mjs
//   before the frozen v6/v5/v3/legacy dispatch. Every v6 path is untouched;
//   tests/chikun-evidence-v6.test.mjs replays tests/fixtures/chikun-v6-replays.json
//   through this cabinet and requires the results byte-for-byte, so a
//   gameplay change there fails that suite.
// - chikun-bridge-protocol.mjs extends CHIKUN_COSMETIC_IDS (aurora coat, comet
//   trail, flight-goggles and prospector hats). Cosmetic ids are draw-only:
//   they never reach evidence, a result or the v6 replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const FROZEN = Object.freeze({
  'apps/portal/src/chikun-course-regions.mjs': '0d43a3b3f8a2bf06db2c8e381290376696a9270e3f5d0d101d707720faf6941a',
  'apps/portal/src/chikun-ground-course.mjs': 'a29626fe35d1d92979c5950ef0cd17efdfe2340ba98c5a3a7a772403c32fb7ca',
  'apps/portal/src/chikun-ground-runtime.mjs': '291d1afe2cf20b29fb855ca4d78572d026011489d7dc10a7d621d82817283efe',
  'apps/portal/src/chikun-ground-v3-course.mjs': 'a824a068ed11adb3dc1eda11efffbc26511e4344d25a029673911a7b174a7853',
  'apps/portal/src/chikun-ground-v3-runtime.mjs': '18e9927b0048ba025f9856f7fd54e7dfc8bc332a29343b90706ad3f2673cb913',
  'apps/portal/src/chikun-ground-v5-course.mjs': 'ffb77279e5479cdcc9afa9979d5499bab722864d9e19ff3b62f18a7f8ff76f65',
  'apps/portal/src/chikun-ground-v5-runtime.mjs': '34cfcb09d3892f71ec3e181980bd3de7531e566255db37e3215fd4e621a8dc25',
  'apps/portal/src/chikun-flight-legacy.mjs': 'cc6f661c465dbebfa50814330ceb8c812b5ac7d81435252dfebd92bc83acf163',
  'apps/portal/src/chikun-cabinet.mjs': 'eeba06d6e305906ceba89634c96c7b2229fdcc8404ff07b1ff4cd75c787fed70',
  'apps/portal/src/chikun-obstacles.mjs': 'af189619db1fec52015a128cb4cd53d21d718c6ebd760a313342ee7c8d42017d',
  'apps/portal/src/chikun-bridge-protocol.mjs': '8004d930a69d9a0bf7ee87aeae1ae682539586f6d728b62507660d6e9bc3468e',
  'apps/portal/src/chikun-daily-challenge.mjs': 'fcb96b34fe49a0a99048299294e038d7b02acd2a7f2e8737e5758ea31854c849',
  'apps/chikun/assets/obstacle-shapes.json': 'c79094da68b0ec6c500cf5fcdd315e95d97d8a8117263188e9f138eac5ef161a',
});

test('Chikun simulation, course, evidence and collision files are byte-identical to release 1.8.2', () => {
  for (const [path, expected] of Object.entries(FROZEN)) {
    const actual = createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');
    assert.equal(actual, expected, `${path} changed: gameplay files are frozen for the visual upgrade`);
  }
  assert.equal(Object.keys(FROZEN).length, 13);
});
