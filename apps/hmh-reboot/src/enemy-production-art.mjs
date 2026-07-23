const REQUIRED_STATES = Object.freeze(['idle', 'run', 'tell', 'attack', 'hit', 'death']);

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function kit(definition) {
  return freezeDeep({
    classification: 'production-art',
    runtimeAuthority: 'projection-only',
    states: [...REQUIRED_STATES],
    elite: { layers: ['aura', 'crown', 'outline'] },
    ...definition,
  });
}

export const ENEMY_PRODUCTION_ART = freezeDeep({
  'bagholder-rusher': kit({
    actorId: 'bagholder-rusher',
    palette: { body: 0x9d3158, secondary: 0x332633, skin: 0xa8c59b, accent: 0xff5c7a, dark: 0x151c24 },
    telegraphColor: 0xff5c7a,
    silhouette: { width: 42, height: 66, shoulder: 17 },
    identityCues: ['ragged magenta hoodie', 'pale undead face', 'red debt satchel'],
  }),
  forkrunner: kit({
    actorId: 'forkrunner',
    palette: { body: 0x147f9c, secondary: 0x123747, skin: 0xd7a279, accent: 0x49ddff, dark: 0x081a25 },
    telegraphColor: 0x49ddff,
    silhouette: { width: 34, height: 61, shoulder: 13 },
    identityCues: ['split cyan runner jacket', 'forked twin blades', 'agile diamond silhouette'],
  }),
  'liquidator-agent': kit({
    actorId: 'liquidator-agent',
    palette: { body: 0x633576, secondary: 0x20152d, skin: 0xe2ad85, accent: 0xe26dff, dark: 0x100b18 },
    telegraphColor: 0xe26dff,
    silhouette: { width: 40, height: 68, shoulder: 18 },
    identityCues: ['magenta authority visor', 'black liquidation suit', 'suppression rifle'],
  }),
  'whale-enforcer': kit({
    actorId: 'whale-enforcer',
    palette: { body: 0x6d5420, secondary: 0x242018, skin: 0xc8936b, accent: 0xffc857, dark: 0x111317 },
    telegraphColor: 0xffc857,
    silhouette: { width: 68, height: 76, shoulder: 30 },
    identityCues: ['gold whale shoulder plates', 'black heavy armor', 'broad charging gauntlets'],
  }),
  'gas-bomber': kit({
    actorId: 'gas-bomber',
    palette: { body: 0x9b4b23, secondary: 0x39281f, skin: 0xf1b174, accent: 0xff8c5a, dark: 0x171411 },
    telegraphColor: 0xff8c5a,
    silhouette: { width: 46, height: 66, shoulder: 19 },
    identityCues: ['orange blast hood', 'twin gas canisters', 'glowing thrown charge'],
  }),
  'validator-cultist': kit({
    actorId: 'validator-cultist',
    palette: { body: 0x684493, secondary: 0x261d38, skin: 0x95b290, accent: 0xb786ff, dark: 0x120e1d },
    telegraphColor: 0xb786ff,
    silhouette: { width: 44, height: 72, shoulder: 16 },
    identityCues: ['violet validator hood', 'undead green face', 'ring-topped validation staff'],
  }),
});

export const LIQUIDATOR_PRODUCTION_ART = kit({
  actorId: 'the-liquidator',
  phases: ['market-open', 'margin-call', 'total-liquidation'],
  palette: { body: 0x2a1824, secondary: 0x09070b, skin: 0xc9866a, accent: 0xff496c, dark: 0x050407, gold: 0xffd166 },
  telegraphColor: 0xff496c,
  silhouette: { width: 112, height: 132, shoulder: 50 },
  identityCues: ['executive exosuit', 'red liquidation tie', 'gold market crown', 'margin-call shoulder cannons'],
});

function nonNegativeTick(value) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError('tick must be a non-negative integer');
  return value;
}

export function resolveEnemyProductionPose({ archetypeId, state, tick, direction = 0, elite = false } = {}) {
  if (!Object.hasOwn(ENEMY_PRODUCTION_ART, archetypeId)) throw new TypeError(`Unknown production enemy: ${String(archetypeId)}`);
  if (!REQUIRED_STATES.includes(state)) throw new TypeError(`Unsupported enemy visual state: ${String(state)}`);
  const simulationTick = nonNegativeTick(tick);
  if (!Number.isInteger(direction)) throw new TypeError('direction must be an integer');
  const runPhase = simulationTick % 12;
  const wave = Math.sin((runPhase / 12) * Math.PI * 2);
  const tellWave = 0.5 + 0.5 * Math.sin((simulationTick % 30) / 30 * Math.PI * 2);
  return freezeDeep({
    archetypeId,
    state,
    direction: ((direction % 8) + 8) % 8,
    legPhase: state === 'run' ? runPhase : 0,
    stride: state === 'run' ? Number((wave * 0.26).toFixed(6)) : 0,
    bob: state === 'run' ? Number((Math.abs(wave) * -2.4).toFixed(6)) : state === 'idle' ? Number((Math.sin((simulationTick % 60) / 60 * Math.PI * 2) * 0.8).toFixed(6)) : 0,
    tellPulse: state === 'tell' ? Number((0.55 + tellWave * 0.45).toFixed(6)) : 0,
    recoil: state === 'attack' ? 0.24 : 0,
    tint: state === 'hit' ? 0xffb3b3 : 0xffffff,
    hitFlash: state === 'hit' ? 1 : 0,
    rotation: state === 'death' ? Math.PI * 0.46 : 0,
    alpha: state === 'death' ? 0.42 : 1,
    eliteVisible: elite === true,
  });
}

export function resolveEnemyRuntimeVisualState(enemy, tick) {
  if (!enemy || typeof enemy !== 'object') throw new TypeError('enemy is required');
  nonNegativeTick(tick);
  if (!enemy.active || enemy.health <= 0) return 'death';
  if (enemy.attackPhase === 'tell') return 'tell';
  if (enemy.attackPhase === 'attack') return 'attack';
  if (Number.isInteger(enemy.hitUntilTick) && enemy.hitUntilTick >= tick) return 'hit';
  return Math.hypot(enemy.velocity?.x ?? 0, enemy.velocity?.y ?? 0) > 1 ? 'run' : 'idle';
}

export function isEliteEnemyProjection(enemyId) {
  if (typeof enemyId !== 'string' || enemyId.length === 0) throw new TypeError('enemyId is required');
  let hash = 2166136261;
  for (const character of enemyId) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % 8 === 0;
}

function drawShadow(graphic, scale = 1) {
  graphic.clear().ellipse(0, 7 * scale, 22 * scale, 9 * scale).fill({ color: 0x02060a, alpha: 0.55 });
}

function drawLeg(graphic, kitData, side, scale = 1) {
  const x = side * kitData.silhouette.width * 0.17 * scale;
  graphic.clear()
    .roundRect(x - 5 * scale, -3 * scale, 10 * scale, 24 * scale, 4 * scale).fill({ color: kitData.palette.secondary })
    .roundRect(x - 7 * scale, 15 * scale, 14 * scale, 8 * scale, 3 * scale).fill({ color: kitData.palette.dark })
    .rect(x - 4 * scale, 2 * scale, 8 * scale, 4 * scale).fill({ color: kitData.palette.accent, alpha: 0.76 });
}

function drawBaseBody(parts, kitData, scale = 1) {
  const { width, height, shoulder } = kitData.silhouette;
  const yTop = -height * 0.68 * scale;
  drawShadow(parts.shadow, scale);
  drawLeg(parts.leftLeg, kitData, -1, scale);
  drawLeg(parts.rightLeg, kitData, 1, scale);
  parts.body.clear()
    .roundRect(-width * 0.34 * scale, yTop + 22 * scale, width * 0.68 * scale, height * 0.52 * scale, 8 * scale).fill({ color: kitData.palette.body })
    .roundRect(-shoulder * scale, yTop + 18 * scale, shoulder * 2 * scale, 13 * scale, 6 * scale).fill({ color: kitData.palette.secondary })
    .rect(-width * 0.28 * scale, yTop + 34 * scale, width * 0.56 * scale, 5 * scale).fill({ color: kitData.palette.accent, alpha: 0.72 });
  parts.head.clear()
    .circle(0, yTop + 10 * scale, 11 * scale).fill({ color: kitData.palette.skin })
    .circle(-4 * scale, yTop + 9 * scale, 1.6 * scale).fill({ color: kitData.palette.dark })
    .circle(4 * scale, yTop + 9 * scale, 1.6 * scale).fill({ color: kitData.palette.dark });
  parts.leftArm.clear().roundRect(-shoulder * scale - 6 * scale, yTop + 26 * scale, 10 * scale, 28 * scale, 5 * scale).fill({ color: kitData.palette.body });
  parts.rightArm.clear().roundRect(shoulder * scale - 4 * scale, yTop + 26 * scale, 10 * scale, 28 * scale, 5 * scale).fill({ color: kitData.palette.body });
}

function drawIdentity(parts, kitData, actorId, scale = 1) {
  const y = -kitData.silhouette.height * 0.68 * scale;
  const p = kitData.palette;
  if (actorId === 'bagholder-rusher') {
    parts.identity.roundRect(-15 * scale, y - 2 * scale, 30 * scale, 20 * scale, 9 * scale).stroke({ color: p.accent, width: 4 * scale });
    parts.identity.roundRect(11 * scale, y + 42 * scale, 15 * scale, 20 * scale, 4 * scale).fill({ color: 0x8e203b }).stroke({ color: p.accent, width: 2 * scale });
  } else if (actorId === 'forkrunner') {
    parts.identity.poly([-18, y + 28, 0, y + 40, 18, y + 28, 0, y + 58].map((value) => value * scale)).stroke({ color: p.accent, width: 3 * scale });
    parts.identity.moveTo(-23 * scale, (y + 42) * scale).lineTo(-36 * scale, (y + 63) * scale).lineTo(-25 * scale, (y + 58) * scale).stroke({ color: 0xd9fbff, width: 4 * scale });
    parts.identity.moveTo(23 * scale, (y + 42) * scale).lineTo(36 * scale, (y + 63) * scale).lineTo(25 * scale, (y + 58) * scale).stroke({ color: 0xd9fbff, width: 4 * scale });
  } else if (actorId === 'liquidator-agent') {
    parts.identity.roundRect(-13 * scale, (y + 4) * scale, 26 * scale, 7 * scale, 3 * scale).fill({ color: p.accent, alpha: 0.95 });
    parts.identity.roundRect(13 * scale, (y + 39) * scale, 30 * scale, 8 * scale, 3 * scale).fill({ color: p.dark }).stroke({ color: p.accent, width: 2 * scale });
  } else if (actorId === 'whale-enforcer') {
    parts.identity.circle(-30 * scale, (y + 30) * scale, 15 * scale).fill({ color: p.accent }).stroke({ color: 0xffe59b, width: 3 * scale });
    parts.identity.circle(30 * scale, (y + 30) * scale, 15 * scale).fill({ color: p.accent }).stroke({ color: 0xffe59b, width: 3 * scale });
    parts.identity.roundRect(-34 * scale, (y + 53) * scale, 68 * scale, 18 * scale, 8 * scale).fill({ color: p.dark });
  } else if (actorId === 'gas-bomber') {
    parts.identity.circle(0, (y + 8) * scale, 14 * scale).fill({ color: p.body }).stroke({ color: p.accent, width: 3 * scale });
    parts.identity.roundRect(-23 * scale, (y + 31) * scale, 9 * scale, 31 * scale, 4 * scale).fill({ color: p.accent });
    parts.identity.roundRect(14 * scale, (y + 31) * scale, 9 * scale, 31 * scale, 4 * scale).fill({ color: p.accent });
    parts.identity.circle(31 * scale, (y + 25) * scale, 7 * scale).fill({ color: 0xffd166 }).stroke({ color: p.accent, width: 2 * scale });
  } else if (actorId === 'validator-cultist') {
    parts.identity.poly([-17 * scale, (y + 14) * scale, 0, (y - 6) * scale, 17 * scale, (y + 14) * scale]).fill({ color: p.body }).stroke({ color: p.accent, width: 3 * scale });
    parts.identity.moveTo(27 * scale, (y + 22) * scale).lineTo(27 * scale, (y + 67) * scale).stroke({ color: 0xe3d5ff, width: 4 * scale });
    parts.identity.circle(27 * scale, (y + 16) * scale, 10 * scale).stroke({ color: p.accent, width: 4 * scale });
  } else if (actorId === 'the-liquidator') {
    parts.identity.poly([-20 * scale, (y + 2) * scale, -10 * scale, (y - 14) * scale, 0, (y + 0) * scale, 10 * scale, (y - 14) * scale, 20 * scale, (y + 2) * scale]).fill({ color: p.gold }).stroke({ color: 0xfff3b0, width: 2 * scale });
    parts.identity.poly([-6 * scale, (y + 30) * scale, 6 * scale, (y + 30) * scale, 3 * scale, (y + 70) * scale, -3 * scale, (y + 70) * scale]).fill({ color: p.accent });
    parts.identity.roundRect(-52 * scale, (y + 25) * scale, 22 * scale, 38 * scale, 8 * scale).fill({ color: p.dark }).stroke({ color: p.gold, width: 3 * scale });
    parts.identity.roundRect(30 * scale, (y + 25) * scale, 22 * scale, 38 * scale, 8 * scale).fill({ color: p.dark }).stroke({ color: p.gold, width: 3 * scale });
  }
}

function makeDisplay({ kitData, actorId, elite = false, scale = 1, ContainerClass, GraphicsClass }) {
  if (typeof ContainerClass !== 'function' || typeof GraphicsClass !== 'function') throw new TypeError('Pixi ContainerClass and GraphicsClass are required');
  const root = new ContainerClass();
  const poseLayer = new ContainerClass();
  const parts = {
    shadow: new GraphicsClass(),
    leftLeg: new GraphicsClass(),
    rightLeg: new GraphicsClass(),
    body: new GraphicsClass(),
    leftArm: new GraphicsClass(),
    rightArm: new GraphicsClass(),
    head: new GraphicsClass(),
    identity: new GraphicsClass(),
    elite: new GraphicsClass(),
    tell: new GraphicsClass(),
  };
  root.addChild(parts.shadow, poseLayer);
  poseLayer.addChild(parts.leftLeg, parts.rightLeg, parts.body, parts.leftArm, parts.rightArm, parts.head, parts.identity, parts.tell, parts.elite);
  drawBaseBody(parts, kitData, scale);
  drawIdentity(parts, kitData, actorId, scale);
  const width = kitData.silhouette.width * scale;
  const y = -kitData.silhouette.height * 0.68 * scale;
  parts.elite.circle(0, (y + 35 * scale), width * 0.72).stroke({ color: 0xfff06a, width: 4 * scale, alpha: 0.9 });
  parts.elite.poly([-10 * scale, (y - 3 * scale), 0, (y - 16 * scale), 10 * scale, (y - 3 * scale)]).fill({ color: 0xfff06a });
  parts.elite.visible = elite;
  root.label = actorId === 'the-liquidator' ? 'production-vector-liquidator-v1' : `production-vector-enemy-${actorId}`;
  root.productionActorId = actorId;
  root.productionAuthority = 'projection-only';
  root.eliteProjection = elite;
  root.applyPose = ({ state, tick, direction = 0, elite: poseElite = elite } = {}) => {
    const pose = actorId === 'the-liquidator'
      ? resolveBossPose({ state, tick, direction, elite: poseElite })
      : resolveEnemyProductionPose({ archetypeId: actorId, state, tick, direction, elite: poseElite });
    poseLayer.y = pose.bob * scale;
    poseLayer.rotation = pose.rotation;
    poseLayer.alpha = pose.alpha;
    parts.leftLeg.rotation = pose.stride;
    parts.rightLeg.rotation = -pose.stride;
    parts.leftArm.rotation = state === 'attack' ? -pose.recoil : state === 'tell' ? -0.18 : 0;
    parts.rightArm.rotation = state === 'attack' ? pose.recoil : state === 'tell' ? 0.18 : 0;
    for (const graphic of [parts.body, parts.head, parts.identity]) graphic.tint = pose.tint;
    parts.tell.clear();
    if (state === 'tell') parts.tell.circle(0, (y + 38 * scale), width * (0.62 + pose.tellPulse * 0.16)).stroke({ color: kitData.telegraphColor, width: 3 * scale, alpha: pose.tellPulse });
    parts.elite.visible = pose.eliteVisible;
    root.eliteProjection = pose.eliteVisible;
    root.visualState = state;
    return pose;
  };
  root.applyPose({ state: 'idle', tick: 0, direction: 0, elite });
  return root;
}

function resolveBossPose({ state, tick, direction, elite }) {
  const standIn = resolveEnemyProductionPose({ archetypeId: 'whale-enforcer', state, tick, direction, elite });
  return freezeDeep({ ...standIn, archetypeId: 'the-liquidator' });
}

export function createProductionEnemyDisplay({ archetypeId, elite = false, ContainerClass, GraphicsClass } = {}) {
  if (!Object.hasOwn(ENEMY_PRODUCTION_ART, archetypeId)) throw new TypeError(`Unknown production enemy: ${String(archetypeId)}`);
  return makeDisplay({ kitData: ENEMY_PRODUCTION_ART[archetypeId], actorId: archetypeId, elite, scale: 1, ContainerClass, GraphicsClass });
}

export function createLiquidatorProductionDisplay({ ContainerClass, GraphicsClass } = {}) {
  return makeDisplay({ kitData: LIQUIDATOR_PRODUCTION_ART, actorId: 'the-liquidator', elite: true, scale: 1, ContainerClass, GraphicsClass });
}
