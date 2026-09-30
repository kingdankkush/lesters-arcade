// Completed presentation features are enabled by default. Explicit opt-outs stay
// explicit across the iframe boundary; unrelated parameters never reach it.
export function stackedJourneyEnabled(search='') {
  const values=new URLSearchParams(search).getAll('livingJourney');
  return values.length===0||(values.length===1&&values[0]==='living-v1');
}
export function stackedJourneySuffix(search='') {
  return '?livingJourney='+(stackedJourneyEnabled(search)?'living-v1':'off');
}
export function stackedPresentationSuffix(search='') {
  const values=new URLSearchParams(search).getAll('stackedTutorial');
  const tutorial=values.length===0||(values.length===1&&values[0]==='tutorial-v1');
  return stackedJourneySuffix(search)+'&stackedTutorial='+(tutorial?'tutorial-v1':'off');
}
