// Boots the real child headless for a few hundred frames with a still pilot and
// prints what the bridge saw. Proves the harness runs against this checkout.
//   node scripts/hmh-honest-corpus/smoke.mjs [frames]
import { runChild } from './child-driver.mjs';
import { HARNESS_BUILD_HASH, SEASON_ID } from './identity.mjs';

const frames = Number(process.argv[2] ?? 600);
const pilot = {
  chooseUpgrade: (offer) => offer.pendingChoices[0].id,
  frame: () => ({ id: 'headless-virtual-pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }),
};
const started = Date.now();
const result = await runChild({ seed: 12345, buildHash: HARNESS_BUILD_HASH, seasonId: SEASON_ID, pilot, maxFrames: frames, log: console.log });
console.log(`buildHash ${HARNESS_BUILD_HASH} frames ${result.frames} tick ${result.tick} state ${result.state} wall ${Date.now() - started}ms`);
console.log('errors', result.errors.length, result.errors.slice(0, 3).map((e) => `${e.where}: ${e.message.slice(0, 300)}`).join('\n---\n'));
console.log('outbox', result.outbox.map((e) => `${e.tick}:${e.message.type}:${e.valid}`).slice(0, 12).join(' '));
const m = result.spies.motion;
console.log('pos', m?.x, m?.y, 'health', result.spies.health, 'enemies', result.spies.population?.active?.length);
process.exit(result.errors.length ? 1 : 0);
