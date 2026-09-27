// Lazy chunk of share-links.mjs (plan docs/handoffs/free-share-20260926.md
// §10.3): the Free share card as a File for the Web Share API, so a phone
// can post the image itself. The card is fetched same-origin (the children's
// connect-src is 'self'); every failure is null and the caller shares text
// and URL instead.
export const SHARE_CARD_MAX_BYTES = 2_000_000;

// Whether this browser can share an image file at all.
export function canShareFiles(navigatorRef = globalThis.navigator) {
  try {
    const probe = new File([new Uint8Array([0x89])], 'probe.png', { type: 'image/png' });
    return typeof navigatorRef?.canShare === 'function' && navigatorRef.canShare({ files: [probe] }) === true;
  } catch {
    return false;
  }
}

export async function fetchShareCardFile(cardPath, { fetchImpl = globalThis.fetch, timeoutMs = 4_000, name = 'lesters-arcade-free-run.png' } = {}) {
  if (typeof cardPath !== 'string' || !cardPath.startsWith('/api/free-card/') || typeof fetchImpl !== 'function') return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetchImpl(cardPath, { signal: controller?.signal, credentials: 'omit' });
    if (!response?.ok) return null;
    const blob = await response.blob();
    if (blob?.type !== 'image/png' || !(blob.size > 0) || blob.size > SHARE_CARD_MAX_BYTES) return null;
    return new File([blob], name, { type: 'image/png' });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
