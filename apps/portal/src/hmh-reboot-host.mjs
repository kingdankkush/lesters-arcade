import { createHmhParentBridge } from './hmh-reboot-bridge.mjs';

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
  onScoreResult = () => {},
  onAchievement = () => {},
  onSettings = () => {},
  readyTimeoutMs = 8000,
  setTimeoutRef = globalThis.setTimeout,
  clearTimeoutRef = globalThis.clearTimeout,
}) {
  if (!mount?.replaceChildren) throw new Error('HMH reboot mount element is required');
  if (!Number.isFinite(readyTimeoutMs) || readyTimeoutMs <= 0) throw new Error('readyTimeoutMs must be positive');
  const origin = normalizeOrigin(expectedOrigin);
  let activeBridge = null;
  let activeFrame = null;
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

  const mountSession = (session) => {
    if (activeBridge) destroy();
    const iframe = documentRef.createElement('iframe');
    iframe.className = 'hmh-reboot-frame';
    iframe.title = 'Hard Money Heroes reboot runtime';
    iframe.src = `${origin}/hmh-reboot/index.html`;
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'same-origin';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
    iframe.setAttribute('allow', 'fullscreen; gamepad');
    iframe.setAttribute('allowfullscreen', '');
    iframe.dataset.runtime = 'hmh-reboot';
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
