import { getAuthoredRouteNodes } from './authored-world-layout.mjs';
import {
  buildLevelOneOpeningComposition,
  LEVEL_ONE_AUTHORED_PREFAB_STAMPS,
} from './hmh-level-one-visible-runtime.mjs';
import { HMH_LEVEL_ONE_ID } from './hmh-ground-selection.mjs';

const TOUR_ID = 'wo66-level-one-polish-acceptance-tour-v1';
const CHECK_CATEGORIES = Object.freeze(['readability', 'composition', 'navigation']);

function nearbyPrefabStamps(node, radius = 18) {
  return LEVEL_ONE_AUTHORED_PREFAB_STAMPS.filter((stamp) =>
    stamp.districtId === node.districtId
    || stamp.routeBeat === node.beat
    || Math.hypot(stamp.anchor.x - node.gridX, stamp.anchor.y - node.gridY) <= radius,
  );
}

function checksForNode(node, index) {
  const opening = index === 0 ? buildLevelOneOpeningComposition() : null;
  const stamps = nearbyPrefabStamps(node);
  const expectedAssetKeys = [...new Set([
    node.assetKey,
    ...(opening?.objects ?? []).map((object) => object.assetKey),
    ...stamps.flatMap((stamp) => stamp.assetKeys),
  ])];
  return Object.freeze({
    readability: Object.freeze([
      `${node.label}: player should understand the immediate objective before enemy density rises`,
      `Route beat '${node.beat}' needs visible silhouettes, not evenly scattered filler`,
      expectedAssetKeys.length ? `Expected cue keys visible or implied: ${expectedAssetKeys.slice(0, 5).join(', ')}` : 'Expected cue keys must be added before acceptance',
    ]),
    composition: Object.freeze([
      'Clear lane remains open through the player path; landmarks frame rather than cover the lane',
      stamps.length ? `${stamps.length} authored prefab stamp(s) support this camera` : 'No nearby prefab stamp: inspect for blank/under-authored composition',
      'Foreground/background contrast keeps enemies, pickups, and boss tells readable',
    ]),
    navigation: Object.freeze([
      `Camera target ${node.gridX},${node.gridY} should show the next route cue or boundary`,
      node.objective,
      'If the player pauses here, the safe forward direction should be legible within 2 seconds',
    ]),
  });
}

function punchListForStep(node, checks) {
  const items = [];
  if (!nearbyPrefabStamps(node).length) {
    items.push(Object.freeze({
      severity: 'medium',
      area: 'composition',
      routeBeat: node.beat,
      title: `${node.label} needs a nearby authored prefab stamp`,
      fix: 'Add an exact-key prefab stamp or move an existing stamp anchor into this route camera before final art lock.',
    }));
  }
  if (!checks.readability.some((text) => /Expected cue keys/.test(text))) {
    items.push(Object.freeze({
      severity: 'high',
      area: 'readability',
      routeBeat: node.beat,
      title: `${node.label} lacks concrete cue asset keys`,
      fix: 'Attach route signage, landmark, boundary, or lighting cue keys to the authored route beat.',
    }));
  }
  if (['chokepoint', 'boss', 'extract'].includes(node.beat)) {
    items.push(Object.freeze({
      severity: node.beat === 'boss' ? 'high' : 'medium',
      area: 'navigation',
      routeBeat: node.beat,
      title: `${node.label} requires manual visual acceptance after render-stability gates`,
      fix: 'Run the browser tour, verify route direction, silhouette safety, enemy readability, and capture a note/screenshot if unclear.',
    }));
  }
  return items;
}

export function buildLevelOnePolishAcceptanceTour() {
  const route = getAuthoredRouteNodes(HMH_LEVEL_ONE_ID);
  const steps = route.map((node, index) => {
    const checks = checksForNode(node, index);
    const punchList = punchListForStep(node, checks);
    return Object.freeze({
      index,
      routeId: node.id,
      routeBeat: node.beat,
      label: node.label,
      districtId: node.districtId,
      camera: Object.freeze({ playerX: node.gridX, playerY: node.gridY, window: 18 }),
      objective: node.objective,
      expectedAssetKeys: Object.freeze([...new Set([
        node.assetKey,
        ...nearbyPrefabStamps(node).flatMap((stamp) => stamp.assetKeys),
      ])]),
      checks,
      punchList: Object.freeze(punchList),
    });
  });
  const punchList = steps.flatMap((step) => step.punchList.map((item) => Object.freeze({ ...item, routeId: step.routeId, label: step.label })));
  return Object.freeze({
    id: TOUR_ID,
    levelId: HMH_LEVEL_ONE_ID,
    purpose: 'camera-by-camera Level 1 polish acceptance for readability, composition, and navigation after render stability gates',
    checkCategories: CHECK_CATEGORIES,
    steps: Object.freeze(steps),
    punchList: Object.freeze(punchList),
    summary: Object.freeze({
      totalSteps: steps.length,
      routeCoverage: Object.freeze(steps.map((step) => step.routeBeat)),
      punchListCount: punchList.length,
      requiresBrowserTour: true,
      requiredCommands: Object.freeze(['npm run visual:regression', 'MSYS_NO_PATHCONV=1 npm run smoke:portal:interactions']),
    }),
  });
}

export function renderLevelOnePolishAcceptanceMarkdown(tour = buildLevelOnePolishAcceptanceTour()) {
  const lines = [
    '# Hard Money Heroes Level 1 Polish Acceptance Tour',
    '',
    `- Tour ID: \`${tour.id}\``,
    `- Level: \`${tour.levelId}\``,
    `- Scope: ${tour.purpose}`,
    `- Steps: ${tour.summary.totalSteps}`,
    `- Open punch-list items: ${tour.summary.punchListCount}`,
    '',
    '## Acceptance Steps',
    '',
    '| # | beat | camera | acceptance focus | expected cues |',
    '|---:|---|---|---|---|',
  ];
  for (const step of tour.steps) {
    lines.push(`| ${step.index + 1} | ${step.routeBeat} / ${step.label} | ${step.camera.playerX},${step.camera.playerY} ±${step.camera.window} | ${step.checks.readability[0]} ${step.checks.navigation[2]} | ${step.expectedAssetKeys.slice(0, 4).map((key) => `\`${key}\``).join('<br>')} |`);
  }
  lines.push('', '## Punch List', '');
  if (!tour.punchList.length) {
    lines.push('- No open punch-list items.');
  } else {
    lines.push('| severity | area | beat | finding | fix |', '|---|---|---|---|---|');
    for (const item of tour.punchList) {
      lines.push(`| ${item.severity} | ${item.area} | ${item.routeBeat} | ${item.title} | ${item.fix} |`);
    }
  }
  lines.push('', '## Verification Commands', '');
  for (const command of tour.summary.requiredCommands) lines.push(`- \`${command}\``);
  lines.push('', '## Manual Browser Tour Notes', '', '- Run after major art/layout changes; attach screenshots or notes to any punch-list item that remains unclear.');
  return `${lines.join('\n')}\n`;
}
