import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_ONE_ENTRIES, selectLevelEntry } from '../apps/hmh-reboot/src/level-entry.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';

test('five entries vary by seed and replay the same start without consuming RNG', () => {
  assert.equal(LEVEL_ONE_ENTRIES.length, 5);
  const counts = new Map();
  for (let seed = 0; seed < 1000; seed++) {
    const entry = selectLevelEntry(seed);
    assert.deepEqual(selectLevelEntry(seed), entry);
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  assert.equal(counts.size, 5);
  for (const count of counts.values()) assert.ok(count > 120 && count < 280);
});

test('each entry and its opening opponents stand on walkable ground with room to leave', () => {
  const queryGround = createLevelOneGroundQuery();
  const body = createCollisionBody({id:'entry-test',radius:24,minZ:0,maxZ:72});
  for (const entry of LEVEL_ONE_ENTRIES) {
    for (const offset of [{x:0,y:0},{x:320,y:0},{x:60,y:-350}]) {
      const point = {x:entry.x+offset.x,y:entry.y+offset.y};
      const ground = queryGround(point.x,point.y);
      assert.equal(ground.walkable,true,`${entry.id} ${JSON.stringify(offset)} is walkable`);
      let exits = 0;
      for (const [x,y] of [[96,0],[-96,0],[0,96],[0,-96]]) {
        const result = resolveSweptCircleMotion({body,start:{...point,z:ground.groundZ},delta:{x,y},blockers:LEVEL_ONE_WORLD.collisionBlockers});
        if (Math.hypot(result.position.x-point.x,result.position.y-point.y)>90) exits++;
      }
      assert.ok(exits>=2,`${entry.id} ${JSON.stringify(offset)} has ${exits} clear exits`);
    }
  }
});
