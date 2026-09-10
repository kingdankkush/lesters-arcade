import { buildHmhChallengeUrl, readHmhChallengeSearch, resolveHmhChallenge } from './hmh-challenges.mjs';

// Only stores the selected Free course in this tab's memory. No network/storage.
export function mountHmhChallengeUi({ dom, search = '', identity, location, now = () => Date.now(), copyText } = {}) {
  let course = null;
  let error = null;
  let gameId = 'lester-blaster';
  const resolve = (request) => resolveHmhChallenge(request, { ...identity, gameId: 'lester-blaster', mode: 'free', now: now() });
  try { course = resolve(readHmhChallengeSearch(search)); }
  catch (cause) { error = cause; }
  const sharedCourse = course;
  const sharedError = error;
  dom.choice.value = course || error ? 'shared' : 'random';
  dom.sharedOption.hidden = !course && !error;
  dom.sharedOption.textContent = course ? `Shared: ${course.label}` : 'Invalid shared course: choose another';

  function render(selectedGameId = gameId) {
    gameId = selectedGameId;
    dom.panel.hidden = gameId !== 'lester-blaster';
    if (dom.panel.hidden) return;
    dom.freeButton.disabled = Boolean(error);
    dom.copy.disabled = !course || Boolean(error);
    dom.link.disabled = !course || Boolean(error);
    dom.link.value = course && !error ? buildHmhChallengeUrl(course, location) : '';
    dom.status.textContent = error ? error.message : course
      ? `${course.label} · Seed ${course.seed}. Free practice only. No official scores, progress, achievements or chain writes. Same build and hero required for comparable attempts.`
      : 'Fresh seed each run. Free practice only. No official scores, progress, achievements or chain writes.';
  }

  dom.choice.addEventListener('change', () => {
    if (dom.choice.value === 'shared') {
      course = sharedCourse;
      error = sharedError;
      render();
      return;
    }
    try {
      course = dom.choice.value === 'random' ? null : resolve({ cadence: dom.choice.value });
      error = null;
    } catch (cause) { course = null; error = cause; }
    render();
  });
  dom.copy.addEventListener('click', async () => {
    if (!course || error) return;
    const link = dom.link.value;
    try {
      if (!copyText) throw new Error('Clipboard unavailable');
      await copyText(link);
      if (dom.link.value === link) dom.status.textContent = `${course.label}. Challenge link copied. Free practice only, not official competition.`;
    } catch {
      if (dom.link.value === link) {
        dom.link.select();
        dom.status.textContent = 'Copy the selected challenge link. Free practice only, not official competition.';
      }
    }
  });
  render();
  return Object.freeze({
    render,
    requestFor(selectedGameId, mode) {
      if (selectedGameId !== 'lester-blaster' || mode !== 'free') return null;
      if (error) throw error;
      return course;
    },
  });
}
