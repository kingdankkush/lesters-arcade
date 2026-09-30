// One explicit preview choice; unrelated query parameters never reach the child.
export function stackedJourneySuffix(search='') {
  const values=new URLSearchParams(search).getAll('livingJourney');
  return values.length===1&&values[0]==='living-v1'?'?livingJourney=living-v1':'';
}
