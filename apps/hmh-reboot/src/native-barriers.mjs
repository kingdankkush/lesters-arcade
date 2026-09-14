const ROOT='/assets/generated/hmh-barriers/';
const HASH=/^[a-f0-9]{64}$/;
const KINDS=['stone-wall','concrete-wall','concrete-barrier','wood-fence','steel-fence','rock-formation','boulders'];

export function createNativeBarrierAppearance(metadata,texture,tier='desktop') {
  const page=metadata?.tiers?.[tier],frames=page?.frames,assets=new Map();
  if(metadata?.schema!=='hmh-barriers/v1'||!HASH.test(metadata.sourceSha256)||metadata.frames?.length!==28||!metadata.frames.every(f=>f.nativeABPixelExact===true&&HASH.test(f.nativeRgbaSha256))
    ||!page||!HASH.test(page.sha256)||frames?.length!==28||page.width>2048||page.height>2048
    ||texture?.source?.pixelWidth!==page.width||texture?.source?.pixelHeight!==page.height)throw new TypeError('Native barrier page or provenance invalid');
  const size=tier==='mobile'?128:256;
  for(const [i,frame]of frames.entries()) {
    const expected=`hmh-barrier-${KINDS[Math.floor(i/4)]}-${i%4}`,r=frame.frame;
    if(frame.assetId!==expected||r?.x!==i%4*size||r.y!==Math.floor(i/4)*size||r.w!==size||r.h!==size
      ||frame.runtimeScale!==8/size||Math.abs(frame.projectionY-Math.SQRT2)>1e-6||![frame.anchor?.x,frame.anchor?.y].every(v=>Number.isFinite(v)&&v>0&&v<1))throw new TypeError('Native barrier frame invalid');
    assets.set(expected,{sourceAssetId:expected,texture,frame:{...frame,category:'environment'}});
  }
  return assets;
}
export async function loadNativeBarrierAppearance(loadTexture,{mobile=false,fetchImpl=fetch}={}) {
  const response=await fetchImpl(ROOT+'manifest.json',{credentials:'same-origin'});
  if(!response.ok)throw new Error('Native barrier metadata unavailable');
  const metadata=await response.json(),tier=mobile?'mobile':'desktop';
  const page=metadata.tiers?.[tier];
  if(page?.image!==`barriers-${tier}.webp`)throw new TypeError('Native barrier URL invalid');
  return createNativeBarrierAppearance(metadata,await loadTexture(ROOT+page.image),tier);
}
function kindFor(b) {
  if(b.id.startsWith('world-perimeter-')||b.shape.type!=='capsule')return null;
  if(b.id==='ravine-boulder-choke')return 'boulders';
  if(b.visualKind==='cliff')return 'rock-formation';
  if(b.visualKind==='bridge-rail')return b.id.startsWith('crossing-footbridge-')?null:'steel-fence';
  if(b.visualKind!=='fence')return null;
  if(b.id.endsWith('-gate'))return 'steel-fence';
  if(b.id==='relay-orientation-fence'||b.id.startsWith('ravine-salvage'))return 'stone-wall';
  if(b.districtId==='frontier-relay'||b.id==='crossing-east-bank-fence')return 'wood-fence';
  if(b.id.includes('yard-fence')||b.id==='crossing-west-groyne'||b.id==='yard-service-north')return 'concrete-wall';
  if(b.districtId==='mining-camp'||b.id.startsWith('yard-service'))return 'concrete-barrier';
  return 'steel-fence';
}
export function buildNativeBarrierPlacements(world,assets) {
  const placements=[],blockerIds=new Set();
  for(const b of world.blockers) {
    const kind=kindFor(b);if(!kind)continue;
    const {a,b:end,radius}=b.shape,dx=end.x-a.x,dy=end.y-a.y,length=Math.hypot(dx,dy);
    const angle=(Math.atan2(dy,dx)+Math.PI)%Math.PI,direction=kind==='boulders'?0:Math.round(angle/(Math.PI/4))%4;
    const nativeAngle=kind==='boulders'?Math.atan2(1,4):direction*Math.PI/4;
    if(Math.abs(Math.sin(angle-nativeAngle))>1e-6||length<2*radius)continue;
    const assetId=`hmh-barrier-${kind}-${direction}`;if(!assets.has(assetId))continue;
    const count=Math.max(2,Math.ceil((length+2*radius)/(3.68*radius)));
    if(placements.length+count>512)throw new RangeError('Native barrier placement budget exceeded');
    for(let i=0;i<count;i++){
      const t=(radius+(length-2*radius)*i/(count-1))/length;
      placements.push(Object.freeze({id:`native-barrier:${b.id}:${i}`,collisionBlockerId:b.id,assetId,x:a.x+dx*t,y:a.y+dy*t,scale:radius,category:'environment'}));
    }
    blockerIds.add(b.id);
  }
  return {placements:Object.freeze(placements),blockerIds};
}
export function hiddenNativeBarriers(placements,openGates) {
  return openGates.size?placements.filter(p=>openGates.has(p.collisionBlockerId)).map(p=>p.id):[];
}
