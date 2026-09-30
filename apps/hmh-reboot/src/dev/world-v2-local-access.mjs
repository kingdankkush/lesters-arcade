// Pre-import gate for an explicitly unofficial, private world inspection page.
export function readWorldV2LocalAccess({ url, topLevel = false } = {}) {
  const result = (allowed, reason) => Object.freeze({ allowed, reason, officialRun: false, rankedEligible: false });
  let parsed;
  try { parsed = new URL(url); } catch { return result(false, 'invalid-url'); }
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) return result(false, 'loopback-only');
  if (topLevel !== true) return result(false, 'top-level-only');
  if (parsed.username || parsed.password || parsed.hash || parsed.pathname !== '/dist/hmh-world-v2-local/index.html') return result(false, 'private-entry-required');
  const fields = [...parsed.searchParams.keys()];
  const exact = fields.length === 2 && new Set(fields).size === 2
    && fields.every(key => key === 'mode' || key === 'world')
    && parsed.searchParams.get('mode') === 'free' && parsed.searchParams.get('world') === 'world-v2-local';
  return result(exact, exact ? 'local-free-test' : 'explicit-local-free-required');
}
