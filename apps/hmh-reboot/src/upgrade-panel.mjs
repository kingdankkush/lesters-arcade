// The level-up panel (design package S0.2 bundle offset). It used to live in
// cockpit-ui.mjs on the initial path; it is now a lazy chunk that main.mjs
// loads before a run starts. Presentation only: a pick calls onSelectUpgrade
// with an upgrade id and a re-roll calls onRerollUpgrade with a card slot; the
// simulation applies both. Card text comes from progression-content.mjs, never
// from the simulation's choices.
import { authoredPropItemUrl } from './authored-prop-layout.mjs';
import { createSafeTextElement } from './cockpit-ui.mjs';
import { runUpgradeContent } from './progression-content.mjs';
import { resolveUpgradeCardPresentation } from './upgrade-card-presentation.mjs';

// Package 8.3: the re-roll strip under each card. It is a sibling of the
// select button, never nested in it, 36 px tall behind an 8 px dead zone.
// The portal stylesheet owns the look; these inline values keep the geometry
// when it has no rule for the strip yet.
const REROLL_LABELS = Object.freeze({ ready: 'Re-roll', used: 'Re-roll used', none: 'No other upgrades' });
const REROLL_STRIP_STYLE = Object.freeze({
  display: 'block', width: '100%', height: '36px', marginTop: '8px', padding: '0 15px',
  border: '0', borderTop: '1px solid rgba(143,243,255,0.13)', background: 'transparent',
  color: 'var(--cyan)', font: 'inherit', fontSize: '0.68rem', fontWeight: '900',
  letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
});
const VISUALLY_HIDDEN = Object.freeze({
  position: 'absolute', width: '1px', height: '1px', overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', margin: '-1px', padding: '0', border: '0',
});
const GAMEPAD_REROLL_BUTTON = 2;

function required(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) throw new Error(`HMH upgrade panel element #${id} is missing`);
  return element;
}

export function createUpgradePanel({
  documentRef = document,
  propIconUrl = authoredPropItemUrl,
  onSelectUpgrade = () => {},
  onRerollUpgrade = () => {},
  // The gun's display name for card 2's chip. Injected by main.mjs so this
  // lazy chunk never imports the simulation's weapon tables.
  weaponName = (weaponId) => String(weaponId).replaceAll('-', ' '),
} = {}) {
  const elements = {
    menu: required(documentRef, 'hmhMenuToggle'),
    pausePanel: required(documentRef, 'hmhPausePanel'),
    upgradePanel: required(documentRef, 'hmhUpgradePanel'),
    upgradeQueue: required(documentRef, 'hmhUpgradeQueue'),
    upgradeChoices: required(documentRef, 'hmhUpgradeChoices'),
  };
  const listeners = [];
  const upgradeListeners = [];
  // A polite live region that announces a re-rolled card (package 8.3).
  const announcer = documentRef.createElement('span');
  announcer.className = 'hmh-upgrade-announcer';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  Object.assign(announcer.style, VISUALLY_HIDDEN);
  elements.upgradePanel.append(announcer);
  const clearUpgradeListeners = () => { for (const remove of upgradeListeners.splice(0)) remove(); };
  const listen = (element, type, handler, lifetime = listeners) => {
    element.addEventListener(type, handler);
    lifetime.push(() => element.removeEventListener(type, handler));
  };

  // U-4: keyboard and gamepad card selection. The main ticker (and with it the
  // gameplay gamepad poll) is stopped while the simulation sits in 'upgrade',
  // so the panel runs its own rAF poll for exactly as long as it is open.
  // Selection is on the RELEASE edge of A and the D-pad so the button is
  // already up when the ticker restarts; a press edge would buffer a dash or a
  // weapon swap into the first resumed tick.
  const view = documentRef.defaultView;
  const UPGRADE_HOTKEYS = Object.freeze({ Digit1: 0, Digit2: 1 });
  const UPGRADE_MOVE_KEYS = Object.freeze({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 });
  const GAMEPAD_AXIS_THRESHOLD = 0.6;
  const GAMEPAD_AXIS_REPEAT_MS = 180;
  let upgradeCards = [];
  let armedIndex = -1;
  let selectionLatched = false;
  let gamepadFrame = 0;
  let pollGeneration = 0;
  const upgradeOpen = () => !elements.upgradePanel.hidden && upgradeCards.length > 0;
  const armUpgrade = (index) => {
    if (!upgradeCards.length) return;
    const next = Math.max(0, Math.min(upgradeCards.length - 1, index));
    armedIndex = next;
    upgradeCards.forEach((card, position) => card.option.classList.toggle('hmh-upgrade-option--armed', position === next));
    upgradeCards[next].button.focus({ preventScroll: true });
  };
  const selectUpgradeAt = (index) => {
    if (!upgradeOpen() || selectionLatched) return false;
    const card = upgradeCards[index];
    if (!card) return false;
    selectionLatched = true;
    onSelectUpgrade(card.choice.id);
    return true;
  };
  // A re-roll never selects or closes the panel; the host re-shows it with
  // the new card, and it is silent.
  const rerollUpgradeAt = (index) => {
    if (!upgradeOpen() || selectionLatched) return false;
    const card = upgradeCards[index];
    if (!card || card.choice.rerollState !== 'ready') return false;
    onRerollUpgrade(card.choice.slot);
    return true;
  };
  const handleUpgradeKey = (event) => {
    if (!upgradeOpen() || event.repeat) return;
    const code = event.code;
    if (Object.hasOwn(UPGRADE_HOTKEYS, code)) {
      if (!upgradeCards[UPGRADE_HOTKEYS[code]]) return;
      // Menu selections do not enter the gameplay key state.
      event.preventDefault();
      event.stopPropagation();
      selectUpgradeAt(UPGRADE_HOTKEYS[code]);
    } else if (Object.hasOwn(UPGRADE_MOVE_KEYS, code)) {
      event.preventDefault();
      event.stopPropagation();
      armUpgrade(armedIndex + UPGRADE_MOVE_KEYS[code]);
    } else if (code === 'Enter' || code === 'NumpadEnter') {
      // Handled here so the focused button does not also synthesise a click.
      event.preventDefault();
      event.stopPropagation();
      selectUpgradeAt(armedIndex);
    } else if (code === 'KeyR') {
      // Package 8.3: R re-rolls the armed card.
      event.preventDefault();
      event.stopPropagation();
      rerollUpgradeAt(armedIndex);
    }
    // Space is the fire key and is deliberately not a card shortcut.
  };
  listen(documentRef, 'keydown', handleUpgradeKey);
  const stopGamepadPoll = () => {
    pollGeneration += 1;
    if (gamepadFrame) view?.cancelAnimationFrame?.(gamepadFrame);
    gamepadFrame = 0;
  };
  const startGamepadPoll = () => {
    stopGamepadPoll();
    if (typeof view?.requestAnimationFrame !== 'function' || typeof view?.navigator?.getGamepads !== 'function') return;
    const generation = pollGeneration;
    const held = { select: false, reroll: false, previous: false, next: false, axisAt: -Infinity };
    const pressed = (buttons, index) => buttons?.[index]?.pressed === true || Number(buttons?.[index]?.value ?? 0) > 0.5;
    const poll = (now) => {
      if (generation !== pollGeneration) return;
      gamepadFrame = 0;
      if (!upgradeOpen()) return;
      const pad = [...(view.navigator.getGamepads() ?? [])].find(Boolean);
      if (pad) {
        const select = pressed(pad.buttons, 0);
        const reroll = pressed(pad.buttons, GAMEPAD_REROLL_BUTTON);
        const previous = pressed(pad.buttons, 14) || pressed(pad.buttons, 12);
        const next = pressed(pad.buttons, 15) || pressed(pad.buttons, 13);
        const axis = Number(pad.axes?.[0] ?? 0);
        if (held.previous && !previous) armUpgrade(armedIndex - 1);
        if (held.next && !next) armUpgrade(armedIndex + 1);
        if (Math.abs(axis) > GAMEPAD_AXIS_THRESHOLD) {
          if (now - held.axisAt >= GAMEPAD_AXIS_REPEAT_MS) {
            held.axisAt = now;
            armUpgrade(armedIndex + Math.sign(axis));
          }
        } else {
          held.axisAt = -Infinity;
        }
        const release = held.select && !select;
        const rerollRelease = held.reroll && !reroll;
        held.select = select;
        held.reroll = reroll;
        held.previous = previous;
        held.next = next;
        if (release) selectUpgradeAt(armedIndex);
        // Gamepad X re-rolls the armed card on release (package 8.3).
        else if (rerollRelease) rerollUpgradeAt(armedIndex);
      }
      if (generation === pollGeneration && upgradeOpen()) gamepadFrame = view.requestAnimationFrame(poll);
    };
    gamepadFrame = view.requestAnimationFrame(poll);
  };
  const prettyBranch = (branch) => String(branch ?? '').replace(/-capstone$/, '').replaceAll('-', ' ');

  const hideUpgrade = () => {
    stopGamepadPoll();
    clearUpgradeListeners();
    upgradeCards = [];
    armedIndex = -1;
    selectionLatched = false;
    elements.upgradePanel.hidden = true;
    elements.upgradeChoices.replaceChildren();
  };

  return Object.freeze({
    // rerolledSlot: the card slot a re-roll just replaced; focus moves to the
    // new card and the live region names it.
    showUpgrade(snapshot, { rerolledSlot = null } = {}) {
      clearUpgradeListeners();
      elements.pausePanel.hidden = true;
      elements.menu.setAttribute('aria-expanded', 'false');
      elements.upgradePanel.hidden = false;
      elements.upgradeQueue.textContent = `${snapshot.pendingLevels} pending`;
      elements.upgradeChoices.replaceChildren();
      upgradeCards = [];
      armedIndex = -1;
      selectionLatched = false;
      const compactUpgradeLayout = documentRef.defaultView?.matchMedia?.('(max-width: 600px)').matches ?? false;
      let index = 0;
      for (const choice of snapshot.pendingChoices) {
        const card = resolveUpgradeCardPresentation(choice, index);
        const content = runUpgradeContent(choice.id);
        index += 1;
        const option = createSafeTextElement(documentRef, 'div', { className: 'hmh-upgrade-option' });
        option.setAttribute('role', 'listitem');
        option.dataset.tier = card.tier;
        const button = createSafeTextElement(documentRef, 'button');
        button.type = 'button';
        button.className = 'hmh-upgrade-choice';
        button.dataset.upgradeId = choice.id;
        const icon = createSafeTextElement(documentRef, 'span', { className: 'hmh-upgrade-choice__icon' });
        icon.setAttribute('aria-hidden', 'true');
        if (card.iconAssetId) icon.style.backgroundImage = `url("${propIconUrl(card.iconAssetId)}")`;
        const meta = createSafeTextElement(documentRef, 'span', { className: 'hmh-upgrade-choice__meta' });
        const tier = createSafeTextElement(documentRef, 'small', { className: 'hmh-upgrade-choice__tier', text: card.tierLabel });
        const branch = createSafeTextElement(documentRef, 'span', {
          className: 'hmh-upgrade-choice__branch',
          text: `${prettyBranch(choice.branch)} · rank ${choice.nextRank}/${choice.maxRank}`,
        });
        meta.append(tier, branch);
        // Card 2's gun chip, e.g. SHOTGUN 4/9 (a gun with a capstone counts 10).
        if (choice.weaponId && choice.mastery) {
          meta.append(createSafeTextElement(documentRef, 'span', {
            className: 'hmh-upgrade-choice__gun',
            text: `${String(weaponName(choice.weaponId)).toUpperCase()} ${choice.mastery.ranks}/${choice.mastery.total}`,
          }));
        }
        const title = createSafeTextElement(documentRef, 'strong', { text: content.title });
        const mechanical = createSafeTextElement(documentRef, 'b', { text: content.mechanicalLabel });
        button.append(icon, meta, title, mechanical);
        if (card.hotkey) {
          button.setAttribute('aria-keyshortcuts', card.hotkey);
          const hotkey = createSafeTextElement(documentRef, 'span', { className: 'hmh-upgrade-choice__hotkey', text: card.hotkey });
          hotkey.setAttribute('aria-hidden', 'true');
          button.append(hotkey);
        }
        const choiceIndex = upgradeCards.length;
        listen(button, 'click', () => selectUpgradeAt(choiceIndex), upgradeListeners);
        const rerollState = Object.hasOwn(REROLL_LABELS, choice.rerollState) ? choice.rerollState : 'none';
        const strip = createSafeTextElement(documentRef, 'button', { className: 'hmh-upgrade-reroll', text: REROLL_LABELS[rerollState] });
        strip.type = 'button';
        strip.dataset.slot = String(choice.slot ?? choiceIndex);
        strip.dataset.rerollState = rerollState;
        strip.disabled = rerollState !== 'ready';
        strip.setAttribute('aria-label', `${REROLL_LABELS[rerollState]}: card ${choiceIndex + 1}`);
        if (rerollState === 'ready') strip.setAttribute('aria-keyshortcuts', 'R');
        Object.assign(strip.style, REROLL_STRIP_STYLE, rerollState === 'ready' ? {} : { cursor: 'default', opacity: '0.55' });
        listen(strip, 'click', () => rerollUpgradeAt(choiceIndex), upgradeListeners);
        upgradeCards.push({ option, button, choice });

        const detail = createSafeTextElement(documentRef, 'details', { className: 'hmh-upgrade-details' });
        detail.open = !compactUpgradeLayout;
        const summary = createSafeTextElement(documentRef, 'summary', {
          text: detail.open ? 'Hide details' : 'Upgrade details',
        });
        summary.setAttribute('aria-expanded', String(detail.open));
        const description = createSafeTextElement(documentRef, 'p', { text: content.description });
        listen(detail, 'toggle', () => {
          summary.setAttribute('aria-expanded', String(detail.open));
          summary.textContent = detail.open ? 'Hide details' : 'Upgrade details';
        }, upgradeListeners);
        detail.append(summary, description);
        option.append(button, strip, detail);
        elements.upgradeChoices.append(option);
      }
      // The first card is armed and focused, so a click on the first button
      // and a bare Enter both pick it, exactly as before. After a re-roll the
      // new card is armed and focused instead, and announced.
      const rerolledIndex = rerolledSlot === null ? -1 : upgradeCards.findIndex((card) => card.choice.slot === rerolledSlot);
      armUpgrade(Math.max(0, rerolledIndex));
      if (rerolledIndex >= 0) {
        const rerolled = upgradeCards[rerolledIndex].choice;
        announcer.textContent = `Card ${rerolledIndex + 1} re-rolled: ${runUpgradeContent(rerolled.id).title}, rank ${rerolled.nextRank} of ${rerolled.maxRank}.`;
      }
      startGamepadPoll();
    },
    hideUpgrade,
    get open() { return upgradeOpen(); },
    destroy() {
      hideUpgrade();
      for (const remove of listeners.splice(0)) remove();
      announcer.remove?.();
    },
  });
}
