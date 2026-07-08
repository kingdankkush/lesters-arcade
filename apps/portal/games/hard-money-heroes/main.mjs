import { buildArcadeMessage, resolveParentTargetOrigin } from '../../src/arcade-sdk.mjs';

const GAME_ID = 'hard-money-heroes';
let seq = 0;
let parentOrigin = resolveParentTargetOrigin({ referrer: document.referrer });

function post(type, payload = {}) {
  const message = buildArcadeMessage(type, payload, { gameId: GAME_ID, seq: seq++ });
  const targetOrigin = parentOrigin ?? resolveParentTargetOrigin({ fallbackOrigin: window.location.origin });
  if (targetOrigin) window.parent?.postMessage(message, targetOrigin);
  return message;
}

async function boot() {
  const root = document.getElementById('hmhSandboxRoot') ?? document.body;
  root.dataset.cabinetId = GAME_ID;
  root.textContent = 'Hard Money Heroes sandbox cabinet ready. Parent portal owns wallet, profile, ranked, and lifecycle rails.';
  const { loadHMHGame } = await import('../../src/games/hmh/loader.mjs');
  await loadHMHGame();
  post('arcade.ready', {});
}

window.addEventListener('message', (event) => {
  const observedOrigin = resolveParentTargetOrigin({ handshakeOrigin: event.origin });
  if (!parentOrigin && observedOrigin) parentOrigin = observedOrigin;
  if (parentOrigin && observedOrigin !== parentOrigin) return;

  const command = event.data?.command ?? event.data?.type;
  if (command === 'arcade.start') post('arcade.sessionStart', { mode: event.data?.mode === 'ranked' ? 'ranked' : 'free' });
  if (command === 'arcade.pause') document.documentElement.dataset.paused = 'true';
  if (command === 'arcade.resume') document.documentElement.dataset.paused = 'false';
  if (command === 'arcade.teardown') document.documentElement.dataset.teardown = 'true';
});

boot().catch((error) => {
  post('arcade.gameOver', { score: 0, error: String(error?.message ?? error) });
});
