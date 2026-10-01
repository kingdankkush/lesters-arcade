// Shared feel module (2.1, upgrade guide §2.9): GPU texture prewarm.
//
// First-use stalls come from uploading on demand: the first frame that draws a
// freshly loaded atlas pays the texImage2D. Pixi's prepare plugin is not in
// the HMH vendor build, so this asks the renderer's texture system to
// initialise (upload) a source directly, once, before the countdown or as soon
// as a late atlas (a boss) finishes loading -- before its first draw. It
// creates no display objects and spawns nothing; a renderer without the hook
// (the headless harness) is a no-op.
export function prewarmTexture(renderer, texture, seen = null) {
  const source = texture?.source;
  if (!source || seen?.has(source)) return false;
  const system = renderer?.texture;
  if (typeof system?.initSource !== 'function') return false;
  try {
    system.initSource(source);
  } catch {
    return false;
  }
  seen?.add(source);
  return true;
}

export function prewarmTextures(renderer, textures, seen = new WeakSet()) {
  let count = 0;
  for (const texture of textures) if (prewarmTexture(renderer, texture, seen)) count += 1;
  return count;
}
