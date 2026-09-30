// One explicit preview choice; unrelated query parameters never reach the child.
export function stackedJourneySuffix(search='') {
  const values=new URLSearchParams(search).getAll('livingJourney');
  return values.length===1&&values[0]==='living-v1'?'?livingJourney=living-v1':'';
}

// Only these independently validated presentation choices reach the cabinet.
export function stackedPresentationSuffix(search='') {
  const parts=[],journey=stackedJourneySuffix(search);
  if(journey)parts.push(journey.slice(1));
  const values=new URLSearchParams(search).getAll('stackedTutorial');
  if(values.length===1&&values[0]==='tutorial-v1')parts.push('stackedTutorial=tutorial-v1');
  return parts.length?'?'+parts.join('&'):'';
}
