// Gamepad navigation for the STACKED menu overlay (settings simplification
// 2026-09-24). Pure over DOM-like nodes: up/down walk the visible, enabled
// stops (a radio group is one stop, its checked radio, as with Tab), left/right
// change the focused choice, and A activates buttons, checkboxes and summaries.
// Presentation only: nothing here reaches the simulation or its input mask.
export const MENU_STOP_SELECTOR = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary';
const visible = node => !node.hidden && node.getClientRects().length > 0;
const isRadio = node => node?.type === 'radio';
const candidates = root => [...root.querySelectorAll(MENU_STOP_SELECTOR)].filter(visible);

export function menuStops(root) {
  return candidates(root).filter(node => !isRadio(node) || node.checked);
}

export function applyMenuAction(root, action, active) {
  if (action === 'next' || action === 'previous') {
    const stops = menuStops(root);
    if (!stops.length) return null;
    const index = Math.max(0, stops.indexOf(active));
    const target = stops[(index + (action === 'next' ? 1 : stops.length - 1)) % stops.length];
    target.focus();
    return target;
  }
  if (!active) return null;
  if (action === 'activate') {
    if (active.matches('button,input[type=checkbox],summary')) active.click();
    return active;
  }
  if (action !== 'increase' && action !== 'decrease') return null;
  const direction = action === 'increase' ? 1 : -1;
  if (isRadio(active)) {
    // Neighbouring radio in DOM order, clamped at both ends (no wrap).
    const group = candidates(root).filter(node => isRadio(node) && node.name === active.name), index = group.indexOf(active);
    const target = index < 0 ? null : group[Math.max(0, Math.min(group.length - 1, index + direction))];
    if (!target || target === active) return active;
    target.checked = true; target.focus(); target.dispatchEvent(new Event('change', { bubbles: true }));
    return target;
  }
  if (active.matches('select')) {
    active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + direction));
    active.dispatchEvent(new Event('change'));
  } else if (active.matches('input[type=range]')) {
    active.value = String(Math.max(Number(active.min), Math.min(Number(active.max), Number(active.value) + direction * Number(active.step || 1))));
    active.dispatchEvent(new Event('change'));
  }
  return active;
}
