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
}) {
  if (!mount?.replaceChildren) throw new Error('HMH reboot mount element is required');
  const origin = normalizeOrigin(expectedOrigin);
  let activeBridge = null;
  let activeFrame = null;
  let bridgeReady = false;
  let pendingCommands = [];

  const routeMessage = (message) => {
    if (message.type === 'game:ready') onReady(message);
    else if (message.type === 'game:state' || message.type === 'game:game-over') onState(message);
    else if (message.type === 'game:error') onError(new Error(`${message.payload.code}: ${message.payload.message}`));
    else onError(new Error(`unsupported child message type: ${message.type}`));
  };

  const destroy = () => {
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

    const bridge = bridgeFactory({
      iframe,
      expectedOrigin: origin,
      session,
      onMessage: routeMessage,
      onProtocolError: onError,
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
