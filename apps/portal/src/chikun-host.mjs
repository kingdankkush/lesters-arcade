import { createChikunParentBridge } from './chikun-bridge.mjs';

function normalizeOrigin(value) {
  const origin = new URL(value).origin;
  if (origin === 'null') throw new Error('expectedOrigin must be an absolute network origin');
  return origin;
}

export function createChikunHost({
  mount,
  expectedOrigin,
  documentRef = document,
  bridgeFactory = createChikunParentBridge,
  onReady = () => {},
  onState = () => {},
  onResult = () => {},
  onRestartRequest = () => {},
  onExitRequest = () => {},
  onError = () => {},
  readyTimeoutMs = 8000,
  setTimeoutRef = globalThis.setTimeout,
  clearTimeoutRef = globalThis.clearTimeout,
}) {
  if (!mount?.replaceChildren) throw new Error('Chikun mount element is required');
  if (!Number.isFinite(readyTimeoutMs) || readyTimeoutMs <= 0) throw new Error('readyTimeoutMs must be positive');
  const origin = normalizeOrigin(expectedOrigin);
  let activeBridge = null;
  let activeFrame = null;
  let ready = false;
  let pendingCommands = [];
  let readyTimer = null;

  const clearReadyTimer = () => {
    if (readyTimer !== null) clearTimeoutRef(readyTimer);
    readyTimer = null;
  };
  const claimInput = (owned) => {
    const dataset = documentRef.documentElement?.dataset;
    if (!dataset) return;
    if (owned) dataset.embeddedCabinet = 'chikun';
    else if (dataset.embeddedCabinet === 'chikun') delete dataset.embeddedCabinet;
  };
  const destroy = () => {
    clearReadyTimer();
    claimInput(false);
    activeBridge?.destroy();
    activeBridge = null;
    activeFrame = null;
    ready = false;
    pendingCommands = [];
    mount.replaceChildren();
  };
  const fail = (error) => {
    onError(error instanceof Error ? error : new Error(String(error)));
    destroy();
  };
  const routeMessage = (message) => {
    if (message.type === 'game:ready') { clearReadyTimer(); onReady(message); }
    else if (message.type === 'game:state' || message.type === 'game:pause') onState(message);
    else if (message.type === 'game:result') onResult(message);
    else if (message.type === 'game:restart-request') onRestartRequest(message);
    else if (message.type === 'game:exit-request') onExitRequest(message);
    else if (message.type === 'game:error') fail(new Error(`${message.payload.code}: ${message.payload.message}`));
    else fail(new Error(`unsupported Chikun child message type: ${message.type}`));
  };
  const requireBridge = () => {
    if (!activeBridge) throw new Error('Chikun session is not mounted');
    return activeBridge;
  };
  const sendCommand = (type, payload) => {
    const bridge = requireBridge();
    if (ready) return bridge.send(type, payload);
    if (pendingCommands.length >= 16) throw new Error('Chikun command queue is full');
    pendingCommands.push({ type, payload });
    return null;
  };
  const mountSession = (session) => {
    if (activeBridge) destroy();
    const iframe = documentRef.createElement('iframe');
    iframe.className = 'chikun-game-frame';
    iframe.title = "Chikun's Escape runtime";
    iframe.src = `${origin}/chikun/index.html`;
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'same-origin';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.setAttribute('allow', 'fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    iframe.dataset.runtime = 'chikun';
    mount.replaceChildren(iframe);
    claimInput(true);
    iframe.addEventListener('load', () => { try { iframe.focus(); iframe.contentWindow?.focus?.(); } catch { /* detached */ } }, { once: true });
    const bridge = bridgeFactory({
      iframe,
      expectedOrigin: origin,
      session,
      onMessage: routeMessage,
      onProtocolError: fail,
    });
    iframe.addEventListener('load', () => {
      try {
        bridge.connect();
        ready = true;
        for (const command of pendingCommands) bridge.send(command.type, command.payload);
        pendingCommands = [];
      } catch (error) { fail(error); }
    }, { once: true });
    iframe.addEventListener('error', () => fail(new Error('Chikun iframe failed to load')), { once: true });
    activeFrame = iframe;
    activeBridge = bridge;
    readyTimer = setTimeoutRef(() => {
      readyTimer = null;
      fail(new Error(`Chikun READY timed out after ${readyTimeoutMs}ms`));
    }, readyTimeoutMs);
    return iframe;
  };

  return Object.freeze({
    mountSession,
    pause: () => sendCommand('portal:pause', {}),
    resume: () => sendCommand('portal:resume', {}),
    restart: () => sendCommand('portal:restart', {}),
    updateSettings: (settings) => sendCommand('portal:settings', { settings: { ...settings } }),
    destroy,
    get frame() { return activeFrame; },
  });
}
