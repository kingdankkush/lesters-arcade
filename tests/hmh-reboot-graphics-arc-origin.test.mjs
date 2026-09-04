import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Pixi 8 Graphics.arc() connects from the path's current point. After clear()
// and fill() calls that point is the origin, so an arc without a leading
// moveTo() draws a stray line from (0,0) to the arc start — the fan of green
// lines seen over the hashwood thickets in production through Cycle 072.
const FILES = ['apps/hmh-reboot/src/world-production-art.mjs', 'apps/hmh-reboot/src/main.mjs', 'apps/hmh-reboot/src/grenade-feedback.mjs', 'apps/hmh-reboot/src/weapon-vfx.mjs'];

test('every Graphics arc() is chained directly from a moveTo() in the same statement', () => {
  for (const file of FILES) {
    let source;
    try { source = readFileSync(file, 'utf8'); } catch { continue; }
    const arcs = (source.match(/\.arc\(/g) ?? []).length;
    // A moveTo(...) whose argument list may nest one level of parentheses, chained straight into .arc(
    const anchored = (source.match(/moveTo\((?:[^()]|\([^()]*\))*\)\s*\.arc\(/g) ?? []).length;
    assert.equal(anchored, arcs, `${file}: ${arcs - anchored} arc() call(s) without a leading moveTo()`);
  }
});
