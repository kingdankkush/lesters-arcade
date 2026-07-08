import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();

function loadArtifact(name) {
  return JSON.parse(readFileSync(join(root, 'contracts', 'artifacts', `${name}.json`), 'utf8'));
}

test('WO-118 ArcadePaymentRouter startPaidSession ABI has no caller-controlled token or split config', () => {
  const artifact = loadArtifact('ArcadePaymentRouter');
  const fn = artifact.abi.find((entry) => entry.type === 'function' && entry.name === 'startPaidSession');
  assert.ok(fn, 'startPaidSession function is present');
  const inputNames = fn.inputs.map((input) => input.name);
  const inputTypes = fn.inputs.map((input) => input.type);

  assert.deepEqual(inputNames, ['sessionId', 'gameId', 'amount']);
  assert.equal(inputNames.includes('paymentToken'), false);
  assert.equal(inputNames.includes('split'), false);
  assert.equal(inputTypes.some((type) => type.includes('tuple')), false);
});
