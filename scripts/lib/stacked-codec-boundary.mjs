// Diagnostic authoring helper only. It is never imported by a cabinet or server.
import { createHash } from 'node:crypto';
import { encodeSic1 } from '../../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS } from '../../apps/portal/src/stacked-contracts.mjs';

export function canonicalSic1ByteBound(totalTicks) {
  if (!Number.isInteger(totalTicks) || totalTicks < 0 || totalTicks > STACKED_MAX_TICKS) throw new RangeError('invalid diagnostic total ticks');
  let terminatorDigits = 1;
  for (let value = totalTicks; value >= 128; value = Math.floor(value / 128)) terminatorDigits += 1;
  // Compact changes take one byte. Escapes take 2+varint(gap-1) bytes,
  // which is <=3*gap for every positive legal gap. Gaps are disjoint and
  // sum to <=totalTicks. Include the real 24-byte header and terminator.
  return 3 * totalTicks + 24 + 1 + terminatorDigits;
}

export function makeMaximalCodecBoundary() {
  const seed = 7;
  const transitions = Array.from({ length:STACKED_MAX_TICKS }, (_, index) => ({ tick:index+1, mask:index%2===0?3:0 }));
  const bytes = encodeSic1({ seed, totalTicks:STACKED_MAX_TICKS, transitions });
  if (bytes.length !== canonicalSic1ByteBound(STACKED_MAX_TICKS)) throw new Error('actual codec does not attain the diagnostic bound');
  return {
    kind:'canonical-codec-boundary-not-surviving-run', seed, bytes,
    sha256:createHash('sha256').update(bytes).digest('hex'),
    evidence:{ encoding:'stacked-sic1+base64', sic1:Buffer.from(bytes).toString('base64'), startLevel:1 },
  };
}
