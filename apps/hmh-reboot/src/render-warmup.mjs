// Perf step 8: hidden render warm-up (lazy; main.mjs imports it after boot).
//
// WebGL uploads a texture and links a blend pipeline the first time something
// draws with it. Without a warm-up that cost lands on the frame where the
// first gas bomber walks on screen or the first additive muzzle glow fires.
// warmRenderer draws one tiny sprite per texture, in a normal and an additive
// layer, into a throwaway render texture `frames` times, then frees it. The
// target is offscreen, so the player never sees it; nothing here touches the
// stage, the simulation or any pool.

export const WARMUP_FRAMES = 2;

export function warmRenderer({ renderer, ContainerClass, SpriteClass, textures = [], frames = WARMUP_FRAMES } = {}) {
  const unique = [...new Set(textures)].filter((texture) => texture && !texture.destroyed);
  if (!unique.length || typeof renderer?.generateTexture !== 'function') return 0;
  const root = new ContainerClass();
  root.label = 'hmh-render-warmup';
  for (const blendMode of ['normal', 'add']) {
    const layer = new ContainerClass();
    layer.blendMode = blendMode;
    unique.forEach((texture, index) => {
      const sprite = new SpriteClass({ texture });
      sprite.width = 4;
      sprite.height = 4;
      sprite.position.set((index % 16) * 4, Math.floor(index / 16) * 4);
      layer.addChild(sprite);
    });
    root.addChild(layer);
  }
  try {
    for (let frame = 0; frame < frames; frame += 1) renderer.generateTexture({ target: root, resolution: 1 }).destroy(true);
  } finally {
    // Sprites only: the textures belong to their atlases and pools.
    root.destroy({ children: true });
  }
  return unique.length;
}
