// Presentation only: no profile, game session, wallet or score writes.
export function mountCabinetMotionControl({ button, grid, motionPreference }) {
  let paused = false;
  const render = () => {
    const reduced = motionPreference?.matches === true;
    grid.dataset.cabinetMotion = paused || reduced ? 'paused' : 'running';
    button.disabled = reduced;
    button.setAttribute('aria-pressed', String(paused || reduced));
    button.textContent = reduced ? 'Rotation off (reduced motion)'
      : paused ? 'Resume cabinet rotation' : 'Pause cabinet rotation';
  };
  const toggle = () => {
    if (motionPreference?.matches) return;
    paused = !paused;
    render();
  };
  button.addEventListener('click', toggle);
  motionPreference?.addEventListener('change', render);
  render();
  return () => {
    button.removeEventListener('click', toggle);
    motionPreference?.removeEventListener('change', render);
  };
}
