// U-3 cockpit HUD. This is a projection of authoritative state onto DOM nodes
// that already exist in the child shell: it creates nothing, allocates nothing
// per frame, and diffs every write. `renderWorld` calls `update` on every
// animation frame, so an undiffed write here shows up directly in the p95
// frame-time and retained-heap gates.
//
// It reads only primitives. Deriving ring progress, pip counts and ammo modes
// render-side keeps `getWeaponReadabilityStatus` (deepEqual-pinned) untouched.

const HEALTH_PIP_COUNT = 4;

// Short strip codes. Projection-only labels; the authoritative display names
// live in weapon-system.mjs and are shown in full on the weapon card.
const WEAPON_SHORT_CODES = Object.freeze({
  'coin-blaster': 'PST',
  'scatter-shotgun': 'SHG',
  'auto-miner': 'MG',
  'launcher-rig': 'GL',
  'hash-rail': 'RAIL',
  'lightning-ledger': 'LDGR',
  'bear-market-burner': 'BURN',
  'forked-standard': 'STD',
});

const HERO_CRESTS = Object.freeze({
  'lit-commando': 'LC',
  'lit-valkyrie': 'LV',
  'lester-original': 'LO',
  lilly: 'LI',
});

// Modes that run a clock the ring can visualise. `ready`, `empty` and
// `channeling` have no countdown, so the ring rests full.
const RING_MODES = new Set(['reloading', 'cooldown', 'switching', 'recovery', 'overheated']);

// Above this clip size a pip row stops being readable: the drum-mag Machine Gun
// carries 120-180 rounds and the Bear Market Burner 1,200+ fuel.
const MAX_AMMO_PIPS = 12;

function required(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) throw new Error(`HMH hud element #${id} is missing`);
  return element;
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric < 0 ? 0 : numeric > 1 ? 1 : numeric;
}

function ammoModeFor(weaponId, clipSize) {
  if (weaponId === 'forked-standard') return 'melee';
  if (weaponId === 'lightning-ledger') return 'cells';
  return clipSize > MAX_AMMO_PIPS ? 'bar' : 'pips';
}

function weaponStateLabel(mode, secondsRemaining, heat) {
  switch (mode) {
    case 'reloading': return `RELOAD ${secondsRemaining.toFixed(1)}S`;
    case 'cooldown': return `COOLDOWN ${secondsRemaining.toFixed(1)}S`;
    case 'recovery': return `RECOVER ${secondsRemaining.toFixed(1)}S`;
    case 'switching': return `SWITCH ${secondsRemaining.toFixed(1)}S`;
    case 'channeling': return 'CHANNEL';
    case 'overheated': return `COOLING ${Math.round(heat)}%`;
    case 'empty': return 'EMPTY';
    default: return heat > 0 ? `HEAT ${Math.round(heat)}%` : '';
  }
}

export function createHud({ documentRef = document, weaponOrder = [] } = {}) {
  const elements = {
    root: required(documentRef, 'hmhHud'),
    hero: required(documentRef, 'hmhHudHero'),
    healthTrack: required(documentRef, 'hmhHudHealthTrack'),
    healthFill: required(documentRef, 'hmhHudHealthFill'),
    healthPips: required(documentRef, 'hmhHudHealthPips'),
    healthText: required(documentRef, 'hmhHudHealthText'),
    weapon: required(documentRef, 'hmhHudWeapon'),
    weaponName: required(documentRef, 'hmhHudWeaponName'),
    weaponState: required(documentRef, 'hmhHudWeaponState'),
    ammoPips: required(documentRef, 'hmhHudAmmoPips'),
    ammoFill: required(documentRef, 'hmhHudAmmoFill'),
    ammoText: required(documentRef, 'hmhHudAmmoText'),
    ammoCap: required(documentRef, 'hmhHudAmmoCap'),
    reserve: required(documentRef, 'hmhHudReserve'),
    ring: required(documentRef, 'hmhHudReloadRing'),
    slots: required(documentRef, 'hmhHudWeaponSlots'),
    grenades: required(documentRef, 'hmhHudGrenades'),
    grenadeCount: required(documentRef, 'hmhHudGrenadeCount'),
    dash: required(documentRef, 'hmhHudDashRing'),
    kills: required(documentRef, 'hmhHudKills'),
    powerups: required(documentRef, 'hmhHudPowerups'),
    bossBar: required(documentRef, 'hmhBossBar'),
    bossPhase: required(documentRef, 'hmhBossPhase'),
    bossFill: required(documentRef, 'hmhBossFill'),
  };

  const healthPips = elements.healthPips.children;
  const ammoPips = elements.ammoPips.children;
  const grenadePips = elements.grenades.children;
  const slotChips = elements.slots.children;
  const powerupChips = elements.powerups.children;

  // Only what a frame can change is remembered. Every field is a primitive so
  // the comparison is a cheap identity check.
  const last = {
    health: null, band: null, healthLit: null,
    weaponId: null, weaponName: null, ammoMode: null, ammoLit: null, ammoVisible: null,
    ammoRatio: null, ammoText: null, ammoCap: null, reserve: null, stateLabel: null, weaponState: null,
    ringActive: null, ringProgress: null,
    ownedMask: null, activeSlot: null,
    grenades: null, grenadeMax: null,
    dashReady: null, dashProgress: null,
    kills: null, powerupLabel: null,
    hero: null, visible: null,
    bossActive: null, bossRatio: null, bossPhase: null,
  };
  // Timed modes whose total duration is not exported (channel cooldown, weapon
  // switch, melee recovery) are anchored on the longest remaining value seen in
  // the current episode, so the ring still sweeps once and only once.
  let ringPeakTicks = 0;
  let ringPeakMode = '';
  let destroyed = false;

  // Establish a known baseline so the first frame is a diff, not a guess.
  elements.bossBar.hidden = true;
  last.bossActive = false;

  const setText = (element, key, value) => {
    if (last[key] === value) return;
    last[key] = value;
    element.textContent = value;
  };

  const setPipRow = (pips, key, litCount, visibleCount) => {
    const visible = visibleCount ?? pips.length;
    if (last[key] === litCount * 100 + visible) return;
    last[key] = litCount * 100 + visible;
    for (let index = 0; index < pips.length; index += 1) {
      const pip = pips[index];
      const shown = index < visible;
      if (pip.hidden !== !shown) pip.hidden = !shown;
      pip.dataset.filled = String(shown && index < litCount);
    }
  };

  const applyRing = (mode, ticksRemaining, ticksTotal, heat) => {
    const active = RING_MODES.has(mode);
    if (!active) {
      ringPeakMode = '';
      ringPeakTicks = 0;
    } else if (mode !== ringPeakMode || ticksRemaining > ringPeakTicks) {
      ringPeakMode = mode;
      ringPeakTicks = ticksRemaining;
    }
    let progress = 1;
    if (active && mode === 'overheated') {
      progress = clamp01(1 - heat / 100);
    } else if (active) {
      const total = ticksTotal > 0 ? ticksTotal : ringPeakTicks;
      progress = total > 0 ? clamp01(1 - ticksRemaining / total) : 1;
    }
    const activeText = String(active);
    if (last.ringActive !== activeText) {
      last.ringActive = activeText;
      elements.ring.dataset.active = activeText;
    }
    const progressText = progress.toFixed(3);
    if (last.ringProgress !== progressText) {
      last.ringProgress = progressText;
      elements.ring.style.setProperty('--progress', progressText);
    }
  };

  return Object.freeze({
    update(view) {
      if (destroyed || !view) return;
      const maxHealth = Number(view.maxHealth) > 0 ? Number(view.maxHealth) : 1;
      const health = Math.max(0, Math.round(Number(view.health) || 0));
      const healthRatio = clamp01(health / maxHealth);
      const healthPercent = `${(healthRatio * 100).toFixed(1)}%`;
      if (last.health !== healthPercent) {
        last.health = healthPercent;
        elements.healthFill.style.setProperty('--hp', healthRatio === 1 ? '100%' : `${Math.round(healthRatio * 100)}%`);
      }
      setText(elements.healthText, 'healthText', String(health));
      const band = healthRatio > 0.6 ? 'high' : healthRatio > 0.3 ? 'mid' : 'low';
      if (last.band !== band) {
        last.band = band;
        elements.healthTrack.dataset.band = band;
      }
      setPipRow(healthPips, 'healthLit', Math.ceil(healthRatio * HEALTH_PIP_COUNT), HEALTH_PIP_COUNT);

      const weaponId = String(view.weaponId ?? 'none');
      const clipSize = Math.max(0, Math.round(Number(view.clipSize) || 0));
      const ammoInClip = Math.max(0, Math.round(Number(view.ammoInClip) || 0));
      const ammoMode = ammoModeFor(weaponId, clipSize);
      setText(elements.weaponName, 'weaponName', String(view.weaponName ?? 'No weapon'));
      if (last.ammoMode !== ammoMode) {
        last.ammoMode = ammoMode;
        elements.weapon.dataset.mode = ammoMode;
      }
      if (last.weaponId !== weaponId) {
        last.weaponId = weaponId;
        elements.weapon.dataset.weapon = weaponId;
      }
      const mode = String(view.mode ?? 'ready');
      if (last.weaponState !== mode) {
        last.weaponState = mode;
        elements.weapon.dataset.state = mode;
      }
      if (ammoMode === 'pips' || ammoMode === 'cells') {
        setPipRow(ammoPips, 'ammoLit', ammoInClip, Math.min(MAX_AMMO_PIPS, clipSize));
      } else {
        setPipRow(ammoPips, 'ammoLit', 0, 0);
      }
      const ammoRatio = ammoMode === 'bar' && clipSize > 0 ? `${Math.round((ammoInClip / clipSize) * 100)}%` : '0%';
      if (last.ammoRatio !== ammoRatio) {
        last.ammoRatio = ammoRatio;
        elements.ammoFill.style.setProperty('--ammo', ammoRatio);
      }
      const meleeNext = String(view.meleeNext ?? '') || 'THRUST';
      setText(elements.ammoText, 'ammoText', ammoMode === 'melee' ? meleeNext : String(ammoInClip));
      setText(elements.ammoCap, 'ammoCap', ammoMode === 'melee' ? 'NEXT' : `/${clipSize}`);
      const reserve = ammoMode === 'melee'
        ? ''
        : view.reserveAmmo === null || view.reserveAmmo === undefined
          ? '∞'
          : String(Math.max(0, Math.round(Number(view.reserveAmmo) || 0)));
      setText(elements.reserve, 'reserve', reserve);

      const secondsRemaining = Number(view.secondsRemaining) || 0;
      const heat = Number(view.heat) || 0;
      setText(elements.weaponState, 'stateLabel', weaponStateLabel(mode, secondsRemaining, heat));
      applyRing(mode, Math.max(0, Number(view.ticksRemaining) || 0), Math.max(0, Number(view.reloadTicksTotal) || 0), heat);

      const ownedMask = Number(view.ownedMask) || 0;
      const activeSlot = Number.isInteger(view.activeSlot) ? view.activeSlot : -1;
      if (last.ownedMask !== ownedMask || last.activeSlot !== activeSlot) {
        last.ownedMask = ownedMask;
        last.activeSlot = activeSlot;
        for (let index = 0; index < slotChips.length; index += 1) {
          slotChips[index].dataset.owned = String((ownedMask & (1 << index)) !== 0);
          slotChips[index].dataset.active = String(index === activeSlot);
        }
      }

      const grenades = Math.max(0, Math.round(Number(view.grenades) || 0));
      const maxGrenades = Math.max(1, Math.round(Number(view.maxGrenades) || 1));
      setPipRow(grenadePips, 'grenades', grenades, Math.min(grenadePips.length, maxGrenades));
      setText(elements.grenadeCount, 'grenadeMax', String(grenades));

      const dashReady = String(Boolean(view.dashReady) || Boolean(view.dashActive));
      if (last.dashReady !== dashReady) {
        last.dashReady = dashReady;
        elements.dash.dataset.ready = dashReady;
      }
      const dashProgress = clamp01(view.dashProgress).toFixed(3);
      if (last.dashProgress !== dashProgress) {
        last.dashProgress = dashProgress;
        elements.dash.style.setProperty('--progress', dashProgress);
      }
      setText(elements.kills, 'kills', String(Math.max(0, Math.round(Number(view.kills) || 0))));

      const powerupLabel = String(view.powerupHudLabel ?? '');
      if (last.powerupLabel !== powerupLabel) {
        last.powerupLabel = powerupLabel;
        const parts = powerupLabel ? powerupLabel.split(' + ') : [];
        for (let index = 0; index < powerupChips.length; index += 1) {
          const text = parts[index] ?? '';
          if (text) powerupChips[index].textContent = text;
          powerupChips[index].hidden = !text;
        }
      }
    },
    setHero(heroId) {
      const id = String(heroId ?? '');
      if (last.hero === id) return;
      last.hero = id;
      elements.hero.dataset.hero = id;
      elements.hero.textContent = HERO_CRESTS[id] ?? 'HMH';
    },
    setBoss(active, ratio, phaseId) {
      const isActive = Boolean(active);
      if (last.bossActive !== isActive) {
        last.bossActive = isActive;
        elements.bossBar.hidden = !isActive;
      }
      if (!isActive) return;
      const ratioText = clamp01(ratio).toFixed(3);
      if (last.bossRatio !== ratioText) {
        last.bossRatio = ratioText;
        elements.bossFill.style.setProperty('--ratio', ratioText);
      }
      const phase = String(phaseId ?? '').replaceAll('-', ' ').toUpperCase();
      if (last.bossPhase !== phase) {
        last.bossPhase = phase;
        elements.bossPhase.textContent = phase;
      }
    },
    setVisible(visible) {
      const shown = Boolean(visible);
      if (last.visible === shown) return;
      last.visible = shown;
      elements.root.hidden = !shown;
    },
    slotIndexFor(weaponId) {
      return weaponOrder.indexOf(weaponId);
    },
    shortCodeFor(weaponId) {
      return WEAPON_SHORT_CODES[weaponId] ?? '—';
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      elements.bossBar.hidden = true;
    },
  });
}

export { WEAPON_SHORT_CODES };
