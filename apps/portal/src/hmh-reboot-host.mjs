import { createHmhParentBridge } from './hmh-reboot-bridge.mjs';

// The worlds the host can request for the child, and the child's query key
// for them (world-context.mjs HMH_WORLD_PARAM, TEN_AREA_WORLD_VALUE and
// LEGACY_WORLD_VALUE): the 2.0.x New Frontier preview (`ten-area`), and from
// game 2.1.0, where the ten-area world is Level 1 by default, the original
// map for Free only (`legacy`). With no request the child runs its default.
export const HMH_FRONTIER_PREVIEW_WORLD = 'ten-area';
export const HMH_ORIGINAL_MAP_WORLD = 'legacy';
const HMH_REQUESTABLE_WORLDS = Object.freeze([HMH_FRONTIER_PREVIEW_WORLD, HMH_ORIGINAL_MAP_WORLD]);
const HMH_FRONTIER_PREVIEW_WORLD_PARAM = 'world';

function normalizeOrigin(value) {
  const origin = new URL(value).origin;
  if (origin === 'null') throw new Error('expectedOrigin must be an absolute network origin');
  return origin;
}

export function createHmhRebootHost({
  mount,
  expectedOrigin,
  documentRef = document,
  bridgeFactory = createHmhParentBridge,
  onReady = () => {},
  onState = () => {},
  onError = () => {},
  onExit = () => {},
  onRunEvent = () => {},
  onRunSummary = () => {},
  onScoreResult = () => {},
  onAchievement = () => {},
  onSettings = () => {},
  readyTimeoutMs = 45_000,
  setTimeoutRef = globalThis.setTimeout,
  clearTimeoutRef = globalThis.clearTimeout,
  runtimeSearch = '',
}) {
  if (!mount?.replaceChildren) throw new Error('HMH reboot mount element is required');
  if (!Number.isFinite(readyTimeoutMs) || readyTimeoutMs <= 0) throw new Error('readyTimeoutMs must be positive');
  const origin = normalizeOrigin(expectedOrigin);
  const requestedRuntimeParams = new URLSearchParams(String(runtimeSearch).replace(/^\?/, ''));
  const runtimeParams = new URLSearchParams();
  if (requestedRuntimeParams.get('evidenceSafe') === '1') runtimeParams.set('evidenceSafe', '1');
  if (runtimeParams.has('evidenceSafe') && requestedRuntimeParams.get('terminalPilot') === '1') runtimeParams.set('terminalPilot', '1');
  // A world request (the New Frontier preview, or the original map from
  // 2.1.0) is an explicit Free-only request from the portal's mode select,
  // never a portal URL. The child honours it only from exactly one
  // `mode=free` plus one `world=` value (apps/hmh-reboot/src/world-context.mjs),
  // and this host adds that pair only for a Free session whose payload is
  // already unranked. A Ranked or rankedEligible session gets the child's
  // default world whatever was requested.
  const childUrl = (session, world) => {
    const params = new URLSearchParams(runtimeParams);
    if (HMH_REQUESTABLE_WORLDS.includes(world) && session.mode === 'free' && session.session?.rankedEligible === false) {
      params.set('mode', 'free');
      params.set(HMH_FRONTIER_PREVIEW_WORLD_PARAM, world);
    }
    return `${origin}/hmh-reboot/index.html${params.size > 0 ? `?${params}` : ''}`;
  };
  let activeBridge = null;
  let activeFrame = null;
  let activeSession = null;
  let bridgeReady = false;
  let pendingCommands = [];
  let readyTimer = null;

  const clearReadyTimer = () => {
    if (readyTimer !== null) clearTimeoutRef(readyTimer);
    readyTimer = null;
  };

  const routeMessage = (message) => {
    if (message.type === 'game:ready') {
      clearReadyTimer();
      onReady(message);
    } else if (message.type === 'game:state' || message.type === 'game:game-over' || message.type === 'game:pause') onState(message);
    else if (message.type === 'game:exit') onExit(message);
    else if (message.type === 'game:run-event') onRunEvent(message);
    else if (message.type === 'game:run-summary') {
      const identity = message.payload?.identity;
      if (!identity || !activeSession
        || identity.seed !== activeSession.session.seed
        || identity.buildHash !== activeSession.session.buildHash
        || identity.mode !== activeSession.mode
        || identity.heroId !== activeSession.heroId) {
        onError(new Error('HMH reboot run-summary identity does not match the mounted session'));
        destroy();
      } else {
        activeFrame.dataset.runSummaryCount = String(Number(activeFrame.dataset.runSummaryCount || 0) + 1);
        onRunSummary(message);
      }
    }
    else if (message.type === 'game:score-result') onScoreResult(message);
    else if (message.type === 'game:achievement') onAchievement(message);
    else if (message.type === 'game:settings') onSettings(message);
    else if (message.type === 'game:error') {
      onError(new Error(`${message.payload.code}: ${message.payload.message}`));
      destroy();
    } else {
      onError(new Error(`unsupported child message type: ${message.type}`));
      destroy();
    }
  };

  // An embedded cabinet owns its own on-screen controls. Without this flag the
  // portal kept rendering its own touch joystick and buttons on top of the
  // iframe, so a phone player saw two complete sets of controls and the
  // parent's set did nothing for the game actually running.
  const claimInputOwnership = (owned) => {
    const root = documentRef.documentElement;
    if (!root?.dataset) return;
    if (owned) root.dataset.embeddedCabinet = 'hmh-reboot';
    else delete root.dataset.embeddedCabinet;
  };

  const destroy = () => {
    clearReadyTimer();
    claimInputOwnership(false);
    activeBridge?.destroy();
    activeBridge = null;
    activeFrame = null;
    activeSession = null;
    bridgeReady = false;
    pendingCommands = [];
    mount.replaceChildren();
  };

  const sendCommand = (type, payload) => {
    const bridge = requireBridge();
    if (bridgeReady) return bridge.send(type, payload);
    if (pendingCommands.length >= 32) throw new Error('HMH reboot command queue is full');
    pendingCommands.push({ type, payload });
    return null;
  };

  const mountSession = (session, { world = null } = {}) => {
    if (activeBridge) destroy();
    activeSession = session;
    const iframe = documentRef.createElement('iframe');
    iframe.className = 'hmh-reboot-frame';
    iframe.title = 'Hard Money Heroes reboot runtime';
    iframe.src = childUrl(session, world);
    const forwardedWorld = new URL(iframe.src).searchParams.get(HMH_FRONTIER_PREVIEW_WORLD_PARAM);
    if (HMH_REQUESTABLE_WORLDS.includes(forwardedWorld)) iframe.dataset.world = forwardedWorld;
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'same-origin';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
    iframe.setAttribute('allow', 'fullscreen; gamepad');
    iframe.setAttribute('allowfullscreen', '');
    iframe.dataset.runtime = 'hmh-reboot';
    iframe.dataset.runSummaryCount = '0';
    mount.replaceChildren(iframe);
    claimInputOwnership(true);
    // The embedded runtime owns the keyboard too: without focusing the frame,
    // WASD lands in the parent document and the hero never moves.
    iframe.addEventListener('load', () => { try { iframe.focus(); iframe.contentWindow?.focus?.(); } catch { /* detached */ } }, { once: true });
    try { iframe.focus(); } catch { /* detached */ }

    const bridge = bridgeFactory({
      iframe,
      expectedOrigin: origin,
      session,
      onMessage: routeMessage,
      onProtocolError: (error) => {
        onError(error);
        destroy();
      },
    });
    iframe.addEventListener('load', () => {
      try {
        bridge.connect();
        bridgeReady = true;
        for (const command of pendingCommands) bridge.send(command.type, command.payload);
        pendingCommands = [];
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
        destroy();
      }
    }, { once: true });
    iframe.addEventListener('error', () => {
      onError(new Error('HMH reboot iframe failed to load'));
      destroy();
    }, { once: true });
    activeFrame = iframe;
    activeBridge = bridge;
    readyTimer = setTimeoutRef(() => {
      readyTimer = null;
      onError(new Error(`HMH reboot READY timed out after ${readyTimeoutMs}ms`));
      destroy();
    }, readyTimeoutMs);
    return iframe;
  };

  const requireBridge = () => {
    if (!activeBridge) throw new Error('HMH reboot session is not mounted');
    return activeBridge;
  };

  return {
    mountSession,
    pause: () => sendCommand('portal:pause', {}),
    resume: () => sendCommand('portal:resume', {}),
    restart: () => sendCommand('portal:restart', {}),
    updateSettings: (settings) => sendCommand('portal:settings', { settings: { ...settings } }),
    destroy,
    get frame() { return activeFrame; },
  };
}
