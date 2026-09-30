// Official Chikun course/evidence dispatch. One table, keyed by evidence
// version and by course id, shared by the server verifier
// (server/verify/chikun.mjs, server/verify/index.mjs) and the portal host
// (chikun-host.mjs). Pure: no imports, no DOM, no environment, no clock, so
// the host bundle carries only these strings.
//
// THE GATE. Course two (chikun-input-evidence-v7) is official only when
// CHIKUN_OFFICIAL_COURSE_TWO_ENABLED is true. It is false: course one (v6)
// stays the only official course, and every v7 body is rejected exactly as
// before. Tests pass `courseTwoEnabled: true` through the verifier and host
// options; nothing reads a URL, an environment variable or storage to flip it.
// Flipping it is a release decision (docs/2.0/slices/CHIKUN-V7-OFFICIAL-DISPATCH.md).
export const CHIKUN_OFFICIAL_COURSE_TWO_ENABLED = false;

// The runtime that replays both courses (chikun-cabinet CHIKUN_RUNTIME_VERSION
// and RANKED_GAMES.chikun.runtimeId; tests/chikun-official-course.test.mjs
// pins the three together). Course two carries the course id in its runtimeId
// so a v7 run never shares a runtime row with a v6 run.
const RUNTIME_ID = 'chikun:canvas-runtime-v7';

// Combined flap + held-glide transition budget of a v7 stream (course-v2
// runtime GROUND_MAX_FLAPS); v6 caps its flaps at the same number.
export const CHIKUN_OFFICIAL_MAX_TRANSITIONS = 12_000;

export const CHIKUN_OFFICIAL_COURSES = Object.freeze([
  Object.freeze({
    courseId: 1,
    evidenceVersion: 'chikun-flap-evidence-v6',
    encoding: 'chikun-flap-evidence-v6+json',
    runtimeId: RUNTIME_ID,
    // Sorted: the verifier's exact-key check compares against this order.
    evidenceKeys: Object.freeze(['fixedStepHz', 'flapDeltas', 'maxTicks', 'seed', 'version']),
    inputStreams: Object.freeze(['flapDeltas']),
    gate: null,
  }),
  Object.freeze({
    courseId: 2,
    evidenceVersion: 'chikun-input-evidence-v7',
    encoding: 'chikun-input-evidence-v7+json',
    runtimeId: `${RUNTIME_ID}:course-2`,
    evidenceKeys: Object.freeze(['fixedStepHz', 'flapDeltas', 'glideDeltas', 'maxTicks', 'seed', 'version']),
    inputStreams: Object.freeze(['flapDeltas', 'glideDeltas']),
    gate: 'CHIKUN_OFFICIAL_COURSE_TWO_ENABLED',
  }),
]);
export const CHIKUN_OFFICIAL_COURSES_BY_VERSION = Object.freeze(Object.fromEntries(CHIKUN_OFFICIAL_COURSES.map((course) => [course.evidenceVersion, course])));
export const CHIKUN_OFFICIAL_COURSES_BY_ID = Object.freeze(Object.fromEntries(CHIKUN_OFFICIAL_COURSES.map((course) => [course.courseId, course])));
// Course one is the default official course whatever the gate says.
export const CHIKUN_DEFAULT_OFFICIAL_COURSE = CHIKUN_OFFICIAL_COURSES_BY_ID[1];

function gateOpen(course, courseTwoEnabled) {
  if (course.gate === null) return true;
  if (course.gate === 'CHIKUN_OFFICIAL_COURSE_TWO_ENABLED') return courseTwoEnabled === true;
  return false;
}

// The official courses under the gate, course one first. → frozen array
export function officialChikunCourses({ courseTwoEnabled = CHIKUN_OFFICIAL_COURSE_TWO_ENABLED } = {}) {
  return Object.freeze(CHIKUN_OFFICIAL_COURSES.filter((course) => gateOpen(course, courseTwoEnabled)));
}

// The course a Ranked session plays: course two when it is official, else
// course one. The host offers only this course; nothing in a URL can widen it.
export function officialChikunCourse({ courseTwoEnabled = CHIKUN_OFFICIAL_COURSE_TWO_ENABLED } = {}) {
  return gateOpen(CHIKUN_OFFICIAL_COURSES_BY_ID[2], courseTwoEnabled) ? CHIKUN_OFFICIAL_COURSES_BY_ID[2] : CHIKUN_DEFAULT_OFFICIAL_COURSE;
}

// The dispatch entry an evidence version resolves to under the gate, or null
// (unknown version, or a gated course whose gate is closed). → entry | null
export function officialChikunCourseForEvidence(evidenceVersion, { courseTwoEnabled = CHIKUN_OFFICIAL_COURSE_TWO_ENABLED } = {}) {
  const course = typeof evidenceVersion === 'string' && Object.hasOwn(CHIKUN_OFFICIAL_COURSES_BY_VERSION, evidenceVersion) ? CHIKUN_OFFICIAL_COURSES_BY_VERSION[evidenceVersion] : null;
  return course && gateOpen(course, courseTwoEnabled) ? course : null;
}

// The §5.1 evidence encodings the verifier accepts under the gate.
export function officialChikunEvidenceEncodings(options) {
  return Object.freeze(officialChikunCourses(options).map((course) => course.encoding));
}
