import { STACKED_BRIDGE_PROTOCOL, STACKED_MAX_EVIDENCE_CHUNKS } from './stacked-contracts.mjs';
import { validateStackedBridgeMessage } from './stacked-bridge-protocol.mjs';
import { reassembleStackedEvidence } from './stacked-evidence-transport.mjs';
import { createStackedPortalLifecycle } from './stacked-portal-lifecycle.mjs';
import { createStackedAudioSampler } from './stacked-audio.mjs';
import { saveStackedSettings } from './stacked-player-settings.mjs';

export function createStackedHost({ mount, session, startLevel = 1, profile, settings, music, onReady = () => {}, onState = () => {}, onResult = () => {}, onRestart = () => {}, onExit = () => {}, onError = () => {}, persistRanked }) {
  const sessionId = session.urlSessionId ?? session.sessionId;
  const iframe = document.createElement('iframe');
  iframe.className = 'stacked-game-frame'; iframe.title = "STACKED — Lester's Arcade"; iframe.src = '/stacked/index.html';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin'); iframe.setAttribute('allow', 'autoplay; fullscreen; gamepad');
  const channel = new MessageChannel(), sampler = createStackedAudioSampler(music);
  let sequence = 0, childSequence = 0, ready = false, disposed = false, audioRaf = 0, lastAudio = 0, worker = null, cancelVerification = null;
  const chunks = [];
  const send = (type, payload = {}) => {
    if (disposed) return;
    const message = { protocol: STACKED_BRIDGE_PROTOCOL, type, sessionId, messageId: 'portal-' + (++sequence), payload };
    const validation = validateStackedBridgeMessage(message, { sessionId });
    if (!validation.ok) throw new Error(type + ': ' + validation.error);
    channel.port1.postMessage(message);
  };
  const verify = (evidence, options) => new Promise((resolve, reject) => {
    if (disposed) { reject(new Error('cabinet-closed')); return; }
    worker = new Worker('/dist/stacked/verify-worker.js', { type: 'module' });
    const timer = setTimeout(() => { finish(); reject(new Error('Verification timed out; no score saved')); }, 15000);
    const finish = () => { clearTimeout(timer); worker?.terminate(); worker = null; cancelVerification = null; };
    cancelVerification = () => { finish(); reject(new Error('cabinet-closed')); };
    worker.onmessage = ({ data }) => { finish(); data?.ok ? resolve(data.tuple) : reject(new Error('Replay verification rejected the evidence')); };
    worker.onerror = () => { finish(); reject(new Error('Verifier could not start')); };
    worker.postMessage({ requestId: 'verify-1', evidence, ...options });
  });
  const lifecycle = createStackedPortalLifecycle({ session, startLevel, verify, persistRanked });
  const fail = error => { onError(error); };
  const readyTimer = setTimeout(() => { if (!ready) { fail(new Error('STACKED did not finish loading. Return to the arcade and try again.')); destroy(); } }, 20000);
  const sample = now => {
    if (disposed) return;
    if (ready && now - lastAudio >= 1000 / 30) {
      const audio = sampler.sample(now); if (audio) send('portal:audio-frame', { audio }); lastAudio = now;
    }
    audioRaf = requestAnimationFrame(sample);
  };
  channel.port1.onmessage = async ({ data }) => {
    if (disposed) return;
    try {
      if (!data?.type?.startsWith('game:') || !validateStackedBridgeMessage(data, { sessionId }).ok) throw new Error('Rejected invalid STACKED message');
      const index = /^game-([1-9][0-9]*)$/.exec(data.messageId);
      if (!index || Number(index[1]) !== childSequence + 1) throw new Error('Repeated or out-of-order STACKED message');
      childSequence++;
      if (data.type === 'game:ready') { if (ready) throw new Error('Repeated ready'); ready = true; clearTimeout(readyTimer); onReady(); iframe.contentWindow?.focus(); }
      else if (data.type === 'game:state') onState(data.payload);
      else if (data.type === 'game:evidence-chunk') {
        if (chunks.length >= STACKED_MAX_EVIDENCE_CHUNKS || data.payload.chunkIndex !== chunks.length) throw new Error('Evidence out of order');
        chunks.push(data);
      } else if (data.type === 'game:result') {
        const evidence = reassembleStackedEvidence(chunks, { sessionId });
        const digest = '0x' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', evidence))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (disposed) return;
        if (digest !== data.payload.evidenceDigest || evidence.length !== data.payload.totalRawBytes) throw new Error('Evidence digest mismatch');
        const result = await lifecycle.finish(evidence, data.payload.tuple);
        if (disposed) return;
        send('portal:result-status', { accepted: result.ok, message: result.ok ? result.ranked ? 'Replay verified. This is a local Ranked preview, not an online or paid leaderboard.' : 'Replay verified locally. Free Mode did not write to your profile, achievements or score boards.' : 'Not saved: ' + result.reason });
        onResult(result);
      } else if (data.type === 'game:preferences-request') {
        const p = data.payload;
        settings = { ...settings, accessibility: { ...settings.accessibility, reduceMotion: p.reduceMotion }, video: { ...settings.video, reducedEffects: p.reducedEffects, audioReactive: p.audioReactive, ghostPiece: p.ghostPiece, gridLines: p.gridLines }, audio: { ...settings.audio, sfxEnabled: p.sfxEnabled } };
        let saved = false;
        try { saved = saveStackedSettings(window.localStorage, settings); } catch {}
        send('portal:settings', { settings });
        send('portal:preferences-status', { saved });
      } else if (data.type === 'game:restart-request') onRestart();
      else if (data.type === 'game:exit-request') onExit();
      else if (data.type === 'game:error') throw new Error(data.payload.message);
    } catch (error) {
      if (disposed) return;
      fail(error);
      if (data?.type === 'game:result') send('portal:result-status', { accepted: false, message: 'Not saved: ' + error.message });
    }
  };
  iframe.addEventListener('load', () => {
    if (disposed) return;
    iframe.contentWindow.postMessage({ protocol: STACKED_BRIDGE_PROTOCOL, type: 'portal:connect' }, location.origin, [channel.port2]);
    send('portal:init', { gameId: 'stacked', mode: session.leaderboardEligible ? 'ranked' : 'free', profile, session: { seed: session.seed, buildHash: session.buildHash, seasonId: session.seasonId, rankedEligible: !!session.leaderboardEligible }, settings: { ...settings, startLevel } });
  }, { once: true });
  function destroy() {
    if (disposed) return;
    send('portal:exit'); disposed = true; lifecycle.cancel(); cancelVerification?.(); clearTimeout(readyTimer); cancelAnimationFrame(audioRaf); worker?.terminate();
    channel.port1.close(); channel.port2.close();
    if (document.documentElement.dataset.embeddedCabinet === 'stacked') delete document.documentElement.dataset.embeddedCabinet;
    iframe.remove();
  }
  document.documentElement.dataset.embeddedCabinet = 'stacked';
  mount.replaceChildren(iframe); channel.port1.start(); sampler.resume(); audioRaf = requestAnimationFrame(sample);
  return { destroy, pause: () => send('portal:pause'), resume: () => send('portal:resume'), frame: iframe };
}
