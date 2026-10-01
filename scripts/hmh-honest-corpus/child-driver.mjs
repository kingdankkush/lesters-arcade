// Boots the real HMH child (apps/hmh-reboot/src/main.mjs) headless,
// act as its parent over hmh-bridge/v1, and drive it one 60 Hz frame at a time
// with a virtual gamepad. Returns every message the child sent.
import './register-hooks.mjs';
import { installHeadlessEnvironment, makeEvent, PAGE_URL } from './dom-env.mjs';
import { createBridgeEnvelope, validateChildMessage } from '../../sdk/hmh-bridge-protocol.mjs';
import { projectHmhRuntimeSettings } from '../../apps/portal/src/hmh-player-settings.mjs';
// The 1.9.0 child emits run summary schema 7; the portal bridge validates
// with the v7 schema module (schema 1-7), and so does this parent.
import { validateRunSummaryPayload as validateRunSummary } from '../../sdk/hmh-run-summary-schema-v7.mjs';

const FRAME_MS = 1000 / 60;
const tickYield = () => new Promise((resolve) => setImmediate(resolve));

function traceRow(spies, tick, pad) {
  const me = spies.motion;
  const enemies = (spies.population?.active ?? []).filter((e) => e.active && e.health > 0);
  let nearest = Infinity;
  let within200 = 0;
  for (const e of enemies) { const d = Math.hypot(e.x - me.x, e.y - me.y); nearest = Math.min(nearest, d); if (d < 200) within200 += 1; }
  return { tick, x: Math.round(me.x), y: Math.round(me.y), hp: spies.health, enemies: enemies.length, nearest: Math.round(nearest), within200, weapon: spies.loadout?.activeWeaponId, move: pad ? [Number(pad.axes[0].toFixed(2)), Number(pad.axes[1].toFixed(2))] : null };
}

// `search` and `mode` default to the corpus's Ranked page; an unofficial
// Free probe passes its own query and mode: 'free' (unranked session).
export async function runChild({ seed, buildHash, seasonId, heroId = 'lit-commando', pilot, maxFrames = 400_000, log = () => {}, trace = null, search = '', mode = 'ranked' }) {
  const gamepadRef = { current: null };
  const headless = installHeadlessEnvironment({ gamepadRef, search });
  const origin = new URL(PAGE_URL).origin;
  const port = {
    onmessage: null,
    postMessage(message) {
      const validation = validateChildMessage(message, { validateRunSummary });
      headless.outbox.push({ frame: frames, tick: headless.spies.simulation?.tick ?? 0, message, valid: validation.ok, error: validation.ok ? null : validation.error });
    },
    start() {},
    close() {},
  };
  headless.port = port;
  let frames = 0;
  process.on('unhandledRejection', (error) => headless.errors.push({ where: 'unhandledRejection', message: error?.stack ?? String(error) }));

  await import('../../apps/hmh-reboot/src/main.mjs');
  await tickYield();
  // Parent side of the handshake: one transferred port, then portal:init.
  headless.dispatchWindowEvent(makeEvent('message', {
    data: { protocol: 'hmh-bridge/v1', type: 'portal:connect', nonce: 'headlessRealRunsNonce0001' },
    origin,
    source: headless.parentWindow,
    ports: [port],
  }));
  const sessionId = `game-session-headless-${seed.toString(16)}`;
  const settings = {
    ...projectHmhRuntimeSettings({}),
    musicEnabled: false,
    screenShake: false,
    gore: false,
    reduceMotion: true,
    reduceFlash: true,
  };
  port.onmessage({
    data: createBridgeEnvelope({
      type: 'portal:init',
      sessionId,
      messageId: 'portal-1',
      payload: {
        gameId: 'lester-blaster',
        mode,
        heroId,
        profile: { displayName: 'Headless Pilot', locale: 'en-US' },
        session: { seed, buildHash, seasonId, rankedEligible: mode === 'ranked' },
        settings,
      },
    }),
  });

  // Boot: navgrid bake, bridge activation, initializeSession.
  for (let guard = 0; guard < 200_000 && !headless.spies.simulation; guard += 1) {
    headless.clock.nowMs += 1;
    await tickYield();
  }
  if (!headless.spies.simulation) throw new Error(`child never initialized a session: ${headless.querySelector("#hmhRebootStatus").textContent} // ${headless.querySelector("#hmhRebootSession").textContent} // ${JSON.stringify(headless.querySelector("#hmhRebootStage").dataset)} // ${JSON.stringify(headless.errors.slice(0, 3))}`);
  const app = headless.app;
  const spies = headless.spies;
  let continued = false;
  let summaryMessage = null;
  let stepErrors = 0;
  const upgradeLog = [];
  const rerolled = new Set();

  for (frames = 0; frames < maxFrames; frames += 1) {
    headless.clock.nowMs += FRAME_MS;
    const simulation = spies.simulation;
    // Startup: take the basic-graphics path (art readiness never alters a tick).
    if (!continued && frames > 2) {
      headless.click('#hmhStartupContinue');
      continued = true;
    }
    if (simulation.state === 'upgrade' && spies.upgradeOffer) {
      const offer = spies.upgradeOffer;
      // A re-roll (package 8.3) at most once per card per offer: the panel
      // repaints with the new card and the pick waits for the next frame.
      const rerollSlot = pilot.rerollSlot?.(offer, simulation.tick) ?? null;
      const rerollKey = `${simulation.tick}:${offer.offerKind}:${offer.offersOpened}:${rerollSlot}`;
      if (rerollSlot !== null && !rerolled.has(rerollKey)) {
        rerolled.add(rerollKey);
        upgradeLog.push({ tick: simulation.tick, kind: offer.offerKind, offered: offer.pendingChoices.map((c) => c.id), rerolledSlot: rerollSlot });
        spies.upgradePanelOptions.onRerollUpgrade(rerollSlot);
      } else {
        const choiceId = pilot.chooseUpgrade(offer, spies) ?? offer.pendingChoices[0].id;
        upgradeLog.push({ tick: simulation.tick, kind: offer.offerKind, offered: offer.pendingChoices.map((c) => c.id), chosen: choiceId });
        spies.upgradeOffer = null;
        spies.upgradePanelOptions.onSelectUpgrade(choiceId);
      }
    }
    if (simulation.state === 'active') gamepadRef.current = pilot.frame(spies, simulation.tick);
    if (trace && simulation.state === 'active' && simulation.tick % 60 === 0) trace.push(traceRow(spies, simulation.tick, gamepadRef.current));
    if (app.ticker.started) {
      for (const callback of [...app.ticker.callbacks]) {
        try {
          callback(app.ticker);
        } catch (error) {
          stepErrors += 1;
          headless.errors.push({ where: `ticker@tick${simulation.tick}`, message: error?.stack ?? String(error) });
          if (stepErrors > 20) throw new Error(`too many ticker errors: ${headless.errors.slice(-1)[0].message}`);
        }
      }
    }
    summaryMessage = headless.outbox.find((entry) => entry.message.type === 'game:run-summary') ?? null;
    if (summaryMessage && simulation.state === 'game-over') break;
    if (frames % 4 === 0) await tickYield();
    if (frames % 36_000 === 0 && frames > 0) log(`frame ${frames} tick ${simulation.tick} state ${simulation.state}`);
  }
  // Let trailing sends land.
  for (let i = 0; i < 5; i += 1) await tickYield();
  return {
    frames,
    tick: spies.simulation.tick,
    state: spies.simulation.state,
    outbox: headless.outbox,
    errors: headless.errors,
    upgradeLog,
    spies,
  };
}
