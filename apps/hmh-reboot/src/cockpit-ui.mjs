import { authoredPropItemUrl } from './authored-prop-atlas.mjs';
import { RUN_UPGRADE_CATALOG } from './run-progression.mjs';
import { resolveComboPresentation } from './combo-feedback.mjs';
import { actionHelpRows } from './action-map.mjs';
import { resolveUpgradeCardPresentation } from './upgrade-card-presentation.mjs';

function required(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) throw new Error(`HMH cockpit element #${id} is missing`);
  return element;
}

function integerText(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-US');
}

const SAFE_DYNAMIC_TAGS = new Set(['button', 'div', 'details', 'summary', 'span', 'strong', 'b', 'p', 'li', 'dt', 'dd', 'small']);
const PAUSE_SETTING_KEYS = Object.freeze({
  musicEnabled: 'hmhSettingMusic',
  screenShake: 'hmhSettingScreenShake',
  reduceMotion: 'hmhSettingReduceMotion',
  reduceFlash: 'hmhSettingReduceFlash',
});

function createSafeTextElement(documentRef, tagName, { className = '', text = '' } = {}) {
  if (!SAFE_DYNAMIC_TAGS.has(tagName)) throw new TypeError('cockpit dynamic element tag is not allowed');
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = String(text);
  return element;
}

export function createCockpitUi({
  documentRef = document,
  onMenuToggle = () => {},
  onMusicToggle = () => {},
  onSettingToggle = () => {},
  onSettingLevel = () => {},
  onBindingChange = () => {},
  onResume = () => {},
  onRestart = () => {},
  onExit = () => {},
  onSelectUpgrade = () => {},
} = {}) {
  const elements = {
    score: required(documentRef, 'hmhRunScore'),
    level: required(documentRef, 'hmhRunLevel'),
    combo: required(documentRef, 'hmhRunCombo'),
    comboLabel: required(documentRef, 'hmhRunComboLabel'),
    comboStat: required(documentRef, 'hmhRunComboStat'),
    xp: required(documentRef, 'hmhRunXp'),
    xpNext: required(documentRef, 'hmhRunXpNext'),
    xpFill: required(documentRef, 'hmhRunXpFill'),
    music: required(documentRef, 'hmhMusicToggle'),
    menu: required(documentRef, 'hmhMenuToggle'),
    profileToggle: required(documentRef, 'hmhProfileToggle'),
    profilePanel: required(documentRef, 'hmhProfilePanel'),
    profileName: required(documentRef, 'hmhProfileName'),
    profileHero: required(documentRef, 'hmhProfileHero'),
    profileMode: required(documentRef, 'hmhProfileMode'),
    profileSeason: required(documentRef, 'hmhProfileSeason'),
    adapter: required(documentRef, 'hmhAdapterStatus'),
    pausePanel: required(documentRef, 'hmhPausePanel'),
    controlsHint: documentRef.getElementById('hmhControlsHint'),
    controlsHintDismiss: documentRef.getElementById('hmhControlsHintDismiss'),
    resume: required(documentRef, 'hmhResumeButton'),
    restart: required(documentRef, 'hmhRestartButton'),
    exit: required(documentRef, 'hmhExitButton'),
    settings: Object.fromEntries(Object.entries(PAUSE_SETTING_KEYS).map(([key, id]) => [key, required(documentRef, id)])),
    sfxVolume: required(documentRef, 'hmhSettingSfxVolume'),
    sfxVolumeValue: required(documentRef, 'hmhSettingSfxVolumeValue'),
    buildEmpty: required(documentRef, 'hmhBuildEmpty'),
    buildSummary: required(documentRef, 'hmhBuildSummary'),
    controlsCard: required(documentRef, 'hmhControlsCard'),
    upgradePanel: required(documentRef, 'hmhUpgradePanel'),
    upgradeQueue: required(documentRef, 'hmhUpgradeQueue'),
    upgradeChoices: required(documentRef, 'hmhUpgradeChoices'),
  };
  let musicEnabled = true;
  let sessionMode = 'free';
  let currentSettings = {};
  let awaitingActionId = null;
  const listeners = [];
  const listen = (element, type, handler) => {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  };

  listen(elements.music, 'click', () => {
    musicEnabled = !musicEnabled;
    elements.music.textContent = musicEnabled ? 'Music on' : 'Music off';
    elements.music.setAttribute('aria-pressed', String(musicEnabled));
    elements.settings.musicEnabled.checked = musicEnabled;
    onMusicToggle(musicEnabled);
  });
  listen(elements.menu, 'click', () => onMenuToggle());
  listen(elements.profileToggle, 'click', () => {
    const open = elements.profilePanel.hidden;
    elements.profilePanel.hidden = !open;
    elements.profileToggle.setAttribute('aria-expanded', String(open));
  });
  listen(elements.resume, 'click', () => onResume());
  listen(elements.restart, 'click', () => onRestart());
  listen(elements.exit, 'click', () => onExit());
  for (const [key, input] of Object.entries(elements.settings)) {
    listen(input, 'change', () => {
      const enabled = Boolean(input.checked);
      if (key === 'musicEnabled') {
        musicEnabled = enabled;
        elements.music.textContent = enabled ? 'Music on' : 'Music off';
        elements.music.setAttribute('aria-pressed', String(enabled));
        onMusicToggle(enabled);
      } else {
        onSettingToggle(key, enabled);
      }
    });
  }

  // U-5: the child owns its SFX bus, so the slider is child-owned. The readout
  // follows every drag frame; the host (and through it the bridge) is told on
  // `change` only, so a drag never floods game:settings.
  const clampLevel = (value) => Math.min(1, Math.max(0, Number(value) || 0));
  const levelText = (value) => `${Math.round(clampLevel(value) * 100)}%`;
  const showLevel = (value) => {
    const level = clampLevel(value);
    elements.sfxVolume.value = String(level);
    elements.sfxVolume.setAttribute('aria-valuetext', levelText(level));
    elements.sfxVolumeValue.textContent = levelText(level);
  };
  listen(elements.sfxVolume, 'input', () => {
    elements.sfxVolume.setAttribute('aria-valuetext', levelText(elements.sfxVolume.value));
    elements.sfxVolumeValue.textContent = levelText(elements.sfxVolume.value);
  });
  listen(elements.sfxVolume, 'change', () => {
    const level = clampLevel(elements.sfxVolume.value);
    showLevel(level);
    onSettingLevel('sfxVolume', level);
  });

  // U-4: keyboard and gamepad card selection. The main ticker (and with it the
  // gameplay gamepad poll) is stopped while the simulation sits in 'upgrade',
  // so the cockpit runs its own rAF poll for exactly as long as the panel is
  // open. Selection is on the RELEASE edge of A and the D-pad so the button is
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
  const handleUpgradeKey = (event) => {
    if (!upgradeOpen() || event.repeat) return;
    const code = event.code;
    if (Object.hasOwn(UPGRADE_HOTKEYS, code)) {
      if (!upgradeCards[UPGRADE_HOTKEYS[code]]) return;
      // Digit1/Digit2 are also weapon-slot gameplay keys captured on the window;
      // stopping here keeps the pick out of the gameplay key state.
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
    const held = { select: false, previous: false, next: false, axisAt: -Infinity };
    const pressed = (buttons, index) => buttons?.[index]?.pressed === true || Number(buttons?.[index]?.value ?? 0) > 0.5;
    const poll = (now) => {
      if (generation !== pollGeneration) return;
      gamepadFrame = 0;
      if (!upgradeOpen()) return;
      const pad = [...(view.navigator.getGamepads() ?? [])].find(Boolean);
      if (pad) {
        const select = pressed(pad.buttons, 0);
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
        held.select = select;
        held.previous = previous;
        held.next = next;
        if (release) selectUpgradeAt(armedIndex);
      }
      if (generation === pollGeneration && upgradeOpen()) gamepadFrame = view.requestAnimationFrame(poll);
    };
    gamepadFrame = view.requestAnimationFrame(poll);
  };
  const prettyBranch = (branch) => String(branch ?? '').replace(/-capstone$/, '').replaceAll('-', ' ');

  const keyboardLabel = (code) => String(code ?? '')
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('ShiftLeft', 'Left Shift')
    .replace('ShiftRight', 'Right Shift');
  const renderControls = () => {
    elements.controlsCard.replaceChildren();
    for (const row of actionHelpRows(currentSettings.keyboardBindings)) {
      const wrapper = createSafeTextElement(documentRef, 'div');
      const label = createSafeTextElement(documentRef, 'dt', { text: row.label });
      const value = createSafeTextElement(documentRef, 'dd');
      const binding = createSafeTextElement(documentRef, 'button', { className: 'hmh-binding-button', text: keyboardLabel(row.keyboard) });
      binding.type = 'button';
      binding.disabled = sessionMode === 'ranked';
      binding.dataset.actionId = row.id;
      binding.setAttribute('aria-label', binding.disabled
        ? `${row.label}: ${keyboardLabel(row.keyboard)}. Locked during ranked play.`
        : `Rebind ${row.label}; currently ${keyboardLabel(row.keyboard)}`);
      binding.addEventListener('click', () => {
        if (binding.disabled) return;
        awaitingActionId = row.id;
        binding.textContent = 'Press a key…';
      });
      const deviceHelp = [row.gamepad, row.touch].filter(Boolean).join(' · ');
      const help = createSafeTextElement(documentRef, 'small', { text: deviceHelp || row.help });
      value.append(binding, help);
      wrapper.append(label, value);
      elements.controlsCard.append(wrapper);
    }
  };
  const handleBindingKey = (event) => {
    if (!awaitingActionId) return;
    event.preventDefault();
    event.stopPropagation();
    const actionId = awaitingActionId;
    awaitingActionId = null;
    try { onBindingChange(actionId, event.code); } catch { renderControls(); }
  };
  listen(documentRef, 'keydown', handleBindingKey);
  renderControls();

  // M1 first-run hint: dismissible, and it retires itself after a bounded
  // on-screen time so it never covers sustained play.
  const CONTROLS_HINT_MS = 12_000;
  if (elements.controlsHintDismiss && elements.controlsHint) {
    elements.controlsHintDismiss.addEventListener('click', () => {
      elements.controlsHint.hidden = true;
    });
    documentRef.defaultView?.setTimeout?.(() => {
      elements.controlsHint.hidden = true;
    }, CONTROLS_HINT_MS);
  }

  return Object.freeze({
    updateRun(snapshot) {
      elements.score.textContent = integerText(snapshot?.score);
      elements.level.textContent = integerText(snapshot?.level ?? 1);
      elements.xp.textContent = integerText(snapshot?.xpCurrentLevel);
      elements.xpNext.textContent = integerText(snapshot?.xpForNextLevel);
      const progress = Math.max(0, Math.min(1, Number(snapshot?.xpProgress) || 0));
      elements.xpFill.style.width = `${(progress * 100).toFixed(2)}%`;
      const ranked = Object.entries(snapshot?.ranks ?? {})
        .filter(([id, rank]) => Object.hasOwn(RUN_UPGRADE_CATALOG, id) && Number.isInteger(rank) && rank > 0);
      elements.buildSummary.replaceChildren();
      for (const [id, rank] of ranked) {
        const upgrade = RUN_UPGRADE_CATALOG[id];
        const row = createSafeTextElement(documentRef, 'li', { className: 'hmh-build-rank' });
        const title = createSafeTextElement(documentRef, 'strong', { text: upgrade.title });
        const detail = createSafeTextElement(documentRef, 'span', { text: `Rank ${rank}/${upgrade.maxRank} · ${upgrade.mechanicalLabel}` });
        row.append(title, detail);
        elements.buildSummary.append(row);
      }
      elements.buildEmpty.hidden = ranked.length > 0;
      elements.buildSummary.hidden = ranked.length === 0;
    },
    updateCombo(combo) {
      const presentation = resolveComboPresentation(combo);
      elements.combo.textContent = presentation.text;
      elements.comboLabel.textContent = presentation.label;
      elements.comboStat.dataset.tier = presentation.tier;
      elements.comboStat.setAttribute('aria-label', presentation.label);
    },
    setSession(payload, adapterStatus) {
      sessionMode = payload.mode;
      elements.profileName.textContent = payload.profile.displayName;
      elements.profileHero.textContent = payload.heroId;
      elements.profileMode.textContent = payload.mode;
      elements.profileSeason.textContent = payload.session.seasonId;
      elements.adapter.textContent = adapterStatus.label;
      elements.exit.disabled = !adapterStatus || adapterStatus.authority !== 'portal';
      elements.exit.textContent = elements.exit.disabled ? 'Arcade exit unavailable' : 'Exit to arcade';
      renderControls();
    },
    setMusicEnabled(enabled) {
      musicEnabled = Boolean(enabled);
      elements.music.textContent = musicEnabled ? 'Music on' : 'Music off';
      elements.music.setAttribute('aria-pressed', String(musicEnabled));
      elements.settings.musicEnabled.checked = musicEnabled;
    },
    setSettings(nextSettings = {}) {
      currentSettings = nextSettings;
      for (const [key, input] of Object.entries(elements.settings)) input.checked = Boolean(nextSettings[key]);
      // combat-audio's sfx bus defaults to 1 when the host never sent a level.
      showLevel(nextSettings.sfxVolume ?? 1);
      musicEnabled = Boolean(nextSettings.musicEnabled);
      elements.music.textContent = musicEnabled ? 'Music on' : 'Music off';
      elements.music.setAttribute('aria-pressed', String(musicEnabled));
      renderControls();
    },
    setPaused(paused) {
      elements.pausePanel.hidden = !paused;
      elements.menu.setAttribute('aria-expanded', String(paused));
      if (paused) {
        // Opening the menu exposes the full controls card, so the hint has
        // served its purpose.
        if (elements.controlsHint) elements.controlsHint.hidden = true;
        elements.resume.focus({ preventScroll: true });
      }
    },
    showUpgrade(snapshot) {
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
        if (card.iconAssetId) icon.style.backgroundImage = `url("${authoredPropItemUrl(card.iconAssetId)}")`;
        const meta = createSafeTextElement(documentRef, 'span', { className: 'hmh-upgrade-choice__meta' });
        const tier = createSafeTextElement(documentRef, 'small', { className: 'hmh-upgrade-choice__tier', text: card.tierLabel });
        const branch = createSafeTextElement(documentRef, 'span', {
          className: 'hmh-upgrade-choice__branch',
          text: `${prettyBranch(choice.branch)} · rank ${choice.nextRank}/${choice.maxRank}`,
        });
        meta.append(tier, branch);
        const title = createSafeTextElement(documentRef, 'strong', { text: choice.title });
        const mechanical = createSafeTextElement(documentRef, 'b', { text: choice.mechanicalLabel });
        button.append(icon, meta, title, mechanical);
        if (card.hotkey) {
          button.setAttribute('aria-keyshortcuts', card.hotkey);
          const hotkey = createSafeTextElement(documentRef, 'span', { className: 'hmh-upgrade-choice__hotkey', text: card.hotkey });
          hotkey.setAttribute('aria-hidden', 'true');
          button.append(hotkey);
        }
        listen(button, 'click', () => onSelectUpgrade(choice.id));
        upgradeCards.push({ option, button, choice });

        const detail = createSafeTextElement(documentRef, 'details', { className: 'hmh-upgrade-details' });
        detail.open = !compactUpgradeLayout;
        const summary = createSafeTextElement(documentRef, 'summary', {
          text: detail.open ? 'Hide details' : 'Upgrade details',
        });
        summary.setAttribute('aria-expanded', String(detail.open));
        const description = createSafeTextElement(documentRef, 'p', { text: choice.description });
        listen(detail, 'toggle', () => {
          summary.setAttribute('aria-expanded', String(detail.open));
          summary.textContent = detail.open ? 'Hide details' : 'Upgrade details';
        });
        detail.append(summary, description);
        option.append(button, detail);
        elements.upgradeChoices.append(option);
      }
      // The first card is armed and focused, so a click on the first button
      // and a bare Enter both pick it, exactly as before.
      armUpgrade(0);
      startGamepadPoll();
    },
    hideUpgrade() {
      stopGamepadPoll();
      upgradeCards = [];
      armedIndex = -1;
      selectionLatched = false;
      elements.upgradePanel.hidden = true;
      elements.upgradeChoices.replaceChildren();
    },
    get menuOpen() { return !elements.pausePanel.hidden; },
    dismissControlsHint() {
      // M1: the first-run hint retires permanently once acknowledged, once
      // the player opens the pause menu (the card lives there), or on the
      // bounded timeout below. It must never sit over sustained gameplay.
      if (elements.controlsHint) elements.controlsHint.hidden = true;
    },
    destroy() {
      awaitingActionId = null;
      stopGamepadPoll();
      upgradeCards = [];
      for (const remove of listeners.splice(0)) remove();
      elements.upgradeChoices.replaceChildren();
    },
  });
}
