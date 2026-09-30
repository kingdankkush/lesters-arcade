export function localVersusAllowed(search, topLevel) {
  if (typeof search !== 'string' || topLevel !== true) return false;
  const query = new URLSearchParams(search);
  return [...query.keys()].every(key => key === 'stackedLocal' || key === 'mode')
    && query.getAll('stackedLocal').length === 1 && query.get('stackedLocal') === 'local-v1'
    && query.getAll('mode').length === 1 && query.get('mode') === 'free';
}
