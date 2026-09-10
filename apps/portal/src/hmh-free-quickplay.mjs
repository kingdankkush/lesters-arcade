export const HMH_FREE_QUICKPLAY_GAME_ID = 'lester-blaster';

const STARTING_COPY = 'Opening Hard Money Heroes Free Mode…';
const ERROR_COPY = 'Hard Money Heroes could not start. Try again, or browse the arcade and choose a cabinet.';

function asError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

export function wireHmhFreeQuickplay({
  button,
  status,
  selectCabinet,
  startFreeMode,
  getStep,
  onError = () => {},
} = {}) {
  if (!button?.addEventListener) throw new TypeError('HMH quick-start button is required');
  if (!status?.setAttribute) throw new TypeError('HMH quick-start status is required');
  if (typeof selectCabinet !== 'function') throw new TypeError('HMH quick-start requires cabinet selection authority');
  if (typeof startFreeMode !== 'function') throw new TypeError('HMH quick-start requires Free Mode authority');
  if (typeof getStep !== 'function') throw new TypeError('HMH quick-start requires route-state access');

  let pending = false;

  async function start() {
    if (pending) return false;
    pending = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.dataset.state = 'loading';
    status.setAttribute('role', 'status');
    status.textContent = STARTING_COPY;

    let succeeded = false;
    try {
      // These are the same parent-owned operations used by the cabinet and
      // Free Mode buttons. The shortcut only removes two menu transitions.
      selectCabinet(HMH_FREE_QUICKPLAY_GAME_ID);
      await startFreeMode();
      if (getStep() !== 'character-select') {
        throw new Error('HMH Free Mode did not reach ordinary hero selection');
      }
      status.hidden = true;
      status.textContent = '';
      delete status.dataset.state;
      succeeded = true;
    } catch (value) {
      const error = asError(value);
      status.hidden = false;
      status.dataset.state = 'error';
      status.setAttribute('role', 'alert');
      status.textContent = ERROR_COPY;
      try { onError(error); } catch { /* reporting must not hide recovery */ }
    } finally {
      pending = false;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }

    if (!succeeded) button.focus?.();
    return succeeded;
  }

  const handleClick = () => start();
  button.addEventListener('click', handleClick);

  return Object.freeze({
    start,
    destroy: () => button.removeEventListener?.('click', handleClick),
  });
}
