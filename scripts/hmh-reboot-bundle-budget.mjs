const DEFAULT_HMH_INITIAL_JS_CAP = 1_050_000;

function safeByteCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

/**
 * The child's initial JS budget.
 *
 * Two totals are reported and BOTH are capped:
 *   combinedInitialChildBytes        = entry + vendor (the Cycle 05x definition)
 *   initialChildBytesWithSharedChunks = entry + vendor + every chunk game.js
 *                                       imports statically
 * Cycle 074 added the second one after measuring that dist/hmh-reboot/game.js
 * statically imported 64,526 bytes of hoisted shared chunks (portal-shared
 * sdk/audio/progression modules) that loaded on the same initial path and
 * never reached the gate. Counting them closes the loophole where code that
 * moved into any portal-shared module vanished from the budget.
 */
export function assertHmhInitialJsBudget({
  entryBytes,
  vendorBytes,
  sharedChunkBytes = 0,
  cap = DEFAULT_HMH_INITIAL_JS_CAP,
} = {}) {
  const entry = safeByteCount(entryBytes, 'entryBytes');
  const vendor = safeByteCount(vendorBytes, 'vendorBytes');
  const shared = safeByteCount(sharedChunkBytes, 'sharedChunkBytes');
  const limit = safeByteCount(cap, 'cap');
  const combinedInitialChildBytes = entry + vendor;
  const initialChildBytesWithSharedChunks = combinedInitialChildBytes + shared;
  const remaining = limit - combinedInitialChildBytes;
  const remainingWithSharedChunks = limit - initialChildBytesWithSharedChunks;

  if (remaining < 0) {
    throw new RangeError(
      `HMH initial JS exceeds raw aggregate cap: ${combinedInitialChildBytes.toLocaleString('en-US')} > ${limit.toLocaleString('en-US')}`,
    );
  }
  if (remainingWithSharedChunks < 0) {
    throw new RangeError(
      `HMH initial JS including shared chunks exceeds raw aggregate cap: ${initialChildBytesWithSharedChunks.toLocaleString('en-US')} > ${limit.toLocaleString('en-US')}`,
    );
  }

  return Object.freeze({
    cap: limit,
    combinedInitialChildBytes,
    entryBytes: entry,
    initialChildBytesWithSharedChunks,
    remaining,
    remainingWithSharedChunks,
    sharedChunkBytes: shared,
    vendorBytes: vendor,
  });
}

/**
 * Walk an esbuild metafile from `entryOutput` and sum every output it reaches
 * through static `import` statements (transitively), skipping externals and
 * dynamic `import()` chunks. Those static chunks are fetched before the entry
 * can execute, so they are initial JS whatever their file name says.
 */
export function sumStaticChunkBytes({ metafile, entryOutput } = {}) {
  const outputs = metafile?.outputs;
  if (!outputs || typeof outputs !== 'object') throw new TypeError('metafile.outputs is required');
  if (typeof entryOutput !== 'string' || !Object.hasOwn(outputs, entryOutput)) {
    throw new Error(`entry output ${entryOutput} is not in the metafile`);
  }
  const visited = new Set([entryOutput]);
  const chunks = [];
  const stack = [entryOutput];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const imported of outputs[current].imports ?? []) {
      if (imported.external || imported.kind !== 'import-statement') continue;
      if (visited.has(imported.path)) continue;
      visited.add(imported.path);
      const target = outputs[imported.path];
      if (!target) throw new Error(`static import ${imported.path} of ${current} is not in the metafile`);
      chunks.push(Object.freeze({ path: imported.path, bytes: safeByteCount(target.bytes, `${imported.path} bytes`) }));
      stack.push(imported.path);
    }
  }
  chunks.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return Object.freeze({
    bytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
    chunks: Object.freeze(chunks),
  });
}
