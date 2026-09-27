import { RUN_UPGRADE_CATALOG } from './run-progression.mjs';
import { resolveComboPresentation } from './combo-feedback.mjs';
import { actionHelpRows } from './action-map.mjs';
import { touchControlsHintText } from './touch-controls.mjs';

export const CONTROLS_HINT_LIFETIME_MS = Object.freeze({ desktop: 12_000, touch: 6_000 });

const keyboardHintLabel = (code) => String(code ?? '')
  .replace(/^Key/, '')
  .replace(/^Digit/, '')
  .replace('ShiftLeft', 'Shift')
  .replace('ShiftRight', 'Shift');

export function resolveControlsHint({ touchUiEnabled = false, keyboardBindings } = {}) {
  if (touchUiEnabled) {
    return Object.freeze({
      mode: 'touch',
      text: touchControlsHintText(),
      lifetimeMs: CONTROLS_HINT_LIFETIME_MS.touch,
    });
  }
  const help = Object.fromEntries(actionHelpRows(keyboardBindings).map((row) => [row.id, row]));
  const move = ['moveUp', 'moveLeft', 'moveDown', 'moveRight'].map((id) => keyboardHintLabel(help[id].keyboard)).join('');
  return Object.freeze({
    mode: 'desktop',
    text: `${move} move · Mouse aim · Right click grenade · ${keyboardHintLabel(help.dodge.keyboard)} dodge · ${keyboardHintLabel(help.weaponNext.keyboard)} swap · Tab wheel · ${keyboardHintLabel(help.pause.keyboard)} menu`,
    lifetimeMs: CONTROLS_HINT_LIFETIME_MS.desktop,
  });
}

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

// Shared with the lazy upgrade panel, so every dynamic cockpit node goes
// through one tag allowlist and textContent, never markup.
export function createSafeTextElement(documentRef, tagName, { className = '', text = '' } = {}) {
  if (!SAFE_DYNAMIC_TAGS.has(tagName)) throw new TypeError('cockpit dynamic element tag is not allowed');
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = String(text);
  return element;
}

export function createCockpitUi({
  documentRef = document,
  touchUiEnabled = false,
  onMenuToggle = () => {},
  onMusicToggle = () => {},
  onSettingToggle = () => {},
  onSettingLevel = () => {},
  onBindingChange = () => {},
  onResume = () => {},
  onRestart = () => {},
  onExit = () => {},
  // Card text from the lazy progression-content chunk (design package S0.2).
  // Without it the pause build list names each upgrade by its id.
  upgradeContent = {},
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
    controlsHintText: documentRef.getElementById('hmhControlsHintText'),
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
  };
  let musicEnabled = true;
  let sessionMode = 'free';
  let currentSettings = {};
  let awaitingActionId = null;
  const listeners = [];
  const listen = (element, type, handler, lifetime = listeners) => {
    element.addEventListener(type, handler);
    lifetime.push(() => element.removeEventListener(type, handler));
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
      const deviceHelp = [...row.keyboardAlternates.map(keyboardLabel), row.pointer, row.gamepad, row.touch].filter(Boolean).join(' · ');
      const help = createSafeTextElement(documentRef, 'small', { text: deviceHelp || row.help });
      value.append(binding, help);
      wrapper.append(label, value);
      elements.controlsCard.append(wrapper);
    }
    for (const [label, text] of [['Aim', 'Mouse or AIM stick. Release AIM for automatic targeting and firing.'], ['Automatic actions', 'Approach machinery to activate it. Collect supplies and power-ups by walking over them. Close combat happens as you move. With a keyboard you dodge with the Dodge key; on touch or a gamepad, safe dodges happen as you move.']]) {
      const row = createSafeTextElement(documentRef, 'div');
      row.append(createSafeTextElement(documentRef, 'dt', { text: label }), createSafeTextElement(documentRef, 'dd', { text }));
      elements.controlsCard.append(row);
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

  // M1/K-8 first-run hint: its device mode is the same authority that creates
  // the touch overlay. Touch gets a shorter lifetime and only names controls
  // the adapter actually creates.
  let controlsHintTimer = null;
  const hideControlsHint = () => {
    if (elements.controlsHint) elements.controlsHint.hidden = true;
  };
  const renderControlsHint = () => {
    if (!elements.controlsHint) return;
    const hint = resolveControlsHint({ touchUiEnabled, keyboardBindings: currentSettings.keyboardBindings });
    elements.controlsHint.dataset.mode = hint.mode;
    if (elements.controlsHintText) elements.controlsHintText.textContent = hint.text;
    return hint;
  };
  if (elements.controlsHintDismiss && elements.controlsHint) {
    const hint = renderControlsHint();
    listen(elements.controlsHintDismiss, 'click', hideControlsHint);
    controlsHintTimer = documentRef.defaultView?.setTimeout?.(hideControlsHint, hint.lifetimeMs) ?? null;
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
        const content = Object.hasOwn(upgradeContent, id) ? upgradeContent[id] : null;
        const row = createSafeTextElement(documentRef, 'li', { className: 'hmh-build-rank' });
        const title = createSafeTextElement(documentRef, 'strong', { text: content?.title ?? id });
        const detail = createSafeTextElement(documentRef, 'span', { text: `Rank ${rank}/${upgrade.maxRank}${content?.mechanicalLabel ? ` · ${content.mechanicalLabel}` : ''}` });
        row.append(title, detail);
        elements.buildSummary.append(row);
      }
      elements.buildEmpty.hidden = ranked.length > 0;
      elements.buildSummary.hidden = ranked.length === 0;
    },
    updateCombo(combo) {
      const presentation = combo && typeof combo === 'object' ? combo : resolveComboPresentation(combo);
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
      renderControlsHint();
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
      renderControlsHint();
    },
    setPaused(paused) {
      elements.pausePanel.hidden = !paused;
      elements.menu.setAttribute('aria-expanded', String(paused));
      if (paused) {
        // Opening the menu exposes the full controls card, so the hint has
        // served its purpose.
        hideControlsHint();
        elements.resume.focus({ preventScroll: true });
      }
    },
    get menuOpen() { return !elements.pausePanel.hidden; },
    dismissControlsHint() {
      // M1: the first-run hint retires permanently once acknowledged, once
      // the player opens the pause menu (the card lives there), or on the
      // bounded timeout below. It must never sit over sustained gameplay.
      hideControlsHint();
    },
    destroy() {
      awaitingActionId = null;
      if (controlsHintTimer !== null) documentRef.defaultView?.clearTimeout?.(controlsHintTimer);
      controlsHintTimer = null;
      for (const remove of listeners.splice(0)) remove();
    },
  });
}
