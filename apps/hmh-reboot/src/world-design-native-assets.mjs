export const WORLD_DESIGN_METADATA_URL = '/assets/generated/hmh-world-design/world-design.json';
const HASH=/^[a-f0-9]{64}$/;
const positive=n=>Number.isFinite(n)&&n>0;
const fail=message=>{throw new TypeError(`Native world design: ${message}`);};

export function resolveWorldDesignSprite({frame,placement,groundZ,zoom}) {
  return {
    groundZ:Number.isFinite(placement.groundZ)?placement.groundZ:groundZ,
    scaleX:frame.runtimeScale*(placement.scale??1)*zoom,
    scaleY:frame.runtimeScale*(placement.scale??1)*zoom*(frame.projectionY??1),
  };
}
export function createWorldDesignAppearance(metadata,textures,{tier='desktop'}={}) {
  if(metadata?.pipeline!=='hmh-world-design/v1'||!Array.isArray(metadata.frames)||metadata.frames.length!==17) fail('complete source roster required');
  const pages=metadata.tiers?.[tier]?.pages;
  if(!Array.isArray(pages)||pages.length!==1||textures.length!==pages.length) fail('page budget exceeded');
  for(const [i,page] of pages.entries()) {
    if(!/^[a-z0-9-]+\.webp$/.test(page.image)||!HASH.test(page.sha256)||!HASH.test(page.decodedRgbaSha256)||page.lossless!==true) fail('page provenance missing');
    if(page.width>2048||page.height>2048||!positive(page.width)||!positive(page.height)) fail('page size invalid');
    const source=textures[i]?.source;
    if(!source||(source.pixelWidth??source.width)!==page.width||(source.pixelHeight??source.height)!==page.height) fail('decoded texture size mismatch');
  }
  const assets=new Map(),rectangles=[];
  for(const source of metadata.frames) {
    const frame=source.tiers?.[tier], r=frame?.frame;
    if(!/^hmh-(ld2|cx3)-[a-z0-9-]+$/.test(source.assetId)||assets.has(source.assetId)||!HASH.test(source.sourceModelSha256)||!HASH.test(source.nativeFrameSha256A)||!HASH.test(source.nativeFrameSha256B)||source.nativeABPixelExact!==true) fail('source identity invalid');
    if(!r||![r.x,r.y,r.w,r.h].every(Number.isInteger)||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>pages[0].width||r.y+r.h>pages[0].height) fail('frame outside page');
    if(rectangles.some(p=>r.x<p.x+p.w&&r.x+r.w>p.x&&r.y<p.y+p.h&&r.y+r.h>p.y)) fail('overlapping frames');
    rectangles.push(r);
    if(!positive(frame.runtimeScale)||Math.abs(frame.projectionY-Math.SQRT2)>1e-6||![frame.anchor?.x,frame.anchor?.y].every(value=>Number.isFinite(value)&&value>=0&&value<=1)) fail('projection or anchor invalid');
    assets.set(source.assetId,{sourceAssetId:source.assetId,texture:textures[0],frame:{...frame,assetId:source.assetId,category:'environment'}});
  }
  return assets;
}
export async function loadWorldDesignAppearance(loadTexture,{mobile=false,fetchImpl=fetch}={}) {
  const response=await fetchImpl(WORLD_DESIGN_METADATA_URL,{credentials:'same-origin'});
  if(!response.ok) fail(`metadata HTTP ${response.status}`);
  const metadata=await response.json(),tier=mobile?'mobile':'desktop';
  const pages=metadata.tiers?.[tier]?.pages;
  if(!pages||pages.length!==1||pages.some(p=>!/^[a-z0-9-]+\.webp$/.test(p.image))) fail('page URL invalid');
  const textures=await Promise.all(pages.map(p=>loadTexture(`/assets/generated/hmh-world-design/${p.image}`)));
  return createWorldDesignAppearance(metadata,textures,{tier});
}
