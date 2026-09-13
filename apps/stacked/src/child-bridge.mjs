import { STACKED_BRIDGE_PROTOCOL } from '../../portal/src/stacked-contracts.mjs';
import { validateStackedBridgeMessage } from '../../portal/src/stacked-bridge-protocol.mjs';
export function connectStackedChild(onMessage, onFailure) {
  let port = null, sessionId = null, sequence = 0;
  const send = (type, payload) => {
    if (!port || !sessionId) return;
    const message = { protocol: STACKED_BRIDGE_PROTOCOL, type, sessionId, messageId: 'game-' + (++sequence), payload };
    const check = validateStackedBridgeMessage(message, { sessionId });
    if (!check.ok) throw new Error(type + ': ' + check.error);
    port.postMessage(message);
  };
  const connect = event => {
    if (port || event.source !== window.parent || event.origin !== window.location.origin || event.data?.protocol !== STACKED_BRIDGE_PROTOCOL || event.data?.type !== 'portal:connect' || event.ports.length !== 1) return;
    port = event.ports[0]; window.removeEventListener('message', connect);
    port.onmessage = async ({ data }) => {
      try {
        if (!data?.type?.startsWith('portal:') || !validateStackedBridgeMessage(data, sessionId ? { sessionId } : {}).ok) throw new Error('Invalid parent message');
        if (!sessionId && data.type !== 'portal:init') throw new Error('Missing session initialization');
        if (sessionId && data.type === 'portal:init') throw new Error('Repeated initialization');
        sessionId ??= data.sessionId;
        await onMessage(data, send);
      } catch (error) { onFailure(error); }
    };
    port.start();
  };
  window.addEventListener('message', connect);
  return { send, get sessionId() { return sessionId; }, destroy() { window.removeEventListener('message', connect); port?.close(); port = null; } };
}
