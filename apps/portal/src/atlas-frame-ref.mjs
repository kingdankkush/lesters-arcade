const ATLAS_FRAME_RE = /#frame=(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)$/;

export function parseAtlasFrameRef(ref) {
  if (typeof ref !== 'string') return null;
  const match = ref.match(ATLAS_FRAME_RE);
  if (!match) return null;
  const [x, y, width, height, atlasWidth, atlasHeight] = match.slice(1).map(Number);
  if ([x, y, width, height, atlasWidth, atlasHeight].some((value) => !Number.isFinite(value))) return null;
  if (width <= 0 || height <= 0 || atlasWidth <= 0 || atlasHeight <= 0) return null;
  if (x < 0 || y < 0 || x + width > atlasWidth || y + height > atlasHeight) return null;
  return Object.freeze({
    src: ref.slice(0, match.index),
    x,
    y,
    width,
    height,
    atlasWidth,
    atlasHeight,
  });
}

export function assetSrcForFrameRef(ref) {
  return parseAtlasFrameRef(ref)?.src ?? ref;
}

export function isAtlasFrameRef(ref) {
  return Boolean(parseAtlasFrameRef(ref));
}
