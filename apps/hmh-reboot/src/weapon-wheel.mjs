// Weapon wheel (owner direction 2026-09-16). Presentation only: the runtime
// freezes the simulation in its 'menu' state while the wheel is open and a
// pick becomes a one-tick `weaponSlot` request through the input model, so
// the wheel can never touch the loadout directly. Lazily imported; nothing in
// the initial bundle depends on it.

const RADIUS_RATIO = 0.36;
const MIN_RADIUS = 92;
const MAX_RADIUS = 168;

function required(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) throw new TypeError(`weapon wheel needs #${id}`);
  return element;
}

export function weaponWheelSlotPositions(count, radius) {
  if (!Number.isInteger(count) || count < 1) throw new TypeError('slot count must be a positive integer');
  if (!(radius > 0)) throw new TypeError('radius must be positive');
  // Slot 1 sits at 12 o'clock; the rest follow clockwise so the order matches
  // the arsenal strip read left to right.
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return Object.freeze({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }));
}

// Slot cards are 92 px wide on touch/compact layouts and 112 px on desktop
// (mirrored in the stylesheet); the ring must leave room for the 3 and 9
// o'clock cards plus the layer padding on the narrowest phone.
export function weaponWheelSlotWidth(width) {
  return (Number(width) || 0) <= 900 ? 92 : 112;
}

export function weaponWheelRadius({ width, height } = {}) {
  const viewportWidth = Number(width) || 0;
  const shortEdge = Math.min(viewportWidth, Number(height) || 0);
  const fit = (viewportWidth - 20 - weaponWheelSlotWidth(viewportWidth)) / 2 - 6;
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, shortEdge * RADIUS_RATIO, fit));
}

export function ammoLabel(view) {
  if (!view.owned) return 'Not found';
  if (view.clipSize <= 0) return 'Ready';
  const reserve = view.reserveAmmo === null || view.reserveAmmo === undefined ? '∞' : String(view.reserveAmmo);
  return `${view.ammoInClip}/${view.clipSize} · ${reserve}`;
}

export function createWeaponWheel({ documentRef = document, windowRef = globalThis.window, mount = null, onPick, onClose } = {}) {
  if (typeof onPick !== 'function' || typeof onClose !== 'function') throw new TypeError('weapon wheel needs onPick and onClose');
  const layer = mount ?? required(documentRef, 'hmhWeaponWheel');
  const ring = required(documentRef, 'hmhWeaponWheelRing');
  const title = required(documentRef, 'hmhWeaponWheelTitle');
  const buttons = new Map();
  let open = false;
  let views = [];
  let focusedSlot = 0;
  const listeners = [];
  const listen = (source, type, callback, options) => {
    source.addEventListener(type, callback, options);
    listeners.push(() => source.removeEventListener(type, callback, options));
  };

  const layout = () => {
    const width = windowRef?.innerWidth ?? 1280;
    const radius = weaponWheelRadius({ width, height: windowRef?.innerHeight ?? 720 });
    const positions = weaponWheelSlotPositions(views.length, radius);
    ring.style.setProperty('--wheel-radius', `${radius}px`);
    ring.style.setProperty('--slot-width', `${weaponWheelSlotWidth(width)}px`);
    views.forEach((view, index) => {
      const button = buttons.get(view.slot);
      if (!button) return;
      button.style.setProperty('--slot-x', `${positions[index].x.toFixed(1)}px`);
      button.style.setProperty('--slot-y', `${positions[index].y.toFixed(1)}px`);
    });
  };

  const render = () => {
    for (const view of views) {
      let button = buttons.get(view.slot);
      if (!button) {
        button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'hmh-weapon-wheel-slot';
        button.dataset.slot = String(view.slot);
        const parts = {};
        for (const [key, tag] of [['code', 'b'], ['name', 'strong'], ['ammo', 'small'], ['key', 'i']]) {
          const node = documentRef.createElement(tag);
          node.className = `hmh-weapon-wheel-${key}`;
          button.appendChild(node);
          parts[key] = node;
        }
        button.parts = parts;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          if (button.disabled) return;
          onPick(view.slot);
        });
        ring.appendChild(button);
        buttons.set(view.slot, button);
      }
      button.dataset.weapon = view.weaponId;
      button.dataset.owned = String(view.owned);
      button.dataset.active = String(view.active);
      button.disabled = !view.owned;
      button.setAttribute('aria-label', `${view.name}: ${view.active ? 'armed' : ammoLabel(view)}`);
      button.parts.code.textContent = view.code;
      button.parts.name.textContent = view.name;
      button.parts.ammo.textContent = view.active ? 'ARMED' : ammoLabel(view);
      button.parts.key.textContent = String(view.slot);
    }
    const active = views.find((view) => view.active);
    title.textContent = active ? `${active.name} armed` : 'Choose a weapon';
    layout();
  };

  const focusSlot = (slot) => {
    const button = buttons.get(slot);
    if (!button || button.disabled) return false;
    focusedSlot = slot;
    button.focus?.({ preventScroll: true });
    return true;
  };

  const step = (direction) => {
    const owned = views.filter((view) => view.owned).map((view) => view.slot);
    if (owned.length === 0) return;
    const index = Math.max(0, owned.indexOf(focusedSlot));
    focusSlot(owned[(index + direction + owned.length) % owned.length]);
  };

  const onKey = (event) => {
    if (!open) return;
    const code = event.code ?? '';
    if (code === 'Escape' || code === 'Tab') { event.preventDefault(); onClose(); return; }
    const digit = /^Digit([1-8])$/.exec(code);
    if (digit) {
      event.preventDefault();
      const slot = Number(digit[1]);
      if (buttons.get(slot) && !buttons.get(slot).disabled) onPick(slot);
      return;
    }
    if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') { event.preventDefault(); step(1); return; }
    if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') { event.preventDefault(); step(-1); return; }
    if (code === 'Enter' || code === 'Space') {
      event.preventDefault();
      if (focusedSlot && buttons.get(focusedSlot) && !buttons.get(focusedSlot).disabled) onPick(focusedSlot);
    }
  };

  listen(layer, 'pointerdown', (event) => {
    // Backdrop tap closes without a pick; slot buttons stop propagation via
    // their own click handling so this only sees the backdrop.
    if (event.target === layer || event.target === ring) { event.preventDefault(); onClose(); }
  });
  if (windowRef?.addEventListener) {
    listen(windowRef, 'keydown', onKey, true);
    listen(windowRef, 'resize', () => { if (open) layout(); });
  }

  return Object.freeze({
    isOpen() { return open; },
    open(nextViews) {
      if (!Array.isArray(nextViews) || nextViews.length === 0) throw new TypeError('weapon wheel needs at least one slot view');
      views = nextViews;
      open = true;
      render();
      layer.hidden = false;
      layer.dataset.open = 'true';
      const active = views.find((view) => view.active);
      focusedSlot = active?.slot ?? views.find((view) => view.owned)?.slot ?? 0;
      focusSlot(focusedSlot);
    },
    close() {
      if (!open) return;
      open = false;
      layer.hidden = true;
      layer.dataset.open = 'false';
    },
    destroy() {
      this.close();
      for (const remove of listeners.splice(0)) remove();
      for (const button of buttons.values()) button.remove();
      buttons.clear();
    },
  });
}
