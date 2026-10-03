// One screen-space texture, no filters, pulse, simulation writes or RNG.
// Keep the centre clear and soften the edge instead of painting four bands.
export function lowHealthVignetteAlpha(healthRatio) {
  if (!Number.isFinite(healthRatio) || healthRatio >= .35) return 0;
  return .24 * (1 - Math.max(0, healthRatio) / .35);
}

export function createLowHealthVignette({ SpriteClass, TextureClass, createCanvas } = {}) {
  let display = null, texture = null, disposed = false;
  try {
    const canvas = createCanvas();
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 181);
    for (const [offset, color] of [
      [0, 'rgba(108,8,28,0)'], [.40, 'rgba(108,8,28,0)'],
      [.56, 'rgba(137,12,33,.12)'], [.70, 'rgba(162,18,40,.42)'],
      [.86, 'rgba(174,22,43,.84)'], [1, 'rgba(155,14,34,1)'],
    ]) gradient.addColorStop(offset, color);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    texture = TextureClass.from(canvas);
    display = new SpriteClass(texture);
    display.visible = false;
  } catch {
    display?.destroy();
    texture?.destroy(true);
    display = texture = null;
  }
  return {
    display,
    update({ healthRatio, width, height } = {}) {
      if (disposed || !display) return;
      display.alpha = lowHealthVignetteAlpha(healthRatio);
      display.visible = display.alpha > 0 && width > 0 && height > 0;
      if (display.visible) { display.width = width; display.height = height; }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      display?.destroy();
      texture?.destroy(true);
    },
  };
}
