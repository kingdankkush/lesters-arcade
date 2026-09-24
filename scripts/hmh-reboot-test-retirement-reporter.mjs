// The first lines of a failure's error (its message, then up to two causes),
// so a gate failure on a remote build machine says why a test failed, not only
// which one. Truncated so one noisy assertion cannot flood the build log.
export function summarizeTestError(error, limit = 1200) {
  if (!error) return undefined;
  const parts = [];
  let current = error;
  for (let depth = 0; current && depth < 3; depth += 1) {
    const text = String(current.message ?? current).trim();
    if (text && !parts.includes(text)) parts.push(text);
    current = current.cause;
  }
  const joined = parts.join(' | cause: ');
  return joined.length > limit ? `${joined.slice(0, limit)}…` : joined;
}

export default async function* hmhRebootTestRetirementReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:fail' && event.type !== 'test:summary') continue;
    const data = event.data ?? {};
    yield `${JSON.stringify({
      type: event.type,
      name: data.name,
      file: data.file,
      nesting: data.nesting,
      detailsType: data.details?.type,
      success: data.success,
      counts: data.counts,
      error: event.type === 'test:fail' ? summarizeTestError(data.details?.error) : undefined,
    })}\n`;
  }
}
