// Only cosmetic experiment options cross into the embedded cabinet.
const exact=(params,key,value)=>params.getAll(key).length===1&&params.get(key)===value;
export function chikunPresentationSuffix(search='') {
 const params=new URLSearchParams(search),out=new URLSearchParams();
 if(exact(params,'coinFeedback','positive-v1'))out.set('coinFeedback','positive-v1');
 if(exact(params,'obstacleLoops','eagle-v1')){
  out.set('obstacleLoops','eagle-v1');
  if(params.getAll('obstacleQuality').length===1&&['low','medium','high'].includes(params.get('obstacleQuality')))out.set('obstacleQuality',params.get('obstacleQuality'));
 }
 return out.size?'?'+out.toString():'';
}
export function chikunObstaclePresentationOptions(search='',density=1) {
 const params=new URLSearchParams(chikunPresentationSuffix(search));
 return Object.freeze({enabled:exact(params,'obstacleLoops','eagle-v1'),tier:params.get('obstacleQuality')??(Number.isFinite(density)&&density>=3?'high':Number.isFinite(density)&&density>=2?'medium':'low')});
}
