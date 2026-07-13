import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createInProcessGameAdapter } from '../apps/portal/src/game-adapter.mjs';
import { parseInboundMessage } from '../apps/portal/src/arcade-sdk.mjs';
import { validateGameManifest } from '../apps/portal/src/game-manifest.mjs';

const file = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

test('SDK README supports a clean-room trivial cabinet integration', () => {
  const readmePath = file('sdk/README.md');
  const templatePath = file('apps/portal/games/template-cabinet/game.manifest.json');
  assert.equal(existsSync(readmePath), true);
  const readme = readFileSync(readmePath, 'utf8');
  for (const contract of [
    'game.manifest.json', 'createInProcessGameAdapter', 'arcade.ready', 'arcade.scoreSubmit',
    'sandbox="allow-scripts"', '?devCabinets=1', 'rankedEligible', '9:16', '16:9',
  ]) assert.ok(readme.includes(contract), `SDK README missing ${contract}`);

  const manifest = {
    ...JSON.parse(readFileSync(templatePath, 'utf8')),
    id: 'clean-room-cabinet',
    name: 'Clean Room Cabinet',
    status: 'coming-soon',
    description: 'Trivial SDK clean-room validation cabinet.',
  };
  const validated = validateGameManifest(manifest);
  assert.equal(validated.valid, true, validated.errors.join('; '));
  assert.equal(validated.manifest.rankedEligible, false);

  const adapter = createInProcessGameAdapter({ gameId: manifest.id, sessionId: 'clean-room-session-1' });
  const events = [];
  adapter.on((message) => events.push(message));
  const context = adapter.init({ mode: 'free', displayName: 'Clean Room Tester' });
  assert.equal(context.capabilities.canWriteOfficialState, false);
  adapter.start({ mode: 'free' });
  adapter.emitStatUpdate({ score: 10, kills: 1 });
  adapter.end({ score: 10, kills: 1, survivalTime: 2 });

  assert.deepEqual(events.map((event) => event.type), [
    'arcade.ready', 'arcade.sessionStart', 'arcade.statUpdate', 'arcade.gameOver',
  ]);
  for (const event of events) {
    const parsed = parseInboundMessage(event, { expectedGameId: manifest.id });
    assert.equal(parsed.valid, true, `${event.type}: ${parsed.errors.join('; ')}`);
  }
});
