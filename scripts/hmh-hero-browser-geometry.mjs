import assert from 'node:assert/strict';

const finite = (values) => assert.ok(values.every(Number.isFinite), 'hero/overlay geometry must be finite');
const positive = (values) => { finite(values); assert.ok(values.every((n) => n > 0), 'hero/overlay dimensions and scale must be positive'); };

/** Conservative visible-body envelope, excluding shadow, weapons and transparent atlas padding. */
export function measureHeroBody(state, framesById) {
  finite([state.actorScreenX, state.actorScreenY]);
  positive([state.actorScreenScale, state.viewportWidth, state.viewportHeight]);
  const body = state.frameIds.map((id) => framesById.get(id)).filter((f) => f && ['lower-body', 'torso-head'].includes(f.layer));
  assert.deepEqual(body.map((f) => f.layer).sort(), ['lower-body', 'torso-head'], 'measure both selected body layers exactly once');
  const bounds = body.map((f) => {
    positive([f.sourceSize.h, f.frame.w, f.frame.h]);
    const scale = 160 / f.sourceSize.h * state.actorScreenScale;
    const x = state.actorScreenX + (f.spriteSourceSize.x + (f.trim?.x ?? 0) - f.sourcePivot.x) * scale;
    const y = state.actorScreenY + (f.spriteSourceSize.y + (f.trim?.y ?? 0) - f.sourcePivot.y) * scale;
    finite([x, y]);
    return { x, y, right: x + f.frame.w * scale, bottom: y + f.frame.h * scale };
  });
  const x = Math.min(...bounds.map((b) => b.x));
  const y = Math.min(...bounds.map((b) => b.y));
  const right = Math.max(...bounds.map((b) => b.right));
  const bottom = Math.max(...bounds.map((b) => b.bottom));
  return { x, y, width: right - x, height: bottom - y, right, bottom, viewportRatio: (bottom - y) / state.viewportHeight };
}

export function assertHeroClearance(body, overlays, viewport) {
  finite([body.x, body.y, body.right, body.bottom, body.viewportRatio]);
  positive([body.width, body.height, viewport.viewportWidth, viewport.viewportHeight]);
  assert.ok(body.viewportRatio >= 0.12, 'hero body is below 12% of viewport');
  assert.ok(body.x >= 0 && body.y >= 0 && body.right <= viewport.viewportWidth && body.bottom <= viewport.viewportHeight, 'hero body is clipped by viewport');
  for (const box of overlays) {
    finite([box.x, box.y, box.width, box.height]);
    assert.ok(box.width >= 0 && box.height >= 0, 'overlay dimensions cannot be negative');
    const overlaps = body.x < box.x + box.width && body.right > box.x && body.y < box.y + box.height && body.bottom > box.y;
    assert.ok(!overlaps, `${box.id ?? 'overlay'} overlaps hero body: ${JSON.stringify({ body, overlay: box })}`);
    // Borders alone miss the cockpit/help shadow and near-touching head outlines.
    // This strengthens, rather than replaces, the zero-overlap body contract.
    const clearance = 12;
    const tooClose = body.x < box.x + box.width + clearance && body.right > box.x - clearance
      && body.y < box.y + box.height + clearance && body.bottom > box.y - clearance;
    assert.ok(!tooClose, `${box.id ?? 'overlay'} lacks 12px clearance from hero body: ${JSON.stringify({ body, overlay: box })}`);
  }
  return body;
}
