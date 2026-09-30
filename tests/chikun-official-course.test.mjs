// The official Chikun course dispatch table and its gate (course two, v7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHIKUN_DEFAULT_OFFICIAL_COURSE,
  CHIKUN_OFFICIAL_COURSES,
  CHIKUN_OFFICIAL_COURSES_BY_ID,
  CHIKUN_OFFICIAL_COURSES_BY_VERSION,
  CHIKUN_OFFICIAL_COURSE_TWO_ENABLED,
  CHIKUN_OFFICIAL_MAX_TRANSITIONS,
  officialChikunCourse,
  officialChikunCourseForEvidence,
  officialChikunCourses,
  officialChikunEvidenceEncodings,
} from '../apps/portal/src/chikun-official-course.mjs';
import { CHIKUN_EVIDENCE_VERSION, CHIKUN_MAX_FLAP_TRANSITIONS, CHIKUN_RUNTIME_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { COURSE_V2_EVIDENCE, GROUND_MAX_FLAPS } from '../apps/portal/src/chikun-course-v2-runtime.mjs';
import { RANKED_GAMES, evidenceDigestFor, rankedEnvelopeHash } from '../apps/portal/src/ranked-identity.mjs';
import { CHIKUN_COURSE_TWO_EVIDENCE_ENCODING, CHIKUN_COURSE_TWO_EVIDENCE_VERSION, CHIKUN_EVIDENCE_ENCODING } from '../server/verify/chikun.mjs';
import { createChikunHost } from '../apps/portal/src/chikun-host.mjs';

const V6 = 'chikun-flap-evidence-v6';
const V7 = 'chikun-input-evidence-v7';

test('the course-two gate is closed and course one is the default official course', () => {
  assert.equal(CHIKUN_OFFICIAL_COURSE_TWO_ENABLED, false);
  assert.equal(CHIKUN_DEFAULT_OFFICIAL_COURSE, CHIKUN_OFFICIAL_COURSES_BY_ID[1]);
  assert.equal(officialChikunCourse(), CHIKUN_OFFICIAL_COURSES_BY_ID[1]);
  assert.deepEqual(officialChikunCourses().map((course) => course.evidenceVersion), [V6]);
  assert.deepEqual(officialChikunEvidenceEncodings(), ['chikun-flap-evidence-v6+json']);
  // The gate is a literal `false` in source, not something computed from the environment.
  const source = readFileSync(new URL('../apps/portal/src/chikun-official-course.mjs', import.meta.url), 'utf8');
  assert.match(source, /^export const CHIKUN_OFFICIAL_COURSE_TWO_ENABLED = false;$/m);
  assert.doesNotMatch(source, /import |process\.env|location|localStorage|URLSearchParams/);
});

test('the dispatch table is keyed by evidence version and course id and pins the shared identifiers', () => {
  assert.deepEqual(CHIKUN_OFFICIAL_COURSES.map((course) => [course.courseId, course.evidenceVersion, course.encoding, course.runtimeId, course.gate]), [
    [1, V6, 'chikun-flap-evidence-v6+json', `chikun:${CHIKUN_RUNTIME_VERSION}`, null],
    [2, V7, 'chikun-input-evidence-v7+json', `chikun:${CHIKUN_RUNTIME_VERSION}:course-2`, 'CHIKUN_OFFICIAL_COURSE_TWO_ENABLED'],
  ]);
  assert.equal(CHIKUN_OFFICIAL_COURSES_BY_VERSION[V6], CHIKUN_OFFICIAL_COURSES_BY_ID[1]);
  assert.equal(CHIKUN_OFFICIAL_COURSES_BY_VERSION[V7], CHIKUN_OFFICIAL_COURSES_BY_ID[2]);
  assert.equal(CHIKUN_EVIDENCE_VERSION, V6);
  assert.equal(COURSE_V2_EVIDENCE, V7);
  assert.equal(CHIKUN_COURSE_TWO_EVIDENCE_VERSION, V7);
  assert.equal(CHIKUN_EVIDENCE_ENCODING, CHIKUN_OFFICIAL_COURSES_BY_ID[1].encoding);
  assert.equal(CHIKUN_COURSE_TWO_EVIDENCE_ENCODING, CHIKUN_OFFICIAL_COURSES_BY_ID[2].encoding);
  assert.equal(CHIKUN_OFFICIAL_COURSES_BY_ID[1].runtimeId, RANKED_GAMES.chikun.runtimeId);
  assert.equal(CHIKUN_OFFICIAL_COURSES_BY_ID[1].encoding, RANKED_GAMES.chikun.evidenceEncoding);
  assert.deepEqual(RANKED_GAMES.chikun.evidenceEncodings, CHIKUN_OFFICIAL_COURSES.map((course) => course.encoding));
  assert.equal(CHIKUN_OFFICIAL_MAX_TRANSITIONS, GROUND_MAX_FLAPS);
  assert.equal(CHIKUN_OFFICIAL_MAX_TRANSITIONS, CHIKUN_MAX_FLAP_TRANSITIONS);
  assert.deepEqual(CHIKUN_OFFICIAL_COURSES_BY_ID[2].evidenceKeys, ['fixedStepHz', 'flapDeltas', 'glideDeltas', 'maxTicks', 'seed', 'version']);
  for (const course of CHIKUN_OFFICIAL_COURSES) {
    assert.equal(Object.isFrozen(course) && Object.isFrozen(course.evidenceKeys), true);
    assert.deepEqual([...course.evidenceKeys].sort(), course.evidenceKeys, 'keys are sorted for the exact-key check');
  }
});

test('version-to-course dispatch opens course two only through the gate', () => {
  assert.equal(officialChikunCourseForEvidence(V6), CHIKUN_OFFICIAL_COURSES_BY_ID[1]);
  assert.equal(officialChikunCourseForEvidence(V7), null);
  assert.equal(officialChikunCourseForEvidence(V7, { courseTwoEnabled: true }), CHIKUN_OFFICIAL_COURSES_BY_ID[2]);
  assert.equal(officialChikunCourseForEvidence(V6, { courseTwoEnabled: true }), CHIKUN_OFFICIAL_COURSES_BY_ID[1]);
  for (const truthy of [1, 'true', 'yes', {}, [], () => true]) {
    assert.equal(officialChikunCourseForEvidence(V7, { courseTwoEnabled: truthy }), null, `only boolean true opens the gate (${typeof truthy})`);
    assert.equal(officialChikunCourse({ courseTwoEnabled: truthy }).courseId, 1);
  }
  for (const version of ['chikun-flap-evidence-v1', 'chikun-flap-evidence-v2', 'chikun-flap-evidence-v3', 'chikun-flap-evidence-v5', 'chikun-flap-evidence-v7', 'chikun-input-evidence-v6', '', null, undefined, 7, { toString: () => V7 }]) {
    assert.equal(officialChikunCourseForEvidence(version), null, String(version));
    assert.equal(officialChikunCourseForEvidence(version, { courseTwoEnabled: true }), null, `${String(version)} with the gate open`);
  }
  assert.deepEqual(officialChikunCourses({ courseTwoEnabled: true }).map((course) => course.courseId), [1, 2]);
  assert.deepEqual(officialChikunEvidenceEncodings({ courseTwoEnabled: true }), ['chikun-flap-evidence-v6+json', 'chikun-input-evidence-v7+json']);
  assert.equal(officialChikunCourse({ courseTwoEnabled: true }).courseId, 2);
});

test('the one envelope implementation hashes both listed Chikun encodings and no other', async () => {
  const flap = { version: V7, seed: 1, fixedStepHz: 60, maxTicks: 60, flapDeltas: [3], glideDeltas: [5] };
  const digest = await evidenceDigestFor('chikun', flap);
  assert.equal(await evidenceDigestFor('chikun', { encoding: 'chikun-input-evidence-v7+json', flap }), digest);
  assert.equal(await evidenceDigestFor('chikun', { encoding: 'chikun-flap-evidence-v6+json', flap }), digest, 'the wrapper encoding never changes the digest of the bare object');
  const sessionId32 = `0x${'ab'.repeat(32)}`;
  const v6 = await rankedEnvelopeHash({ gameId: 'chikun', sessionId32, encoding: 'chikun-flap-evidence-v6+json', evidenceDigest: digest });
  const v7 = await rankedEnvelopeHash({ gameId: 'chikun', sessionId32, encoding: 'chikun-input-evidence-v7+json', evidenceDigest: digest });
  assert.notEqual(v6, v7, 'the encoding is part of the envelope preimage');
  for (const encoding of ['chikun-flap-evidence-v7+json', 'chikun-input-evidence-v6+json', 'chikun-input-evidence-v7', undefined]) {
    await assert.rejects(rankedEnvelopeHash({ gameId: 'chikun', sessionId32, encoding, evidenceDigest: digest }), /encoding must be/);
    await assert.rejects(evidenceDigestFor('chikun', { encoding, flap }), /evidence encoding must be/);
  }
  await assert.rejects(rankedEnvelopeHash({ gameId: 'stacked', sessionId32, encoding: 'chikun-input-evidence-v7+json', evidenceDigest: digest }), /encoding must be/);
});

// --- Host --------------------------------------------------------------------

class FakeIframe {
  constructor() { this.attributes = new Map(); this.listeners = new Map(); this.dataset = {}; this.contentWindow = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  focus() {}
}

function hostFixture(search = '', options = {}) {
  const host = createChikunHost({
    mount: { children: [], replaceChildren(...children) { this.children = children; } },
    documentRef: { documentElement: { dataset: {} }, createElement: () => new FakeIframe() },
    expectedOrigin: 'https://arcade.test',
    search,
    bridgeFactory: (bridgeOptions) => ({ options: bridgeOptions, connect() {}, send() {}, destroy() {} }),
    setTimeoutRef: () => ({}),
    clearTimeoutRef: () => {},
    ...options,
  });
  const session = (mode, rankedEligible) => ({
    sessionId: 'game-session-000000001', gameId: 'chikun', mode,
    profile: { displayName: 'Guest', locale: 'en-US' },
    session: { seed: 1234, buildHash: 'site-1:chikun-1', seasonId: 'chikun-season-1', rankedEligible },
    settings: { musicEnabled: true, reduceMotion: false },
  });
  return { host, session };
}

const courseParam = (frame) => new URL(frame.src).searchParams.getAll('course');

test('the host offers the official course from the gate: course one by default, never from a URL', () => {
  for (const search of ['', '?course=2', '?course=2&course=2', '?course=7', '?courseTwoEnabled=true', '?official=2']) {
    const { host, session } = hostFixture(search);
    assert.equal(host.officialCourse(), CHIKUN_OFFICIAL_COURSES_BY_ID[1], search);
    for (const [mode, eligible] of [['ranked', true], ['free', true], ['free', undefined], ['paid', false]]) {
      assert.deepEqual(courseParam(host.mountSession(session(mode, eligible))), [], `${search} ${mode} ${String(eligible)} never leaves course one`);
      host.destroy();
    }
  }
  // The private review path is unchanged: unranked Free with exactly one ?course=2.
  const { host, session } = hostFixture('?course=2');
  assert.deepEqual(courseParam(host.mountSession(session('free', false))), ['2']);
  host.destroy();
});

test('with the gate open the host offers course two to official sessions and keeps the preview path', () => {
  const { host, session } = hostFixture('', { courseTwoEnabled: true });
  assert.equal(host.officialCourse(), CHIKUN_OFFICIAL_COURSES_BY_ID[2]);
  for (const [mode, eligible] of [['ranked', true], ['free', true], ['free', undefined]]) {
    assert.deepEqual(courseParam(host.mountSession(session(mode, eligible))), ['2'], `${mode} ${String(eligible)}`);
    host.destroy();
  }
  const preview = hostFixture('?course=2', { courseTwoEnabled: true });
  assert.deepEqual(courseParam(preview.host.mountSession(preview.session('free', false))), ['2']);
  preview.host.destroy();
  // Anything but boolean true keeps course one.
  for (const value of [false, undefined, 1, 'true']) {
    const closed = hostFixture('', { courseTwoEnabled: value });
    assert.equal(closed.host.officialCourse().courseId, 1, String(value));
    assert.deepEqual(courseParam(closed.host.mountSession(closed.session('ranked', true))), []);
    closed.host.destroy();
  }
});
