import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// This contract applies ONLY to source references excluded from web delivery.
// A pointer never certifies decoded pixels or a self-contained Blender scene.
export function validateSourceReference(bytes, image) {
  assert.match(image.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(image.bytes) && image.bytes > 0);
  assert.ok(Array.isArray(image.dimensions) && image.dimensions.length === 2);
  assert.ok(image.dimensions.every(n => Number.isInteger(n) && n > 0 && n <= 2048));
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    assert.ok(bytes.length >= 24, `${image.path}: truncated PNG`);
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    assert.equal(bytes.length, image.bytes, `${image.path}: byte count mismatch`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256, `${image.path}: SHA mismatch`);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], image.dimensions);
    return 'png';
  }
  const match = bytes.length <= 1024 && /^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\noid sha256:([0-9a-f]{64})\r?\nsize ([1-9][0-9]*)\r?\n$/.exec(bytes.toString('utf8'));
  assert.ok(match, `${image.path}: neither original PNG nor canonical source LFS pointer`);
  assert.equal(match[1], image.sha256, `${image.path}: LFS OID mismatch`);
  assert.equal(match[2], String(image.bytes), `${image.path}: LFS size mismatch`);
  return 'lfs-pointer';
}
