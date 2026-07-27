import { authoredPropItemUrl } from './authored-prop-atlas.mjs';

function required(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) throw new Error(`HMH cockpit element #${id} is missing`);
  return element;
}

function integerText(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-US');
}

const SAFE_DYNAMIC_TAGS = new Set(['button', 'div', 'details', 'summary', 'span', 'strong', 'b', 'p']);

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
  onResume = () => {},
  onRestart = () => {},
  onExit = () => {},
  onSelectUpgrade = () => {},
} = {}) {
  const elements = {
    score: required(documentRef, 'hmhRunScore'),
    level: required(documentRef, 'hmhRunLevel'),
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
    resume: required(documentRef, 'hmhResumeButton'),
    restart: required(documentRef, 'hmhRestartButton'),
    exit: required(documentRef, 'hmhExitButton'),
    upgradePanel: required(documentRef, 'hmhUpgradePanel'),
    upgradeQueue: required(documentRef, 'hmhUpgradeQueue'),
    upgradeChoices: required(documentRef, 'hmhUpgradeChoices'),
  };
  let musicEnabled = true;
  const listeners = [];
  const listen = (element, type, handler) => {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  };

  listen(elements.music, 'click', () => {
    musicEnabled = !musicEnabled;
    elements.music.textContent = musicEnabled ? 'Music on' : 'Music off';
    elements.music.setAttribute('aria-pressed', String(musicEnabled));
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

  return Object.freeze({
    updateRun(snapshot) {
      elements.score.textContent = integerText(snapshot?.score);
      elements.level.textContent = integerText(snapshot?.level ?? 1);
      elements.xp.textContent = integerText(snapshot?.xpCurrentLevel);
      elements.xpNext.textContent = integerText(snapshot?.xpForNextLevel);
      const progress = Math.max(0, Math.min(1, Number(snapshot?.xpProgress) || 0));
      elements.xpFill.style.width = `${(progress * 100).toFixed(2)}%`;
    },
    setSession(payload, adapterStatus) {
      elements.profileName.textContent = payload.profile.displayName;
      elements.profileHero.textContent = payload.heroId;
      elements.profileMode.textContent = payload.mode;
      elements.profileSeason.textContent = payload.session.seasonId;
      elements.adapter.textContent = adapterStatus.label;
      elements.exit.disabled = !adapterStatus || adapterStatus.authority !== 'portal';
      elements.exit.textContent = elements.exit.disabled ? 'Arcade exit unavailable' : 'Exit to arcade';
    },
    setMusicEnabled(enabled) {
      musicEnabled = Boolean(enabled);
      elements.music.textContent = musicEnabled ? 'Music on' : 'Music off';
      elements.music.setAttribute('aria-pressed', String(musicEnabled));
    },
    setPaused(paused) {
      elements.pausePanel.hidden = !paused;
      elements.menu.setAttribute('aria-expanded', String(paused));
      if (paused) elements.resume.focus({ preventScroll: true });
    },
    showUpgrade(snapshot) {
      elements.pausePanel.hidden = true;
      elements.menu.setAttribute('aria-expanded', 'false');
      elements.upgradePanel.hidden = false;
      elements.upgradeQueue.textContent = `${snapshot.pendingLevels} pending`;
      elements.upgradeChoices.replaceChildren();
      const compactUpgradeLayout = documentRef.defaultView?.matchMedia?.('(max-width: 600px)').matches ?? false;
      for (const choice of snapshot.pendingChoices) {
        const option = createSafeTextElement(documentRef, 'div', { className: 'hmh-upgrade-option' });
        option.setAttribute('role', 'listitem');
        const button = createSafeTextElement(documentRef, 'button');
        button.type = 'button';
        button.className = 'hmh-upgrade-choice';
        button.dataset.upgradeId = choice.id;
        const icon = createSafeTextElement(documentRef, 'span', { className: 'hmh-upgrade-choice__icon' });
        icon.setAttribute('aria-hidden', 'true');
        icon.style.backgroundImage = `url("${authoredPropItemUrl(choice.id)}")`;
        const branch = createSafeTextElement(documentRef, 'span', {
          className: 'hmh-upgrade-choice__branch',
          text: `${choice.branch} · rank ${choice.nextRank}/${choice.maxRank}`,
        });
        const title = createSafeTextElement(documentRef, 'strong', { text: choice.title });
        const mechanical = createSafeTextElement(documentRef, 'b', { text: choice.mechanicalLabel });
        button.append(icon, branch, title, mechanical);
        listen(button, 'click', () => onSelectUpgrade(choice.id));

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
      elements.upgradeChoices.querySelector('button')?.focus({ preventScroll: true });
    },
    hideUpgrade() {
      elements.upgradePanel.hidden = true;
      elements.upgradeChoices.replaceChildren();
    },
    get menuOpen() { return !elements.pausePanel.hidden; },
    destroy() {
      for (const remove of listeners.splice(0)) remove();
      elements.upgradeChoices.replaceChildren();
    },
  });
}
