// Owner direction 2026-09-16: whenever the player picks something up or
// completes a world interaction, a brief bold banner names it, then fades.
// Not distracting: one line, a short hold, a queue that coalesces repeats.
//
// Pure presentation. Tick-driven (the render loop calls update(tick)) so the
// timing is deterministic and never touches the wall clock. DOM is built with
// createElement only; the module takes the document as an argument.

export const PICKUP_BANNER_HOLD_TICKS = 72;   // 1.2 s at 60 ticks
export const PICKUP_BANNER_FADE_TICKS = 24;   // 0.4 s fade
export const PICKUP_BANNER_QUEUE_CAP = 4;
export const PICKUP_BANNER_COALESCE_TICKS = 30;

const KIND_CLASS = Object.freeze({
  weapon: 'weapon', ammo: 'ammo', grenade: 'grenade', heal: 'heal', power: 'power', nuke: 'nuke', objective: 'objective', world: 'world', secret: 'secret',
});

const upper = (text) => String(text ?? '').trim().toUpperCase();

// Map a runtime event to banner copy. Returns null for events that do not
// deserve a banner (the caller stays silent for those).
export function pickupBannerText(event, { weaponTitles = {}, effectTitles = {}, objectiveReward = null, siteName = null } = {}) {
  if (!event || typeof event !== 'object') return null;
  if (event.type === 'collectible:collected') {
    if (objectiveReward?.rewardName) {
      return { kind: KIND_CLASS.objective, title: `${upper(objectiveReward.rewardName)} COLLECTED`, detail: objectiveReward.respawnTicks ? `Returns in ${Math.round(objectiveReward.respawnTicks / 60)} s` : '' };
    }
    switch (event.kind) {
      case 'weapon-cache': {
        const name = weaponTitles[event.weaponId] ?? event.weaponId ?? 'weapon';
        const bonus = event.bonusWeaponId ? weaponTitles[event.bonusWeaponId] ?? event.bonusWeaponId : null;
        return { kind: KIND_CLASS.weapon, title: `PICKED UP: ${upper(name)}`, detail: bonus ? `Also unlocked: ${bonus}` : 'Armed and ready' };
      }
      case 'ammo-refill': return { kind: KIND_CLASS.ammo, title: 'AMMO REFILLED', detail: 'Every weapon topped up' };
      case 'grenade-supply': return { kind: KIND_CLASS.grenade, title: '+1 GRENADE', detail: '' };
      case 'heal': return { kind: KIND_CLASS.heal, title: `+${Math.max(0, Math.round(Number(event.amount) || 0))} HEALTH`, detail: '' };
      case 'nuke': return { kind: KIND_CLASS.nuke, title: 'LIQUIDATION NUKE', detail: 'Everything on screen takes damage' };
      case 'timed': {
        const name = effectTitles[event.effectId] ?? event.title ?? event.effectId ?? 'power-up';
        const seconds = Number.isFinite(event.durationTicks) ? ` · ${Math.round(event.durationTicks / 60)} s` : '';
        return { kind: KIND_CLASS.power, title: upper(name), detail: `Power-up active${seconds}` };
      }
      default: return null;
    }
  }
  if (event.type === 'world:activated') return { kind: KIND_CLASS.world, title: `${upper(siteName ?? event.name ?? 'site')} ACTIVATED`, detail: event.rewardName ? `${event.rewardName} ready nearby` : '' };
  if (event.type === 'world:gate') return { kind: KIND_CLASS.world, title: `${upper(event.name ?? 'GATE')} UNLOCKED`, detail: event.detail ?? '' };
  if (event.type === 'world:secret') return { kind: KIND_CLASS.secret, title: `${upper(event.name ?? 'secret')} FOUND`, detail: event.detail ?? '' };
  if (event.type === 'weapon:swap') return null;
  return null;
}

export function createPickupBanner({ mount, documentRef = globalThis.document } = {}) {
  if (!mount || !documentRef?.createElement) throw new TypeError('pickup banner needs a mount element and a document');
  const root = documentRef.createElement('div');
  root.className = 'hmh-pickup-banner';
  root.dataset.state = 'hidden';
  root.setAttribute('aria-hidden', 'true');
  const title = documentRef.createElement('strong');
  const detail = documentRef.createElement('span');
  root.append(title, detail);
  mount.append(root);

  const queue = [];
  let current = null;
  let shownCount = 0;

  const paint = () => {
    if (!current) {
      root.dataset.state = 'hidden';
      root.dataset.kind = '';
      title.textContent = '';
      detail.textContent = '';
      return;
    }
    root.dataset.kind = current.kind;
    title.textContent = current.count > 1 ? `${current.title} ×${current.count}` : current.title;
    detail.textContent = current.detail;
  };

  const announce = (text, tick) => {
    if (!text || typeof text.title !== 'string' || !text.title) return false;
    if (!Number.isInteger(tick) || tick < 0) throw new TypeError('pickup banner tick must be a non-negative integer');
    const entry = { kind: text.kind ?? 'world', title: text.title, detail: text.detail ?? '', count: 1 };
    // A repeat of the visible banner within the coalesce window becomes a
    // count instead of a second banner (ammo crates, coin piles).
    if (current && current.title === entry.title && tick - current.shownAt <= PICKUP_BANNER_COALESCE_TICKS) {
      current.count += 1;
      current.shownAt = tick;
      root.dataset.state = 'shown';
      paint();
      return true;
    }
    const last = queue[queue.length - 1];
    if (last && last.title === entry.title) { last.count += 1; return true; }
    if (queue.length >= PICKUP_BANNER_QUEUE_CAP) queue.shift();
    queue.push(entry);
    return true;
  };

  const update = (tick) => {
    if (!Number.isInteger(tick) || tick < 0) throw new TypeError('pickup banner tick must be a non-negative integer');
    if (current) {
      const age = tick - current.shownAt;
      if (age >= PICKUP_BANNER_HOLD_TICKS + PICKUP_BANNER_FADE_TICKS) {
        current = null;
      } else {
        root.dataset.state = age >= PICKUP_BANNER_HOLD_TICKS ? 'fading' : 'shown';
      }
    }
    if (!current && queue.length) {
      current = { ...queue.shift(), shownAt: tick };
      shownCount += 1;
      root.dataset.state = 'shown';
    }
    paint();
    return root.dataset.state;
  };

  const state = () => ({ state: root.dataset.state, kind: root.dataset.kind ?? '', title: title.textContent, detail: detail.textContent, queued: queue.length, shownCount });
  const clear = () => { queue.length = 0; current = null; paint(); };
  const destroy = () => { clear(); root.remove?.(); };
  return Object.freeze({ announce, update, state, clear, destroy, element: root });
}
