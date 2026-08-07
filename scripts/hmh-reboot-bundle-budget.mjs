const DEFAULT_HMH_INITIAL_JS_CAP = 1_050_000;

function safeByteCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

export function assertHmhInitialJsBudget({
  entryBytes,
  vendorBytes,
  cap = DEFAULT_HMH_INITIAL_JS_CAP,
} = {}) {
  const entry = safeByteCount(entryBytes, 'entryBytes');
  const vendor = safeByteCount(vendorBytes, 'vendorBytes');
  const limit = safeByteCount(cap, 'cap');
  const combinedInitialChildBytes = entry + vendor;
  const remaining = limit - combinedInitialChildBytes;

  if (remaining < 0) {
    throw new RangeError(
      `HMH initial JS exceeds raw aggregate cap: ${combinedInitialChildBytes.toLocaleString('en-US')} > ${limit.toLocaleString('en-US')}`,
    );
  }

  return Object.freeze({
    cap: limit,
    combinedInitialChildBytes,
    entryBytes: entry,
    remaining,
    vendorBytes: vendor,
  });
}
