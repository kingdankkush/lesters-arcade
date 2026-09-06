import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as intake from './shared/validate-lfs-pointer.mjs';
const ledger = JSON.parse(readFileSync(new URL('../apps/hmh-reboot/assets/source/reference/heroes/references.json', import.meta.url)));
const image = ledger.heroes[0].images.front;
const pointer = (oid = image.sha256, size = image.bytes) => Buffer.from(`version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${size}\n`);

test('source-only reference validator accepts exact manifest-bound LFS bytes', () => {
  assert.equal(typeof intake.validateSourceReference, 'function');
  assert.equal(intake.validateSourceReference(pointer(), image), 'lfs-pointer');
  assert.equal(intake.validateSourceReference(Buffer.from(pointer().toString().replaceAll('\n', '\r\n')), image), 'lfs-pointer');
});

test('source-only reference validator rejects truncated, forged and malformed pointers', () => {
  assert.equal(typeof intake.validateSourceReference, 'function');
  for (const bytes of [pointer('a'.repeat(64)), pointer(image.sha256, image.bytes + 1), pointer('abc'), pointer(image.sha256, '1e6'), pointer(image.sha256, -1), pointer().subarray(0, 70), Buffer.concat([pointer(), Buffer.from('garbage\n')]), Buffer.alloc(0)]) {
    assert.throws(() => intake.validateSourceReference(bytes, image));
  }
});

test('source reference reads verify either original PNG identity or its exact source-only pointer', () => {
  assert.equal(typeof intake.validateSourceReference, 'function');
  const bytes = readFileSync(new URL(`../${image.path}`, import.meta.url));
  assert.ok(['png', 'lfs-pointer'].includes(intake.validateSourceReference(bytes, image)));
  assert.throws(() => intake.validateSourceReference(bytes, {...image, sha256: 'f'.repeat(64)}));
  assert.throws(() => intake.validateSourceReference(bytes, {...image, bytes: image.bytes + 1}));
  assert.throws(() => intake.validateSourceReference(bytes, {...image, dimensions: [0, 0]}));
});
