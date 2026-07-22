import {
  createBridgeEnvelope,
  validateChildMessage,
  validateConnectMessage,
  validateParentMessage,
} from '../../../sdk/hmh-bridge-protocol.mjs';

function normalizeOrigin(value) {
  const origin = new URL(value).origin;
  if (origin === 'null') throw new Error('expectedParentOrigin must be an absolute network origin');
  return origin;
}

export function createHmhChildBridge({
  windowRef = window,
  expectedParentOrigin,
  runtimeInfo,
  onInit = () => {},
  onMessage = () => {},
  onProtocolError = () => {},
}) {
  const parentOrigin = normalizeOrigin(expectedParentOrigin);
  let state = 'idle';
  let port = null;
  let sessionId = '';
  let messageSequence = 0;
  const seenParentMessageIds = new Set();

  const send = (type, payload) => {
    if (state !== 'initialized' || !port) throw new Error('HMH child bridge is closed or not initialized');
    const message = createBridgeEnvelope({
      type,
      sessionId,
      messageId: `game-${++messageSequence}`,
      payload,
    });
    const validation = validateChildMessage(message);
    if (!validation.ok) throw new Error(validation.error);
    port.postMessage(message);
    return message;
  };

  const report = (message) => onProtocolError(message instanceof Error ? message : new Error(String(message)));

  const handlePortMessage = (event) => {
    const validation = validateParentMessage(event.data);
    if (!validation.ok) {
      report(validation.error);
      return;
    }
    const message = validation.value;
    if (state === 'connected') {
      if (message.type !== 'portal:init') {
        report('portal:init must be the first channel message');
        return;
      }
      sessionId = message.sessionId;
      seenParentMessageIds.add(message.messageId);
      state = 'initialized';
      onInit(message.payload);
      send('game:ready', {
        runtimeVersion: runtimeInfo.runtimeVersion,
        renderer: runtimeInfo.renderer,
        capabilities: [...runtimeInfo.capabilities],
      });
      return;
    }
    if (state !== 'initialized') {
      report('child bridge is not initialized');
      return;
    }
    if (message.sessionId !== sessionId) {
      report('parent message session does not match the bound session');
      return;
    }
    if (seenParentMessageIds.has(message.messageId)) {
      report('parent message replay rejected');
      return;
    }
    seenParentMessageIds.add(message.messageId);
    onMessage(message);
    if (message.type === 'portal:dispose') stop();
  };

  const handleWindowMessage = (event) => {
    if (event.origin !== parentOrigin || event.source !== windowRef.parent) return;
    if (state !== 'listening') {
      report('duplicate or late bridge handshake rejected');
      return;
    }
    const validation = validateConnectMessage(event.data);
    if (!validation.ok) {
      report(validation.error);
      return;
    }
    if (!Array.isArray(event.ports) || event.ports.length !== 1 || !event.ports[0]) {
      report('bridge handshake requires exactly one transferred port');
      return;
    }
    port = event.ports[0];
    port.onmessage = handlePortMessage;
    port.start?.();
    state = 'connected';
  };

  const start = () => {
    if (state !== 'idle') throw new Error('HMH child bridge can only start once');
    state = 'listening';
    windowRef.addEventListener('message', handleWindowMessage);
  };

  function stop() {
    if (state === 'closed') return;
    state = 'closed';
    windowRef.removeEventListener('message', handleWindowMessage);
    if (port) {
      port.onmessage = null;
      port.close?.();
    }
  }

  return {
    start,
    send,
    stop,
    get connected() { return state === 'connected' || state === 'initialized'; },
    get initialized() { return state === 'initialized'; },
  };
}
