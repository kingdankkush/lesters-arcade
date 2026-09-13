export function manageOverlayFocus(overlay, returnTarget) {
  const doc = overlay.ownerDocument;
  const siblings = [...overlay.parentElement.children].filter(node => node !== overlay);
  const previous = siblings.map(node => node.inert);
  const targets = () => [...overlay.querySelectorAll('button:not(:disabled), input:not(:disabled), summary, a[href], [tabindex="0"]')].filter(node => !node.hidden && node.getClientRects().length);
  const sync = () => {
    siblings.forEach((node, index) => { node.inert = overlay.hidden ? previous[index] : true; });
    if (overlay.hidden) returnTarget()?.focus({ preventScroll: true });
    else if (!overlay.contains(doc.activeElement)) targets()[0]?.focus({ preventScroll: true });
  };
  const onKey = event => {
    if (overlay.hidden || event.key !== 'Tab') return;
    const items = targets(), first = items[0], last = items.at(-1);
    if ((event.shiftKey && doc.activeElement === first) || (!event.shiftKey && doc.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  doc.addEventListener('keydown', onKey); sync();
  return () => {
    observer.disconnect(); doc.removeEventListener('keydown', onKey);
    siblings.forEach((node, index) => { node.inert = previous[index]; });
  };
}
