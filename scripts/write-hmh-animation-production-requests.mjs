import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  buildHardMoneyHeroesAnimationCoverageReport,
  buildHardMoneyHeroesAnimationProductionBriefs,
} from '../apps/portal/src/arcade-core.mjs';

const outputDir = fileURLToPath(new URL('../docs/game-design', import.meta.url));
const actorDir = `${outputDir}/hard-money-heroes-animation-production-requests`;
const indexMdPath = `${outputDir}/hard-money-heroes-animation-production-requests.md`;
const indexJsonPath = `${outputDir}/hard-money-heroes-animation-production-requests.json`;

const actorOrder = ['lester', 'lilly', 'trenchDegen', 'evilBanker', 'warrenSpearRider'];

const actorProfiles = {
  lester: {
    key: 'lester',
    slug: 'lester',
    title: 'Lester',
    role: 'playable hero',
    silhouette: 'scrappy retro arcade hero, readable right-facing profile, confident but not over-polished',
    paletteNotes: 'match current Lester production frames; keep the Litecoin/arcade palette accents consistent',
    motionNotes: 'snappy 8-to-12-bit arcade timing with clear anticipation, action, recovery poses',
  },
  lilly: {
    key: 'lilly',
    slug: 'lilly',
    title: 'Lilly',
    role: 'alternate playable hero',
    silhouette: 'nimble alternate hero silhouette, same hitbox readability as Lester, distinct from Lester at a glance',
    paletteNotes: 'match current Lilly frames; keep her silhouette and accent colors readable against desert/city backgrounds',
    motionNotes: 'slightly quicker-feeling anticipation while preserving identical gameplay timing and fairness',
  },
  trenchDegen: {
    key: 'trenchDegen',
    slug: 'trench-degen',
    title: 'Trench Degen',
    role: 'slow readable melee/ranged enemy',
    silhouette: 'ragged trench-coat enemy with chunky arcade menace, slower posture, obvious wind-up shapes',
    paletteNotes: 'dusty trench neutrals with readable hostile accents; separate from cover props and desert terrain',
    motionNotes: 'large telegraphs and delayed recovery so AI feels fair, not random',
  },
  evilBanker: {
    key: 'evilBanker',
    slug: 'evil-banker',
    title: 'Evil Banker',
    role: 'fast briefcase melee rusher enemy',
    silhouette: 'sharp banker/rusher silhouette with briefcase weapon readable in a side-scroller lane',
    paletteNotes: 'dark suit contrast with bright attack accents; keep briefcase and face readable at small scale',
    motionNotes: 'faster attack anticipation than Trench Degen, but still has an unmistakable pre-hit tell',
  },
  warrenSpearRider: {
    key: 'warrenSpearRider',
    slug: 'warren-spear-rider',
    title: 'Warren Spear Rider',
    role: 'mini-boss / spear-rider threat',
    silhouette: 'tall spear-forward rider silhouette with boss-like posture, long weapon arc, strong lane threat',
    paletteNotes: 'strong warm/cool contrast so spear tip, mount/ride posture, and body remain separable in motion',
    motionNotes: 'bigger anticipation arcs, clear spear lane, longer recovery poses for fair tactical dodging',
  },
};

const sharedStyle = {
  game: 'Hard Money Heroes inside Lester\'s Arcade',
  format: 'transparent PNG frames or Aseprite sheet tag ready for manifest ingestion',
  camera: '2D side-view browser canvas, player generally faces right',
  pixelRules: [
    'crisp pixel art, no antialias blur, no painterly smear',
    'consistent sprite proportions with the existing runtime frames',
    'clean transparent background, no baked scenery, no UI text inside sprites',
    'readable at 128px canvas scale and still clear when scaled up in the browser',
    'include anticipation, contact/action, and recovery silhouettes when the state implies impact',
  ],
  noPlaceholderPolicy: 'Do not generate shipping placeholder sprites. These requests are production art direction and manifest requirements only.',
  negativePrompt: [
    'photorealistic rendering',
    '3D model render',
    'smooth vector art',
    'anime illustration sheet with anti-aliased outlines',
    'muddy palette',
    'tiny unreadable limbs',
    'background scenery baked into frames',
    'watermark',
    'caption text',
    'logo text',
    'UI elements',
    'different character design from existing Hard Money Heroes assets',
    'extra weapons not requested by the animation state',
  ].join(', '),
};

function sentenceCase(text) {
  return String(text)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actorFromBrief(key, brief) {
  return actorProfiles[key] ?? {
    key,
    slug: brief.id ?? key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`),
    title: brief.title ?? sentenceCase(key),
    role: brief.requests?.[0]?.actorType ?? 'actor',
    silhouette: 'readable arcade side-view silhouette',
    paletteNotes: 'match current Hard Money Heroes production palette',
    motionNotes: 'clear anticipation, action, and recovery timing',
  };
}

function buildPositivePrompt(actor, request, brief) {
  const purpose = request.readabilityGoal ?? request.aiPurpose ?? 'make the animation state readable during fast arcade gameplay';
  const behavior = request.behavior
    ? ` AI behavior context: ${Object.entries(request.behavior).map(([key, value]) => `${key}=${value}`).join(', ')}.`
    : '';
  const stillContext = brief.stillCoveredStates?.length
    ? ` Existing still-covered states to upgrade without changing identity: ${brief.stillCoveredStates.join(', ')}.`
    : '';
  return [
    `${sharedStyle.game} production pixel-art animation request for ${actor.title}, ${actor.role}.`,
    `Create ${request.frameCount} frames for the "${request.state}" state, manifest tag "${request.manifestState}".`,
    `Character read: ${actor.silhouette}.`,
    `Palette/readability: ${actor.paletteNotes}.`,
    `Motion direction: ${actor.motionNotes}.`,
    `Gameplay purpose: ${purpose}.${behavior}${stillContext}`,
    `Frame language: ${sharedStyle.pixelRules.join('; ')}.`,
    `Delivery: ${request.delivery}.`,
  ].join(' ');
}

function normalizeActorRequest(key, brief) {
  const actor = actorFromBrief(key, brief);
  const requests = (brief.requests ?? []).map((request, index) => ({
    order: index + 1,
    id: request.id,
    actorKey: actor.key,
    actorTitle: actor.title,
    actorSlug: actor.slug,
    actorRole: actor.role,
    state: request.state,
    manifestState: request.manifestState,
    priority: request.priority,
    frameCount: request.frameCount,
    readabilityGoal: request.readabilityGoal ?? request.aiPurpose,
    delivery: request.delivery,
    prompt: buildPositivePrompt(actor, request, brief),
    negativePrompt: sharedStyle.negativePrompt,
    checklist: [
      `${request.frameCount} distinct frames for ${request.manifestState}`,
      'transparent background in every frame',
      'right-facing side-view alignment unless the existing sheet requires mirrored variants',
      'same baseline/feet position as current runtime actor frames where applicable',
      'state is readable before adding particles, gore, or hit flashes',
      'Do not generate shipping placeholder sprites; mark draft/test frames clearly if used internally',
    ],
  }));

  return {
    key: actor.key,
    slug: actor.slug,
    title: actor.title,
    role: actor.role,
    currentAnimatedStates: brief.currentAnimatedStates ?? [],
    stillCoveredStates: brief.stillCoveredStates ?? [],
    requestCount: requests.length,
    requests,
  };
}

function actorMarkdown(actor) {
  const lines = [
    `# ${actor.title} Animation Production Requests`,
    '',
    `Role: ${actor.role}`,
    '',
    `Generated by \`npm run design:animation-prompts\`.`,
    '',
    '## Existing Coverage',
    '',
    `- Current animated states: ${actor.currentAnimatedStates.join(', ') || 'none'}`,
    `- Still-covered states: ${actor.stillCoveredStates.join(', ') || 'none'}`,
    `- New requested states: ${actor.requests.map((request) => request.state).join(', ') || 'covered'}`,
    '',
    '## Shared Delivery Rules',
    '',
    `- Format: ${sharedStyle.format}`,
    `- Camera: ${sharedStyle.camera}`,
    `- Placeholder policy: ${sharedStyle.noPlaceholderPolicy}`,
    '- Pixel rules:',
    ...sharedStyle.pixelRules.map((rule) => `  - ${rule}`),
    '',
    '## Requests',
    '',
  ];

  for (const request of actor.requests) {
    lines.push(
      `### ${request.order}. ${sentenceCase(request.state)} — ${request.frameCount} frames`,
      '',
      `- Manifest tag: \`${request.manifestState}\``,
      `- Priority: ${request.priority}`,
      `- Purpose/readability: ${request.readabilityGoal}`,
      `- Delivery: ${request.delivery}`,
      '',
      '**Production prompt**',
      '',
      '```text',
      request.prompt,
      '```',
      '',
      '**Negative prompt**',
      '',
      '```text',
      request.negativePrompt,
      '```',
      '',
      '**Acceptance checklist**',
      '',
      ...request.checklist.map((item) => `- ${item}`),
      '',
    );
  }

  while (lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

const coverage = buildHardMoneyHeroesAnimationCoverageReport();
const briefs = buildHardMoneyHeroesAnimationProductionBriefs(coverage);
const actors = [];

for (const key of actorOrder) {
  const brief = briefs.heroes[key] ?? briefs.enemies[key];
  if (!brief) continue;
  actors.push(normalizeActorRequest(key, brief));
}

const index = {
  title: 'Hard Money Heroes Animation Production Requests',
  generatedBy: 'npm run design:animation-prompts',
  placeholderPolicy: sharedStyle.noPlaceholderPolicy,
  summary: {
    heroRequestCount: briefs.summary.heroRequestCount,
    enemyRequestCount: briefs.summary.enemyRequestCount,
    totalRequestCount: briefs.summary.totalRequestCount,
    actorCount: actors.length,
  },
  sharedStyle,
  actors,
};

const indexMarkdown = [
  '# Hard Money Heroes Animation Production Requests',
  '',
  'Generated by `npm run design:animation-prompts`.',
  '',
  'These are production request docs/prompts for the missing character and enemy animation states. They are not placeholder art and should not be treated as shippable sprites until real frames are delivered, ingested, and verified.',
  '',
  '## Summary',
  '',
  `- Actors covered: ${index.summary.actorCount}`,
  `- Hero animation requests: ${index.summary.heroRequestCount}`,
  `- Enemy animation requests: ${index.summary.enemyRequestCount}`,
  `- Total animation requests: ${index.summary.totalRequestCount}`,
  `- Placeholder policy: ${index.placeholderPolicy}`,
  '',
  '## Actor Docs',
  '',
  ...actors.map((actor) => `- [${actor.title}](hard-money-heroes-animation-production-requests/${actor.slug}.md): ${actor.requestCount} request(s) — ${actor.requests.map((request) => request.state).join(', ') || 'covered'}`),
  '',
  '## Shared Negative Prompt',
  '',
  '```text',
  sharedStyle.negativePrompt,
  '```',
  '',
  '## Workflow',
  '',
  '1. Give the relevant actor doc to the artist or image-generation workflow.',
  '2. Produce transparent PNG frames or an Aseprite sheet tag matching the manifest state names.',
  '3. Ingest the delivered frames into the Hard Money Heroes manifest.',
  '4. Run `npm run design:audit`, `npm run assets:verify`, and `npm run verify:full` before treating frames as production-ready.',
  '5. Do not merge placeholder animation into the playable runtime unless it is clearly marked dev-only.',
  '',
].join('\n');

await mkdir(actorDir, { recursive: true });
await writeFile(indexJsonPath, `${JSON.stringify(index, null, 2)}\n`);
await writeFile(indexMdPath, indexMarkdown);

for (const actor of actors) {
  await writeFile(`${actorDir}/${actor.slug}.md`, actorMarkdown(actor));
  await writeFile(`${actorDir}/${actor.slug}.json`, `${JSON.stringify(actor, null, 2)}\n`);
}

console.log('Animation production requests written.');
console.log(indexMdPath);
console.log(indexJsonPath);
for (const actor of actors) console.log(`${actor.title}: ${actor.requestCount} request(s)`);
