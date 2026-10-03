import { ACTOR3D_LOW_ASSETS } from './actor-3d-texture-tiers.mjs';
const RAW_CAP = 16_777_216;
const isGlb = bytes => bytes.length >= 12 && new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,true) === 0x46546c67;

async function boundedBytes(source, cap, signal) {
  const stream = source.body ?? source;
  if (!stream?.getReader) {
    signal?.throwIfAborted();
    const bytes = new Uint8Array(await source.arrayBuffer());
    signal?.throwIfAborted();
    if (!bytes.length || bytes.length > cap) throw new Error('actor download bounds');
    return bytes;
  }
  const reader = stream.getReader(), parts = []; let length = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const {value,done} = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > cap) throw new Error('actor download bounds');
      parts.push(value);
    }
    if (!length) throw new Error('empty actor download');
    const bytes = new Uint8Array(length); let offset = 0;
    for (const part of parts) { bytes.set(part,offset); offset += part.byteLength; }
    return bytes;
  } catch (error) { try { await reader.cancel(); } catch {} throw error; }
  finally { reader.releaseLock(); }
}

// Reads bounded compressed OR already HTTP-decoded GLB bytes. The classic
// asset remains the compatibility fallback; unsupported gzip never gets fetched.
export async function loadActor3dBytes(id, {qualityTier,fetchAsset=fetch,signal,
  Decompress=globalThis.DecompressionStream, registry=ACTOR3D_LOW_ASSETS} = {}) {
  const tier = qualityTier === 'low' ? registry[id] : null;
  if (tier && typeof Decompress === 'function') {
    try {
      const response = await fetchAsset(`/assets/generated/hmh-actor-3d-pilot/low/${tier.file}`, {signal});
      if (!response.ok) throw new Error('low actor unavailable');
      let bytes = await boundedBytes(response,Math.max(tier.glbBytes,tier.compressedBytes),signal);
      if (!isGlb(bytes)) {
        if (bytes.length !== tier.compressedBytes || bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error('invalid compressed actor');
        bytes = await boundedBytes(new Blob([bytes]).stream().pipeThrough(new Decompress('gzip')),tier.glbBytes,signal);
      }
      if (bytes.length !== tier.glbBytes || !isGlb(bytes)) throw new Error('low actor ledger drift');
      return bytes.buffer;
    } catch (error) { signal?.throwIfAborted(); }
  }
  const response = await fetchAsset(`/assets/generated/hmh-actor-3d-pilot/${id}.glb`, {signal});
  if (!response.ok) throw new Error('actor asset unavailable');
  return (await boundedBytes(response,RAW_CAP,signal)).buffer;
}
