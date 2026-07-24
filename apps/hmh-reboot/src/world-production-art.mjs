function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function artKit(spec) {
  return freezeDeep({ classification: 'production-art', runtimeAuthority: 'projection-only', ...spec });
}

export const DISTRICT_PRODUCTION_MATERIALS = freezeDeep({
  'frontier-relay': artKit({ groundColor: 0x153c35, detailColor: 0x42c89c, routeColor: 0xa68d61, motif: 'relay-circuit', materialLayers: ['packed-earth', 'relay-traces', 'signal-pads'] }),
  'rugpull-ravine': artKit({ groundColor: 0x4a2b28, detailColor: 0xd97852, routeColor: 0xb88962, motif: 'forked-strata', materialLayers: ['red-rock', 'fracture-lines', 'salvage-scrap'] }),
  'liquidity-crossing': artKit({ groundColor: 0x103a4b, detailColor: 0x31c8e8, routeColor: 0xc0a06c, motif: 'liquidity-ripples', materialLayers: ['wet-bank', 'flow-lines', 'bridge-seams'] }),
  hashwood: artKit({ groundColor: 0x163d2a, detailColor: 0x62c878, routeColor: 0x8f8558, motif: 'hash-ring-roots', materialLayers: ['forest-floor', 'root-rings', 'spore-patches'] }),
  'mining-camp': artKit({ groundColor: 0x343638, detailColor: 0xf0ae4c, routeColor: 0xa68d67, motif: 'ore-grid', materialLayers: ['crushed-ore', 'loader-tracks', 'warning-marks'] }),
  'liquidation-yard': artKit({ groundColor: 0x3e1c31, detailColor: 0xff527e, routeColor: 0xb18b68, motif: 'margin-grid', materialLayers: ['industrial-slab', 'liquidation-grid', 'warning-chevrons'] }),
});

export const BLOCKER_PRODUCTION_KITS = freezeDeep({
  fence: artKit({ baseColor: 0x4b5f68, accentColor: 0xbde9ea, identityCues: ['alternating steel posts', 'cyan live-wire rail'] }),
  cliff: artKit({ baseColor: 0x5d3428, accentColor: 0xd98656, identityCues: ['layered red-rock wall', 'bright fracture caps'] }),
  'bridge-rail': artKit({ baseColor: 0x3e5660, accentColor: 0xa9f4ff, identityCues: ['double proof rail', 'cyan rivet nodes'] }),
  'dense-trees': artKit({ baseColor: 0x173c27, accentColor: 0x60d683, identityCues: ['overlapping dark canopies', 'hash-ring highlights'] }),
  machinery: artKit({ baseColor: 0x34373d, accentColor: 0xf5ad46, identityCues: ['heavy loader silhouette', 'amber hazard plates'] }),
  building: artKit({ baseColor: 0x342b38, accentColor: 0xf05b86, identityCues: ['dark industrial roof', 'magenta liquidation trim'] }),
  containers: artKit({ baseColor: 0x543548, accentColor: 0xff6a88, identityCues: ['stacked freight ribs', 'alternating warning doors'] }),
});

export const LANDMARK_PRODUCTION_KITS = freezeDeep({
  'signal-tower': artKit({ baseColor: 0x284d50, accentColor: 0x5cffe2, identityCues: ['forked relay mast', 'three broadcast rings', 'cyan signal lamp'] }),
  'forked-cliff': artKit({ baseColor: 0x67382c, accentColor: 0xffa05c, identityCues: ['split rock crown', 'orange strata bands', 'salvage pennant'] }),
  bridge: artKit({ baseColor: 0x4b5660, accentColor: 0x8feaff, identityCues: ['proof truss', 'lit rivet chain', 'raised deck'] }),
  'beacon-tree': artKit({ baseColor: 0x244b2e, accentColor: 0x7dff8c, identityCues: ['ancient hash-ring canopy', 'luminous trunk rune', 'green beacon halo'] }),
  headframe: artKit({ baseColor: 0x3e4146, accentColor: 0xffbd52, identityCues: ['tall mining gantry', 'ore pulley wheel', 'amber work lamp'] }),
  'extraction-tower': artKit({ baseColor: 0x41293c, accentColor: 0xff5d8f, identityCues: ['liquidation spire', 'margin-call antenna', 'magenta extraction beam'] }),
});

export const INTERACTION_PRODUCTION_KITS = freezeDeep({
  reward: artKit({ color: 0x63f29a, icon: 'cache-diamond' }),
  weapon: artKit({ color: 0x70c9ff, icon: 'armory-cross' }),
  'hazard-reward': artKit({ color: 0xffb34d, icon: 'fuel-cache' }),
  upgrade: artKit({ color: 0xc18cff, icon: 'upgrade-chevron' }),
  objective: artKit({ color: 0xff6e9b, icon: 'objective-terminal' }),
  rockfall: artKit({ color: 0xff875f, icon: 'falling-rock' }),
  'deep-water': artKit({ color: 0x37c9f1, icon: 'current-wave' }),
  'area-slow': artKit({ color: 0x7ee58a, icon: 'spore-ring' }),
  'moving-hazard': artKit({ color: 0xffb23e, icon: 'conveyor-arrows' }),
  'damage-zone': artKit({ color: 0xff416f, icon: 'liquidation-grid' }),
});

export const WORLD_PRODUCTION_ART = artKit({
  id: 'production-vector-world-v1',
  layers: Object.freeze(['terrain', 'routes', 'surfaces', 'details', 'blockers', 'landmarks', 'interactions', 'particles', 'lighting']),
  shaderIds: Object.freeze(['water-shimmer-v1', 'hazard-pulse-v1', 'beacon-glow-v1', 'edge-vignette-v1']),
});

function finiteNumber(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function resolveWorldShaderState({ tick, districtId }) {
  const simulationTick = nonNegativeInteger(tick, 'tick');
  if (!DISTRICT_PRODUCTION_MATERIALS[districtId]) throw new RangeError(`unknown districtId: ${districtId}`);
  const offset = (fnv1a(districtId) % 360) * Math.PI / 180;
  const wave = (period) => (Math.sin(simulationTick / period * Math.PI * 2 + offset) + 1) / 2;
  return freezeDeep({
    districtId,
    tick: simulationTick,
    waterShimmer: Number(wave(90).toFixed(6)),
    hazardPulse: Number(wave(42).toFixed(6)),
    beaconGlow: Number(wave(120).toFixed(6)),
    scanlineOffset: simulationTick % 48,
  });
}

export function resolveWorldParticleField({ id, x, y, tick, count, radius }) {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('id must be a non-empty string');
  finiteNumber(x, 'x');
  finiteNumber(y, 'y');
  nonNegativeInteger(tick, 'tick');
  nonNegativeInteger(count, 'count');
  if (count > 64) throw new RangeError('count must be at most 64');
  if (!Number.isFinite(radius) || radius <= 0) throw new TypeError('radius must be positive');
  const seed = fnv1a(id);
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const angle = ((seed % 6283) / 1000) + index * 2.399963 + tick * (0.002 + (index % 3) * 0.0005);
    const distance = radius * (0.22 + ((Math.imul(seed ^ index, 2654435761) >>> 8) % 760) / 1000);
    const lift = Math.sin((tick + index * 17) / 18) * radius * 0.14;
    return Object.freeze({
      x: Number((x + Math.cos(angle) * distance).toFixed(4)),
      y: Number((y + Math.sin(angle) * distance + lift).toFixed(4)),
      alpha: Number((0.28 + ((seed + index * 31 + tick) % 60) / 100).toFixed(4)),
      size: Number((1.5 + ((seed >>> (index % 16)) & 3) * 0.75).toFixed(3)),
    });
  }));
}

export function createWorldProductionLayers({ ContainerClass, GraphicsClass }) {
  if (typeof ContainerClass !== 'function' || typeof GraphicsClass !== 'function') throw new TypeError('Pixi classes are required');
  const root = new ContainerClass();
  root.label = WORLD_PRODUCTION_ART.id;
  root.runtimeAuthority = WORLD_PRODUCTION_ART.runtimeAuthority;
  const layers = {};
  for (const name of WORLD_PRODUCTION_ART.layers) {
    const graphic = new GraphicsClass();
    graphic.label = `world-${name}`;
    layers[name] = graphic;
    root.addChild(graphic);
  }
  layers.particles.blendMode = 'add';
  layers.lighting.blendMode = 'add';
  return Object.freeze({ root, layers: Object.freeze(layers) });
}

export function clearWorldProductionLayers(worldProduction) {
  if (!worldProduction?.layers) throw new TypeError('worldProduction layers are required');
  for (const layer of Object.values(worldProduction.layers)) layer.clear();
}

function rectVertices(area) {
  return area.type === 'rect'
    ? [{ x: area.minX, y: area.minY }, { x: area.maxX, y: area.minY }, { x: area.maxX, y: area.maxY }, { x: area.minX, y: area.maxY }]
    : area.vertices;
}

function tracePolygon(graphic, points) {
  graphic.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) graphic.lineTo(point.x, point.y);
  return graphic.closePath();
}

function mixColor(from, to, amount) {
  const blend = Math.max(0, Math.min(1, amount));
  const channel = (shift) => Math.round(((from >>> shift) & 0xff) * (1 - blend) + ((to >>> shift) & 0xff) * blend);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function drawRoute(layers, points, route, kit) {
  layers.routes.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) layers.routes.lineTo(point.x, point.y);
  layers.routes.stroke({ color: 0x130f13, width: (route.width + 32) * points.zoom, alpha: 0.88, cap: 'round', join: 'round' });
  layers.routes.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) layers.routes.lineTo(point.x, point.y);
  layers.routes.stroke({ color: kit.routeColor, width: route.width * points.zoom, alpha: route.kind === 'main' ? 0.96 : 0.82, cap: 'round', join: 'round' });
  layers.routes.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) layers.routes.lineTo(point.x, point.y);
  layers.routes.stroke({ color: kit.detailColor, width: Math.max(1, 3 * points.zoom), alpha: route.kind === 'main' ? 0.38 : 0.22 });
}

function drawBlocker(graphic, feature, kit, camera, worldToScreen) {
  const shape = feature.shape;
  const z = feature.maxZ ? Math.min(feature.maxZ * 0.08, 18) : 0;
  if (shape.type === 'capsule') {
    const a = worldToScreen({ ...shape.a, z }, camera);
    const b = worldToScreen({ ...shape.b, z }, camera);
    const width = Math.max(6, shape.radius * 2 * camera.zoom);
    graphic.moveTo(a.x + 4, a.y + 7).lineTo(b.x + 4, b.y + 7).stroke({ color: 0x05070a, width, alpha: 0.46, cap: 'round' });
    graphic.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: kit.baseColor, width, alpha: 0.98, cap: 'round' });
    graphic.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: kit.accentColor, width: Math.max(2, width * 0.12), alpha: 0.82, cap: 'round' });
    const posts = Math.max(2, Math.min(12, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 85)));
    for (let index = 0; index <= posts; index += 1) {
      const t = index / posts;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (feature.visualKind === 'dense-trees') {
        graphic.circle(x, y - 8 * camera.zoom, Math.max(9, shape.radius * 0.45 * camera.zoom)).fill({ color: kit.baseColor, alpha: 1 }).stroke({ color: kit.accentColor, width: 2, alpha: 0.62 });
      } else {
        graphic.roundRect(x - 3, y - 10 * camera.zoom, 6, 20 * camera.zoom, 2).fill({ color: kit.accentColor, alpha: 0.88 });
      }
    }
  } else if (shape.type === 'circle') {
    const center = worldToScreen({ x: shape.x, y: shape.y, z }, camera);
    graphic.circle(center.x + 4, center.y + 7, shape.radius * camera.zoom).fill({ color: 0x05070a, alpha: 0.45 });
    graphic.circle(center.x, center.y, shape.radius * camera.zoom).fill({ color: kit.baseColor, alpha: 1 }).stroke({ color: kit.accentColor, width: 3 });
  } else {
    const points = shape.vertices.map((point) => worldToScreen({ ...point, z }, camera));
    tracePolygon(graphic, points).fill({ color: kit.baseColor, alpha: 0.98 }).stroke({ color: kit.accentColor, width: 3, alpha: 0.84 });
    const top = points.reduce((best, point) => point.y < best.y ? point : best, points[0]);
    graphic.circle(top.x, top.y + 14, 5).fill({ color: kit.accentColor, alpha: 0.92 });
  }
}

function drawLandmark(graphic, landmark, kit, center, zoom, glow) {
  const s = Math.max(0.55, zoom);
  graphic.ellipse(center.x + 7 * s, center.y + 14 * s, 38 * s, 16 * s).fill({ color: 0x030608, alpha: 0.48 });
  if (landmark.visualKind === 'signal-tower') {
    graphic.moveTo(center.x, center.y + 32 * s).lineTo(center.x, center.y - 34 * s).stroke({ color: kit.baseColor, width: 12 * s });
    graphic.moveTo(center.x, center.y - 12 * s).lineTo(center.x - 18 * s, center.y - 28 * s).moveTo(center.x, center.y - 12 * s).lineTo(center.x + 18 * s, center.y - 28 * s).stroke({ color: kit.accentColor, width: 5 * s });
    for (const radius of [18, 28, 38]) graphic.arc(center.x, center.y - 24 * s, radius * s, Math.PI * 1.15, Math.PI * 1.85).stroke({ color: kit.accentColor, width: 2, alpha: 0.4 + glow * 0.45 });
  } else if (landmark.visualKind === 'forked-cliff') {
    graphic.poly([center.x - 32*s,center.y+30*s,center.x-12*s,center.y-30*s,center.x,center.y-5*s,center.x+15*s,center.y-36*s,center.x+34*s,center.y+30*s]).fill({ color: kit.baseColor }).stroke({ color: kit.accentColor, width: 4 });
  } else if (landmark.visualKind === 'bridge') {
    graphic.roundRect(center.x - 48*s, center.y - 14*s, 96*s, 28*s, 5*s).fill({ color: kit.baseColor }).stroke({ color: kit.accentColor, width: 3 });
    for (let index=0; index<5; index+=1) graphic.circle(center.x-36*s+index*18*s,center.y,3*s).fill({color:kit.accentColor});
  } else if (landmark.visualKind === 'beacon-tree') {
    graphic.roundRect(center.x-8*s,center.y-2*s,16*s,40*s,6*s).fill({color:kit.baseColor}).stroke({color:kit.accentColor,width:3});
    for (const [dx,dy,r] of [[0,-20,28],[-22,-5,20],[22,-5,20]]) graphic.circle(center.x+dx*s,center.y+dy*s,r*s).fill({color:kit.baseColor}).stroke({color:kit.accentColor,width:3,alpha:0.8});
    graphic.circle(center.x,center.y-14*s,(34+glow*8)*s).stroke({color:kit.accentColor,width:3,alpha:0.3+glow*0.45});
  } else if (landmark.visualKind === 'headframe') {
    graphic.moveTo(center.x-28*s,center.y+34*s).lineTo(center.x-18*s,center.y-30*s).lineTo(center.x+22*s,center.y-30*s).lineTo(center.x+30*s,center.y+34*s).stroke({color:kit.baseColor,width:10*s,join:'round'});
    graphic.circle(center.x+2*s,center.y-25*s,12*s).stroke({color:kit.accentColor,width:4});
    graphic.moveTo(center.x+2*s,center.y-13*s).lineTo(center.x+2*s,center.y+28*s).stroke({color:kit.accentColor,width:3});
  } else {
    graphic.poly([center.x-26*s,center.y+34*s,center.x-12*s,center.y-28*s,center.x,center.y-42*s,center.x+12*s,center.y-28*s,center.x+28*s,center.y+34*s]).fill({color:kit.baseColor}).stroke({color:kit.accentColor,width:4});
    graphic.moveTo(center.x,center.y-38*s).lineTo(center.x,center.y-68*s).stroke({color:kit.accentColor,width:5,alpha:0.85});
    graphic.circle(center.x,center.y-72*s,8*s).fill({color:kit.accentColor,alpha:0.7+glow*0.3});
  }
}

function drawInteraction(graphic, center, kit, zoom, pulse, hazard = false) {
  const size = (hazard ? 34 : 16) * zoom;
  if (hazard) {
    graphic.circle(center.x, center.y, size * (1 + pulse * 0.14)).fill({ color: kit.color, alpha: 0.07 + pulse * 0.08 }).stroke({ color: kit.color, width: 3, alpha: 0.58 + pulse * 0.3 });
    graphic.moveTo(center.x - size * 0.55, center.y).lineTo(center.x + size * 0.55, center.y).moveTo(center.x, center.y - size * 0.55).lineTo(center.x, center.y + size * 0.55).stroke({ color: kit.color, width: 2, alpha: 0.72 });
  } else {
    graphic.poly([center.x, center.y-size, center.x+size, center.y, center.x, center.y+size, center.x-size, center.y]).fill({color:0x071215,alpha:0.9}).stroke({color:kit.color,width:3,alpha:0.95});
    graphic.circle(center.x,center.y,size*0.28).fill({color:kit.color,alpha:0.88});
  }
}

export function renderWorldProductionArt({ worldProduction, world, camera, view, queryGround, worldToScreen, tick }) {
  if (!worldProduction?.layers || !world || !camera || !view) throw new TypeError('world renderer inputs are required');
  if (typeof queryGround !== 'function' || typeof worldToScreen !== 'function') throw new TypeError('world projection functions are required');
  nonNegativeInteger(tick, 'tick');
  clearWorldProductionLayers(worldProduction);
  const layers = worldProduction.layers;
  const project = (point, activeCamera = camera) => worldToScreen(point, activeCamera, view);
  const districtAt = (x) => world.districts.find((district) => x >= district.area.minX && x <= district.area.maxX) ?? world.districts[0];
  const shaderByDistrict = new Map(world.districts.map((district) => [district.id, resolveWorldShaderState({ tick, districtId: district.id })]));

  for (const district of world.districts) {
    const kit = DISTRICT_PRODUCTION_MATERIALS[district.id];
    const a = project({ x: district.area.minX, y: district.area.minY, z: 0 });
    const b = project({ x: district.area.maxX, y: district.area.maxY, z: 0 });
    layers.terrain.rect(a.x, a.y, b.x-a.x, b.y-a.y).fill({ color: kit.groundColor, alpha: 1 });
    const width = b.x-a.x;
    const height = b.y-a.y;
    for (let index=1; index<=7; index+=1) {
      const x = a.x + width * index / 8;
      const offset = ((fnv1a(district.id) >>> index) & 15) * camera.zoom;
      layers.details.moveTo(x, a.y + offset).lineTo(x - height * 0.12, b.y - offset).stroke({ color: kit.detailColor, width: Math.max(1, camera.zoom * 2), alpha: 0.09 + (index % 3) * 0.035 });
    }
    for (let index=0; index<5; index+=1) {
      const x = a.x + width * (0.12 + index * 0.19);
      const y = a.y + height * (0.2 + ((fnv1a(`${district.id}:${index}`) % 57) / 100));
      layers.details.circle(x,y,(8+(index%3)*4)*camera.zoom).stroke({color:kit.detailColor,width:2,alpha:0.18});
    }
  }

  for (const route of world.routes) {
    const routePoints = route.nodeIds.map((id) => {
      const node = world.routeGraph.nodes.find((candidate) => candidate.id === id);
      const ground = queryGround(node.x,node.y);
      return project({x:node.x,y:node.y,z:ground.groundZ});
    });
    routePoints.zoom = camera.zoom;
    const firstNode = world.routeGraph.nodes.find((node) => node.id === route.nodeIds[0]);
    drawRoute(layers, routePoints, route, DISTRICT_PRODUCTION_MATERIALS[districtAt(firstNode.x).id]);
  }

  for (const surface of world.surfaces) {
    const vertices=rectVertices(surface.area);
    const points=vertices.map((vertex)=>{const sampled=queryGround(vertex.x,vertex.y); return project({...vertex,z:surface.waterLevel??sampled.groundZ});});
    const district=districtAt(vertices[0].x); const shader=shaderByDistrict.get(district.id); const kit=DISTRICT_PRODUCTION_MATERIALS[district.id];
    const palette={water:0x126d91,'shallow-water':0x20a3b8,bridge:0x856e51};
    const districtSurface=surface.kind==='ledge' ? mixColor(kit.groundColor,kit.detailColor,0.24) : mixColor(kit.groundColor,kit.detailColor,0.16);
    tracePolygon(layers.surfaces,points).fill({color:palette[surface.kind]??districtSurface,alpha:surface.kind==='water'?0.92:0.97}).stroke({color:surface.kind.includes('water')?0x84e8ff:kit.detailColor,width:3,alpha:0.8});
    if (surface.kind.includes('water') && surface.area.type==='rect') {
      const a=points[0], b=points[2];
      for(let line=1;line<=7;line+=1){const y=a.y+(b.y-a.y)*line/8; const shift=(shader.waterShimmer*18+line*7)*camera.zoom; layers.surfaces.moveTo(a.x+shift,y).lineTo(b.x-Math.max(0,20-shift),y).stroke({color:0xbaf5ff,width:Math.max(1,2*camera.zoom),alpha:0.13+shader.waterShimmer*0.18});}
    }
  }

  for (const feature of world.blockers) drawBlocker(layers.blockers, feature, BLOCKER_PRODUCTION_KITS[feature.visualKind], camera, (point, activeCamera) => project(point,activeCamera));

  for (const destructible of world.interactions.destructibles) {
    const ground=queryGround(destructible.anchor.x,destructible.anchor.y); const center=project({...destructible.anchor,z:ground.groundZ}); const s=18*camera.zoom;
    layers.details.roundRect(center.x-s,center.y-s*0.7,s*2,s*1.4,4).fill({color:0x5c4433,alpha:1}).stroke({color:0xd7a766,width:3});
    layers.details.moveTo(center.x-s,center.y).lineTo(center.x+s,center.y).moveTo(center.x,center.y-s*0.7).lineTo(center.x,center.y+s*0.7).stroke({color:0x2e211a,width:2,alpha:0.7});
  }
  for (const zone of world.interactions.explosiveZones) {
    const ground=queryGround(zone.anchor.x,zone.anchor.y); const center=project({...zone.anchor,z:ground.groundZ}); const s=12*camera.zoom;
    for(let index=-1;index<=1;index+=1) layers.details.roundRect(center.x+index*s*1.6-s*0.5,center.y-s,s,s*2,3).fill({color:0xa13b31}).stroke({color:0xffbe55,width:2});
  }

  for (const landmark of world.landmarks) {
    const ground=queryGround(landmark.anchor.x,landmark.anchor.y); const center=project({...landmark.anchor,z:ground.groundZ}); const kit=LANDMARK_PRODUCTION_KITS[landmark.visualKind]; const glow=shaderByDistrict.get(landmark.districtId).beaconGlow;
    drawLandmark(layers.landmarks,landmark,kit,center,camera.zoom,glow);
    layers.lighting.circle(center.x,center.y,(44+glow*16)*camera.zoom).fill({color:kit.accentColor,alpha:0.035+glow*0.045});
  }

  for (const poi of world.pointsOfInterest) {
    const ground=queryGround(poi.anchor.x,poi.anchor.y); const center=project({...poi.anchor,z:ground.groundZ});
    drawInteraction(layers.interactions,center,INTERACTION_PRODUCTION_KITS[poi.hook],camera.zoom,0,false);
  }
  for (const hazard of world.interactions.hazards) {
    const ground=queryGround(hazard.anchor.x,hazard.anchor.y); const center=project({...hazard.anchor,z:ground.groundZ}); const shader=shaderByDistrict.get(hazard.districtId); const kit=INTERACTION_PRODUCTION_KITS[hazard.kind];
    drawInteraction(layers.interactions,center,kit,camera.zoom,shader.hazardPulse,true);
    for(const particle of resolveWorldParticleField({id:hazard.id,x:hazard.anchor.x,y:hazard.anchor.y,tick,count:10,radius:52})) {const screen=project({...particle,z:ground.groundZ+particle.size*4}); layers.particles.circle(screen.x,screen.y,particle.size*camera.zoom).fill({color:kit.color,alpha:particle.alpha});}
  }

  const vignette=36;
  layers.lighting.rect(0,0,view.width,vignette).fill({color:0x071018,alpha:0.18});
  layers.lighting.rect(0,view.height-vignette,view.width,vignette).fill({color:0x071018,alpha:0.18});
  layers.lighting.rect(0,0,vignette,view.height).fill({color:0x071018,alpha:0.15});
  layers.lighting.rect(view.width-vignette,0,vignette,view.height).fill({color:0x071018,alpha:0.15});
  return freezeDeep({
    artId: WORLD_PRODUCTION_ART.id,
    shaderIds: WORLD_PRODUCTION_ART.shaderIds,
    particleCount: world.interactions.hazards.length * 10,
    districtCount: world.districts.length,
    blockerCount: world.blockers.length,
    landmarkCount: world.landmarks.length,
  });
}
