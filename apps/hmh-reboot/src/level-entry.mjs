// A separate seed hash keeps entry choice reproducible without consuming the
// combat RNG. New ordinary sessions receive new seeds from the parent.
export const LEVEL_ONE_ENTRIES = Object.freeze([
  Object.freeze({id:'relay',name:'Frontier Relay',x:800,y:2400}),
  Object.freeze({id:'ravine',name:'Ravine Approach',x:2100,y:2300}),
  Object.freeze({id:'hashwood',name:'Hashwood Clearing',x:6900,y:2250}),
  Object.freeze({id:'mining',name:'Mining Outskirts',x:8250,y:2350}),
  Object.freeze({id:'yard',name:'Yard Approach',x:10400,y:2450}),
]);

export function selectLevelEntry(seed) {
  let hash = 2166136261;
  for (const character of `level-1-entry:${seed}`) hash = Math.imul(hash ^ character.charCodeAt(0),16777619) >>> 0;
  return LEVEL_ONE_ENTRIES[hash % LEVEL_ONE_ENTRIES.length];
}
