// Perf step 8: rotating control tips while the atlases decode (lazy).
//
// The briefing card already lists the controls; on a phone the wait for the
// half-size pages is the one moment a player reads, so one short tip rotates
// under the progress bar until loading ends. The line is decorative
// (aria-hidden): the static briefing is the accessible copy, and a live
// region that changed every few seconds would chatter at screen readers. It
// removes itself the moment the panel stops being busy or is hidden.

export const DESKTOP_TIPS = Object.freeze([
  'W A S D moves. Aim with the mouse; your hero fires and dodges on their own.',
  'F or right click throws a grenade.',
  'Q swaps weapons. Tab opens the weapon wheel.',
  'Cyan marks weapons, green marks health, gold marks power-ups.',
  'Esc pauses and shows the field map and your controls.',
  'Save a rare gun in the wheel for the Liquidator.',
]);

export const TOUCH_TIPS = Object.freeze([
  'The left stick moves. Your hero fires and dodges on their own.',
  'Hold AIM to focus fire; release it to return to automatic targeting.',
  'The GRENADE button clears a crowd.',
  'SWAP changes weapons. Tap the armed weapon to open the wheel.',
  'Cyan marks weapons, green marks health, gold marks power-ups.',
]);

export const TIP_INTERVAL_MS = 3200;

export function startStartupTips({ documentRef = globalThis.document, panel, anchor, touch = false, intervalMs = TIP_INTERVAL_MS, setIntervalRef = globalThis.setInterval, clearIntervalRef = globalThis.clearInterval, ObserverClass = globalThis.MutationObserver } = {}) {
  const busy = () => panel && !panel.hidden && panel.getAttribute('aria-busy') !== 'false';
  if (!anchor || !busy()) return () => {};
  const tips = touch ? TOUCH_TIPS : DESKTOP_TIPS;
  const line = documentRef.createElement('p');
  line.className = 'hmh-startup-rotating-tip';
  line.setAttribute('aria-hidden', 'true');
  let index = 0;
  line.textContent = `Tip: ${tips[index]}`;
  anchor.after(line);
  let observer = null;
  const timer = setIntervalRef(() => {
    if (!busy()) return stop();
    index = (index + 1) % tips.length;
    line.textContent = `Tip: ${tips[index]}`;
  }, intervalMs);
  function stop() {
    clearIntervalRef(timer);
    observer?.disconnect();
    observer = null;
    line.remove();
  }
  if (typeof ObserverClass === 'function') {
    observer = new ObserverClass(() => { if (!busy()) stop(); });
    observer.observe(panel, { attributes: true, attributeFilter: ['aria-busy', 'hidden'] });
  }
  return stop;
}
