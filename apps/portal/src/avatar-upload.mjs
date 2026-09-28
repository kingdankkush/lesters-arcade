// Custom avatar preparation in the browser (1.9.3, api/avatar.mjs).
//
// Loaded on demand by the hosted Profile page's name & avatar editor (never
// by the HMH game or the portal's first paint). A picked JPG or PNG is
// checked (type, at most 5 MB) before a single byte is read, decoded,
// center-cropped to a square and drawn on a 256×256 canvas, then exported as
// WebP. Browsers that cannot encode WebP (Safari) export JPEG instead, which
// the server also accepts and which stays well under the 96 KB cap where a
// 256 px PNG photo would not. Re-encoding through the canvas keeps only the
// pixels: EXIF (GPS, camera, orientation) and every other metadata block is
// dropped. The server re-checks everything (server/profile/avatar-image.mjs).

export const AVATAR_UPLOAD_RULES = Object.freeze({
  acceptedTypes: Object.freeze(['image/jpeg', 'image/png']),
  accept: 'image/jpeg,image/png',
  maxFileBytes: 5 * 1024 * 1024,
  side: 256,
  maxUploadBytes: 96 * 1024,
  qualities: Object.freeze([0.86, 0.72, 0.56, 0.4]),
});

export const AVATAR_UPLOAD_COPY = Object.freeze({
  type: 'Choose a JPG or PNG picture.',
  size: 'That picture is over 5 MB. Choose a smaller one.',
  decode: 'That file could not be read as a picture. Try another JPG or PNG.',
  encode: 'This browser could not prepare the picture. Try another browser.',
  tooLarge: 'That picture is too detailed to save. Try a simpler one.',
});

// { ok: true } or { ok: false, message } from the File's type and size only.
export function checkAvatarFile(file) {
  if (!file || !AVATAR_UPLOAD_RULES.acceptedTypes.includes(String(file.type ?? '').toLowerCase())) return { ok: false, message: AVATAR_UPLOAD_COPY.type };
  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0 || size > AVATAR_UPLOAD_RULES.maxFileBytes) return { ok: false, message: AVATAR_UPLOAD_COPY.size };
  return { ok: true };
}

// The centered square of a width × height picture: { sx, sy, side }.
export function centerSquareCrop(width, height) {
  const w = Math.max(0, Math.floor(Number(width) || 0));
  const h = Math.max(0, Math.floor(Number(height) || 0));
  const side = Math.min(w, h);
  return { sx: Math.floor((w - side) / 2), sy: Math.floor((h - side) / 2), side };
}

// Base64 of an ArrayBuffer, in chunks (no spread of a 96 KB array).
export function bytesToBase64(buffer, btoaImpl = globalThis.btoa) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
  }
  return btoaImpl(binary);
}

async function decode(file, { createImageBitmapImpl, ImageClass, urlApi }) {
  if (typeof createImageBitmapImpl === 'function') {
    try {
      const bitmap = await createImageBitmapImpl(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
    } catch { /* fall back to <img> */ }
  }
  if (typeof ImageClass !== 'function' || !urlApi?.createObjectURL) throw new Error('decode');
  const url = urlApi.createObjectURL(file);
  try {
    const image = new ImageClass();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('decode'));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => {} };
  } finally {
    urlApi.revokeObjectURL?.(url);
  }
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => {
  try { canvas.toBlob((blob) => resolve(blob ?? null), type, quality); } catch { resolve(null); }
});

// File → { ok: true, base64, type, bytes, previewUrl } or { ok: false, message }.
export async function prepareAvatarUpload(file, {
  documentRef = globalThis.document,
  createImageBitmapImpl = globalThis.createImageBitmap,
  ImageClass = globalThis.Image,
  urlApi = globalThis.URL,
  btoaImpl = globalThis.btoa,
} = {}) {
  const checked = checkAvatarFile(file);
  if (!checked.ok) return checked;
  let decoded;
  try {
    decoded = await decode(file, { createImageBitmapImpl, ImageClass, urlApi });
  } catch {
    return { ok: false, message: AVATAR_UPLOAD_COPY.decode };
  }
  try {
    const { sx, sy, side } = centerSquareCrop(decoded.width, decoded.height);
    if (side < 1) return { ok: false, message: AVATAR_UPLOAD_COPY.decode };
    const canvas = documentRef.createElement('canvas');
    canvas.width = AVATAR_UPLOAD_RULES.side;
    canvas.height = AVATAR_UPLOAD_RULES.side;
    const context = canvas.getContext('2d');
    if (!context) return { ok: false, message: AVATAR_UPLOAD_COPY.encode };
    // A dark backdrop, so a transparent PNG does not turn black in JPEG.
    context.fillStyle = '#10131c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    let format = 'image/webp';
    for (const quality of AVATAR_UPLOAD_RULES.qualities) {
      let blob = await toBlob(canvas, format, quality);
      // No WebP encoder (the browser returns PNG or nothing): use JPEG.
      if (format === 'image/webp' && blob?.type !== 'image/webp') {
        format = 'image/jpeg';
        blob = await toBlob(canvas, format, quality);
      }
      if (!blob || blob.type !== format) return { ok: false, message: AVATAR_UPLOAD_COPY.encode };
      if (blob.size <= AVATAR_UPLOAD_RULES.maxUploadBytes) {
        const buffer = await blob.arrayBuffer();
        return { ok: true, type: format, bytes: blob.size, base64: bytesToBase64(buffer, btoaImpl), previewUrl: urlApi?.createObjectURL ? urlApi.createObjectURL(blob) : null };
      }
    }
    return { ok: false, message: AVATAR_UPLOAD_COPY.tooLarge };
  } catch {
    return { ok: false, message: AVATAR_UPLOAD_COPY.encode };
  } finally {
    decoded.release();
  }
}
