import { WORLD_DESIGN_SECRET_PROPS } from '../apps/hmh-reboot/src/world-design-secrets.mjs';
import { WORLD_DESIGN_SITE_PROPS, WORLD_DESIGN_ORCHARD } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { Container, Graphics, RenderLayer, Sprite, Texture, Rectangle } from 'pixi.js';
import { createAuthoredPropDisplay } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { createWorldProductionLayers, renderWorldProductionArt } from '../apps/hmh-reboot/src/world-production-art.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { worldDepthKey } from '../apps/hmh-reboot/src/world-depth.mjs';
import { deterministicUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import { createCorpseClock, corpsePresentation, pruneCorpseCapacity, CORPSE_VISUAL_CAP, CORPSE_LIFETIME_MS } from '../apps/hmh-reboot/src/corpse-presentation.mjs';
import { createWorldDesignAppearance } from '../apps/hmh-reboot/src/world-design-native-assets.mjs';
import { buildWorldDesignPlacements, extendWorldDesignLandmarks } from '../apps/hmh-reboot/src/world-design-layout.mjs';

const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', ecmaVersion: 'latest' });
const all = [];
function walk(node) { if (!node || typeof node !== 'object') return; if (node.type) all.push(node); for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value); } }
walk(ast);
const declaration = name => { const nodes=all.filter(node=>node.type==='VariableDeclarator'&&node.id.name===name);assert.equal(nodes.length,1,name);return nodes[0].init; };
const callback = (node, context) => vm.runInContext(`(${source.slice(node.start,node.end)})`, context);
const clearLayer = layer => { for (const item of [...layer.renderLayerChildren]) { layer.detach(item); if (!item.destroyed) item.destroy({children:true}); } layer.destroy(); };

function corpseSubject() {
  const depth = new RenderLayer({sortableChildren:true});
  const deaths = new Container();
  const markers = new Map();
  const playedCues = [];
  const context = vm.createContext({
    worldDepthLayer: depth, worldDepthKey, enemyDeathVisuals: deaths, enemyDeathMarkers: markers,
    enemyVisualFacing: new Map(), createCorpseClock, pruneCorpseCapacity,
    performance: {now:()=>1000}, isEliteEnemyProjection:()=>false,
    pushCombatVisualEvent:()=>{}, ENEMY_ARCHETYPES:{forkrunner:{visual:{color:0xffffff}}},
    createRosterOrVectorDisplay:()=>new Container(),
    actor:{x:100,y:220}, deterministicUnit,
    combatAudio:{play:(cue, options)=>playedCues.push({cue,...options})},
  });
  return { context, depth, deaths, markers, playedCues, queue:callback(declaration('queueEnemyDeathVisual'),context), clear:callback(declaration('clearEnemyDeathMarkers'),context) };
}

test('queued corpses join the real ground-depth layer at their captured world Y', () => {
  const s=corpseSubject(); const enemy={id:'corpse-fixture',archetypeId:'forkrunner',x:100,y:220,groundZ:0};const before=JSON.stringify(enemy);
  try {
    s.queue(enemy,20);
    const graphic=s.markers.get(enemy.id).graphic;
    assert.ok(s.depth.renderLayerChildren.includes(graphic));
    assert.equal(graphic.zIndex,220);
    assert.equal(JSON.stringify(enemy),before);
    assert.deepEqual(s.playedCues,[{cue:'enemy-death',volume:.13,playbackRate:.85+deterministicUnit(enemy.id)*.3}]);
    s.queue(enemy,21);
    assert.equal(s.markers.size,1,'duplicate deaths must not allocate another corpse');
    assert.equal(s.playedCues.length,1,'duplicate deaths must not replay their sound');
  }
  finally { s.clear();s.deaths.destroy({children:true});clearLayer(s.depth); }
});

test('distant deaths still attach corpse art without playing nearby combat audio', () => {
  const s=corpseSubject();
  try {
    s.queue({id:'distant',archetypeId:'forkrunner',x:1200,y:220,groundZ:0},20);
    assert.equal(s.markers.size,1);
    assert.equal(s.depth.renderLayerChildren.length,1);
    assert.deepEqual(s.playedCues,[]);
  } finally {s.clear();s.deaths.destroy({children:true});clearLayer(s.depth);}
});

test('corpse capacity and reset leave no orphaned depth attachments', () => {
  const s=corpseSubject();
  try {
    for(let i=0;i<CORPSE_VISUAL_CAP+2;i++)s.queue({id:`corpse-${i}`,archetypeId:'forkrunner',x:100,y:200+i,groundZ:0},20+i);
    assert.equal(s.markers.size,CORPSE_VISUAL_CAP);assert.equal(s.depth.renderLayerChildren.length,CORPSE_VISUAL_CAP);
    s.clear();assert.equal(s.markers.size,0);assert.equal(s.depth.renderLayerChildren.length,0);
  } finally { s.clear();s.deaths.destroy({children:true});clearLayer(s.depth); }
});

test('the actual expiry loop detaches and destroys expired corpse graphics', () => {
  const s=corpseSubject();
  const loop=all.filter(node=>node.type==='ForOfStatement'&&source.slice(node.start,node.end).includes('const corpse = corpsePresentation')).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
  assert.ok(loop,'the real renderer expiry consumer must exist');
  try {
    s.queue({id:'expiry',archetypeId:'forkrunner',x:100,y:220,groundZ:0},20);
    const graphic=s.markers.get('expiry').graphic;
    assert.equal(s.depth.renderLayerChildren.length,1);
    Object.assign(s.context,{corpsePresentation,simulation:{tick:20},corpseNowMs:1000+CORPSE_LIFETIME_MS});
    vm.runInContext(source.slice(loop.start,loop.end),s.context);
    assert.equal(s.markers.size,0);assert.equal(s.depth.renderLayerChildren.length,0);
    assert.equal(s.deaths.children.length,0);assert.equal(graphic.destroyed,true);
  } finally {s.clear();s.deaths.destroy({children:true});clearLayer(s.depth);}
});

test('fallback buildings have an individually sorted display in the real depth layer', () => {
  const depth=new RenderLayer({sortableChildren:true});
  const production=createWorldProductionLayers({ContainerClass:Container,GraphicsClass:Graphics,depthLayer:depth});
  const feature=LEVEL_ONE_WORLD.blockers.find(row=>row.id==='relay-abandoned-farmhouse');assert.ok(feature);
  const camera={x:feature.anchor.x,y:feature.anchor.y,zoom:1};const view={width:1440,height:900};
  const project=(point,camera,view)=>({x:(point.x-camera.x)*camera.zoom+view.width/2,y:(point.y-camera.y-(point.z??0))*camera.zoom+view.height/2});
  const args={worldProduction:production,world:LEVEL_ONE_WORLD,camera,view,worldToScreen:project,queryGround:createLevelOneGroundQuery(),tick:20,performanceProfile:{worldCullMargin:192,particlesPerHazard:0}};
  try {
    renderWorldProductionArt(args);
    assert.ok(depth.renderLayerChildren.some(item=>item.visible&&item.zIndex===feature.anchor.y),'fallback building must sort with the actor, not remain underneath the entire depth layer');
    const count=depth.renderLayerChildren.length;
    renderWorldProductionArt({...args,tick:21});assert.equal(depth.renderLayerChildren.length,count,'fallback displays must be reused');
    renderWorldProductionArt({...args,tick:22,nativeBlockerIds:new Set([feature.id])});
    assert.equal(depth.renderLayerChildren.some(item=>item.visible&&item.zIndex===feature.anchor.y),false,'suppressed fallback must not linger behind native art');
  } finally { production.root.destroy({children:true});clearLayer(depth); }
});

for (const kind of ['fence', 'machinery', 'containers', 'bridge-rail']) test(`fallback ${kind} remains in the same depth system as its native replacement`, () => {
  const depth=new RenderLayer({sortableChildren:true});
  const production=createWorldProductionLayers({ContainerClass:Container,GraphicsClass:Graphics,depthLayer:depth});
  const feature=LEVEL_ONE_WORLD.blockers.find(row=>row.visualKind===kind);assert.ok(feature);
  const camera={x:feature.anchor.x,y:feature.anchor.y,zoom:1},view={width:1440,height:900};
  const project=(point,camera,view)=>({x:point.x-camera.x+view.width/2,y:point.y-camera.y-(point.z??0)+view.height/2});
  try {
    renderWorldProductionArt({worldProduction:production,world:LEVEL_ONE_WORLD,camera,view,worldToScreen:project,queryGround:createLevelOneGroundQuery(),tick:20,performanceProfile:{worldCullMargin:192,particlesPerHazard:0}});
    assert.ok(depth.renderLayerChildren.some(item=>item.visible&&item.label===`world-depth-fallback-${feature.id}`&&item.zIndex===feature.anchor.y),`${kind} may not remain below every actor`);
  } finally {production.root.destroy({children:true});clearLayer(depth);}
});

test('partial authored-display construction cleans its real Pixi attachments', () => {
  const depth=new RenderLayer({sortableChildren:true});
  const frame={assetId:'fixture-good',frame:{x:0,y:0,w:1,h:1},anchor:{x:0.5,y:1},runtimeScale:1};
  const index={frameById:new Map([['fixture-good',frame]]),frameFor:id=>id==='fixture-good'?frame:null};
  try {
    assert.throws(()=>createAuthoredPropDisplay({index,atlasTexture:Texture.WHITE,depthLayer:depth,placements:[{id:'good',assetId:'fixture-good',x:0,y:0},{id:'missing',assetId:'fixture-missing',x:0,y:0}],ContainerClass:Container,SpriteClass:Sprite,TextureClass:Texture,RectangleClass:Rectangle,GraphicsClass:Graphics}),/missing authored prop frame/);
    assert.equal(depth.renderLayerChildren.length,0,'a failed constructor must not retain its earlier sprites');
  } finally { for(const child of [...depth.renderLayerChildren]) child.parent?.destroy({children:true});clearLayer(depth); }
});

function assetLoadSubject(failure) {
  const metadata=JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-world-design/world-design.json',import.meta.url),'utf8'));
  const appearance=createWorldDesignAppearance(metadata,metadata.tiers.desktop.pages.map(page=>({source:{width:page.width,height:page.height}})));
  const nativeLoad=all.filter(node=>node.type==='ArrowFunctionExpression'&&node.async&&source.slice(node.start,node.end).includes('createAuthoredPropDisplay(')).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];assert.ok(nativeLoad);
  const catcher=all.filter(node=>node.type==='ArrowFunctionExpression'&&source.slice(node.start,node.end).includes('authoredPropLoadError = error')).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];assert.ok(catcher);
  const depth=new RenderLayer({sortableChildren:true});let disposed=0;
  const ctx=vm.createContext({
    Map,Set,Object,app:{stage:{destroyed:false}},world:{parent:{}},dataset:{},performanceProfile:{id:'desktop'},
    tripoPropAppearance:new Map(),worldDesignBlockerIds:new Set(),authoredPropDisplay:null,authoredHeldWeaponDisplay:null,authoredPropLoadError:null,
    createAuthoredPropAtlasIndex:()=>({}),loadTripoPropAppearance:async()=>new Map(),loadWorldDesignAppearance:async()=>appearance,
    WORLD_DESIGN_SECRET_PROPS,WORLD_DESIGN_SITE_PROPS,WORLD_DESIGN_ORCHARD,buildWorldDesignPlacements,extendWorldDesignLandmarks,LEVEL_ONE_WORLD,buildAuthoredTownPlacements:()=>[],authoredPropPlacements:[],
    Container,Graphics,Sprite,Texture,Rectangle,worldDepthLayer:depth,Assets:{load:async()=>Texture.WHITE},
    authoredPropLayer:new Container(),heldWeaponLayer:new Container(),worldProduction:{layers:{townBlockers:{visible:true},landmarks:{visible:true}}},
    lightningLedgerEventPlacement:null,bearMarketBurnerEventPlacement:null,forkedStandardEventPlacement:null,
    createAuthoredPropDisplay:()=>{if(failure==='props')throw new Error('fixture props failure');const container=new Container();const sprite=new Container();container.addChild(sprite);depth.attach(sprite);return {container,entries:[],addPlacement:()=>{},destroy(){disposed++;depth.detach(sprite);container.destroy({children:true});}};},
    createAuthoredHeldWeaponDisplay:()=>{throw new Error('fixture held failure');},console:{warn(){}},
  });
  return {ctx,depth,run:()=>callback(nativeLoad,ctx)([{ok:true,json:async()=>({})},Texture.WHITE]).catch(callback(catcher,ctx)),disposed:()=>disposed};
}
for(const failure of ['props','held'])test(`failed ${failure} construction never hides canonical fallback collision art`, async()=>{
  const s=assetLoadSubject(failure);
  try {
    await s.run();assert.equal(s.ctx.dataset.authoredPropStatus,'fallback');
    assert.equal(s.ctx.worldDesignBlockerIds.size,0,'blocker suppression must commit only with mounted art');
    assert.equal(s.ctx.worldProduction.layers.townBlockers.visible,true);
    assert.equal(s.depth.renderLayerChildren.length,0,'failed startup must release partially prepared art');
    if(failure==='held')assert.equal(s.disposed(),1);
  } finally {s.ctx.authoredPropLayer.destroy({children:true});s.ctx.heldWeaponLayer.destroy({children:true});clearLayer(s.depth);}
});
