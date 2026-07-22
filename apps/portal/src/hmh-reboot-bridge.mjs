import {
  HMH_BRIDGE_PROTOCOL,
  createBridgeEnvelope,
  validateChildMessage,
  validateConnectMessage,
  validateParentMessage,
} from '../../../sdk/hmh-bridge-protocol.mjs';

function normalizeOrigin(value) {
  const url = new URL(value);
  if (url.origin === 'null') throw new Error('expectedOrigin must be an absolute network origin');
  return url.origin;
}

export function createHmhParentBridge({
  iframe,
  expectedOrigin,
  session,
  onMessage = () => {},
  onProtocolError = () => {},
  channelFactory = () => new MessageChannel(),
  nonceFactory = () => crypto.randomUUID().replaceAll('-', ''),
}) {
  if (!iframe || !iframe.contentWindow) throw new Error('iframe with contentWindow is required');
  const origin = normalizeOrigin(expectedOrigin);
  let channel = null;
  let state = 'idle';
  let messageSequence = 0;
  const seenChildMessageIds = new Set();

  const makeMessage = (type, payload) => createBridgeEnvelope({
    type,
    sessionId: session.sessionId,
    messageId: `portal-${++messageSequence}`,
    payload,
  });

  const send = (type, payload) => {
    if (state !== 'connected' || !channel) throw new Error('HMH bridge is closed or not connected');
    const message = makeMessage(type, payload);
    const validation = validateParentMessage(message);
    if (!validation.ok) throw new Error(validation.error);
    channel.port1.postMessage(message);
    return message;
  };

  const connect = () => {
    if (state !== 'idle') throw new Error('HMH bridge can only connect once');
    const childOrigin = new URL(iframe.src, `${origin}/`).origin;
    if (childOrigin !== origin) throw new Error('iframe origin does not match expected origin');

    const nonce = nonceFactory();
    const connectMessage = { protocol: HMH_BRIDGE_PROTOCOL, type: 'portal:connect', nonce };
    const connectValidation = validateConnectMessage(connectMessage);
    if (!connectValidation.ok) throw new Error(connectValidation.error);

    channel = channelFactory();
    if (!channel?.port1 || !channel?.port2) throw new Error('MessageChannel factory returned invalid ports');
    channel.port1.onmessage = (event) => {
      const validation = validateChildMessage(event.data);
      if (!validation.ok) {
        onProtocolError(new Error(validation.error));
        return;
      }
      if (validation.value.sessionId !== session.sessionId) {
        onProtocolError(new Error('child message session does not match the bound session'));
        return;
      }
      if (seenChildMessageIds.has(validation.value.messageId)) {
        onProtocolError(new Error('child message replay rejected'));
        return;
      }
      seenChildMessageIds.add(validation.value.messageId);
      onMessage(validation.value);
    };
    channel.port1.start?.();
    state = 'connected';
    iframe.contentWindow.postMessage(connectMessage, origin, [channel.port2]);
    send('portal:init', {
      mode: session.mode,
      heroId: session.heroId,
      settings: { ...session.settings },
    });
  };

  const destroy = () => {
    if (state === 'closed') return;
    if (state === 'connected' && channel) send('portal:dispose', {});
    state = 'closed';
    if (channel) {
      channel.port1.onmessage = null;
      channel.port1.close?.();
      channel.port2.close?.();
    }
  };

  return {
    connect,
    send,
    destroy,
    get connected() { return state === 'connected'; },
  };
}
