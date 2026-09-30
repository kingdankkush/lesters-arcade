// Private presentation resources only. Collision, navigation and rules stay resident.
import {createWorldDesignSpatialIndex} from '../world-design-spatial.mjs';
import {worldToScreen} from '../world-space.mjs';

export function createGreyboxPropResidency({catalog,create,destroy,setVisible}={}){
  if(!Array.isArray(catalog)||[create,destroy,setVisible].some(fn=>typeof fn!=='function'))throw TypeError('prop catalog and lifecycle callbacks required');
  const ids=new Set();
  const records=catalog.map((record,ordinal)=>{
    const b=record?.bounds;
    if(typeof record?.id!=='string'||!record.id||ids.has(record.id))throw TypeError('unique prop catalog id required');
    if(!b||!['left','right','top','bottom'].every(key=>Number.isFinite(b[key]))||b.left>b.right||b.top>b.bottom)throw TypeError('finite prop bounds required');
    if(record.areaId!==null&&record.areaId!==undefined&&(typeof record.areaId!=='string'||!record.areaId))throw TypeError('prop area id required');
    ids.add(record.id);return Object.freeze({id:record.id,areaId:record.areaId??null,ordinal,bounds:Object.freeze({left:b.left,right:b.right,top:b.top,bottom:b.bottom})});
  });
  const index=createWorldDesignSpatialIndex(records.map(record=>record.bounds));
  const owned=new Map(),visible=new Set();let disposed=false,createdCount=0,destroyedCount=0,peakCount=0;
  function release(ordinal){
    const resource=owned.get(ordinal);destroy(resource);
    // Keep ownership charged if destruction throws. A later disposal retries
    // only the still-owned resource; already released displays never retry.
    owned.delete(ordinal);visible.delete(ordinal);destroyedCount++;
  }
  function dispose(){
    disposed=true;const errors=[];
    for(const ordinal of [...owned.keys()])try{release(ordinal);}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,errors.map(error=>String(error?.message??error)).join('; '));
  }
  function update({camera,view}={}){
    if(disposed)throw Error('prop residency disposed');
    if(!camera||!view||![camera.x,camera.y,camera.zoom,camera.groundZ??0,camera.shakeX??0,camera.shakeY??0,view.width,view.height].every(Number.isFinite)||camera.zoom<=0||view.width<=0||view.height<=0)throw TypeError('finite camera/view projection required');
    const origin=worldToScreen({x:0,y:0,z:0},{...camera,shakeX:camera.shakeX??0,shakeY:camera.shakeY??0},view);
    const rectangle=margin=>({left:(-origin.x-margin*view.width)/camera.zoom,right:(view.width-origin.x+margin*view.width)/camera.zoom,
      top:(-origin.y-margin*view.height)/camera.zoom,bottom:(view.height-origin.y+margin*view.height)/camera.zoom});
    const exact=rectangle(0),acquire=rectangle(.5),retain=rectangle(1);
    if(!Object.values(retain).every(Number.isFinite))throw TypeError('finite projected bounds required');
    const retained=new Set(index.query(retain));
    for(const ordinal of [...owned.keys()])if(!retained.has(ordinal))release(ordinal);
    for(const ordinal of index.query(acquire))if(!owned.has(ordinal)){
      const resource=create(records[ordinal]);owned.set(ordinal,resource);createdCount++;peakCount=Math.max(peakCount,owned.size);
    }
    const onscreen=new Set(index.query(exact));visible.clear();
    for(const [ordinal,resource]of owned){const shown=onscreen.has(ordinal);setVisible(resource,shown);if(shown)visible.add(ordinal);}
    return visible.size;
  }
  const snapshot=()=>Object.freeze({disposed,catalogCount:records.length,liveCount:owned.size,visibleCount:visible.size,peakCount,createdCount,destroyedCount,
    residentIds:Object.freeze([...owned.keys()].map(i=>records[i].id).sort()),visibleIds:Object.freeze([...visible].map(i=>records[i].id).sort()),
    areaIds:Object.freeze([...new Set([...owned.keys()].map(i=>records[i].areaId).filter(Boolean))].sort())});
  return Object.freeze({update,snapshot,dispose});
}
