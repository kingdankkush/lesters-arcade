import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const HMH_ANCHOR_SET_STATUS = Object.freeze({
  workOrder: 'WO-76',
  status: 'PARTIAL_ANCHOR_APPROVAL_1_OF_10',
  runtimeIntegrationAllowed: false,
  requiresHumanApproval: true,
  candidateSheetAllowed: true,
  approvedAnchorCount: 1,
  note: 'No WO-76 anchor may become the pipeline style source until Justin approves the slot winner.',
});

const TARGET_CANDIDATE_COUNT = Object.freeze({ min: 12, max: 20 });

export const HMH_ANCHOR_SLOTS = Object.freeze([
  Object.freeze({
    id: 'storefront-facade',
    title: 'Storefront facade',
    bar: 'building bar',
    brief: 'Noodle bar facade with neon, steam vent detail, wet noir street read, no text/logos.',
    relevantSourceKinds: Object.freeze(['building', 'facade', 'landmark']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'bank-deco-corner',
    title: 'Bank-district Deco corner facade',
    bar: 'landmark bar',
    brief: 'Art Deco financial corner facade, brass/silver/Litecoin blue, night-city rim light.',
    relevantSourceKinds: Object.freeze(['building', 'landmark', 'financial']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'signature-street-tree',
    title: 'Signature street tree',
    bar: 'vegetation bar',
    brief: 'Night-lit street tree in planter with neon spill and a distinct silhouette.',
    relevantSourceKinds: Object.freeze(['tree', 'vegetation', 'planter']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'wet-asphalt-ground-family',
    title: 'Wet-asphalt ground family',
    bar: 'ground bar',
    brief: 'Seamless wet asphalt base plus two wear variants; painterly dense noir ground.',
    relevantSourceKinds: Object.freeze(['ground', 'terrain', 'road']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'streetlamp-light-cone',
    title: 'Streetlamp + pooled light cone prop',
    bar: 'lighting-in-sprite bar',
    brief: 'Streetlamp sprite with baked cone/pool of light, top-left key plus local neon rim.',
    relevantSourceKinds: Object.freeze(['lamp', 'light', 'prop']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'lit-commando-idle-key-pose',
    title: 'Lit Commando repaint, idle key pose',
    bar: 'hero bar',
    brief: 'Current chunky-head hero quality preserved/elevated; no restyle, single idle key pose.',
    relevantSourceKinds: Object.freeze(['hero', 'character']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'highest-spawn-enemy-redesign',
    title: 'One enemy full redesign',
    bar: 'enemy bar',
    brief: 'Highest-spawn-weight enemy archetype, key pose plus attack-tell pose, fiat corruption language.',
    relevantSourceKinds: Object.freeze(['enemy', 'character']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'major-boss-key-pose',
    title: 'Major boss key pose',
    bar: 'boss bar',
    brief: 'Major boss at true boss scale; readable event-scale silhouette and phase-ready identity.',
    relevantSourceKinds: Object.freeze(['boss', 'character']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'micro-scene-composition',
    title: 'Micro-scene composition',
    bar: 'storytelling bar',
    brief: 'Tipped delivery cart, spilled crates, rat: authored 2-4 prop story composition.',
    relevantSourceKinds: Object.freeze(['micro-scene', 'setpiece', 'prop']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
  Object.freeze({
    id: 'ui-chrome-sample',
    title: 'UI chrome sample',
    bar: 'interface bar',
    brief: 'Draft card frame plus HP bar segment, retro-arcade-Deco, not script-placeholder chrome.',
    relevantSourceKinds: Object.freeze(['ui', 'chrome']),
    targetCandidateCount: TARGET_CANDIDATE_COUNT,
  }),
]);

export const HMH_ANCHOR_SOURCE_POLICIES = Object.freeze({
  placeholderPacksAllowedAsAnchorCandidates: false,
  rawGenerationRepoPolicy: 'raw outputs stay in the vault/staging; only approved winners, manifests, provenance, QA reports, and contact sheets enter git',
  toolVerdict: 'Use the existing noir ground bake-off verdict: repo final-paint/post-process first; use PixelLab or ComfyUI only for failures or uncovered categories after approval.',
  placeholderScriptDenylist: Object.freeze([
    'generate-hmh-pickup-icons.py',
    'generate-hmh-vfx-ui-chrome.py',
    'generate-hmh-level-one-authored-stamp-art.py',
    'generate-hmh-achievement-atlas.py',
  ]),
});

const CANDIDATE_SOURCES = Object.freeze([
  Object.freeze({
    id: 'hmh-production-art-pass',
    label: 'HMH production art pass',
    kind: 'real-generation',
    tool: 'PixelLab + derivative animation pass',
    manifest: 'apps/portal/assets/generated/hmh-production-art-pass/hmh-production-art-pass.mjs',
    contactSheet: 'apps/portal/assets/generated/hmh-isometric-pixellab/contact-sheets/hmh-isometric-pixellab-wave-1-contact-sheet.png',
    reason: 'Fable Rev 2 explicitly calls this genuine generated art and requires auditing it as candidate input.',
  }),
  Object.freeze({
    id: 'pixellab-calibration',
    label: 'PixelLab Lester calibration',
    kind: 'real-generation',
    tool: 'PixelLab MCP/API',
    manifest: 'apps/portal/assets/generated/pixellab-calibration/lester-hero-6d6e53e2/manifest.json',
    contactSheet: 'apps/portal/assets/generated/pixellab-calibration/lester-hero-6d6e53e2/hmh-pixellab-lester-calibration-contact-sheet.png',
    reason: 'Fable Rev 2 calls this genuine generated art; useful for the hero bar and prompt provenance.',
  }),
  Object.freeze({
    id: 'level-one-final-paint-ground',
    label: 'Level 1 final-paint ground',
    kind: 'repo-owned-final-paint',
    tool: 'repo final-paint/post-process',
    manifest: 'apps/portal/assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.json',
    contactSheet: 'docs/game-design/assets/hmh-level-1-final-paint-ground-contact-sheet.png',
    reason: 'Matches the bake-off speed verdict for zero-credit ground candidates.',
  }),
  Object.freeze({
    id: 'level-two-final-city',
    label: 'Level 2 final city world art',
    kind: 'repo-owned-generated-world-art',
    tool: 'repo-owned generated spritesheet pass',
    manifest: 'apps/portal/assets/generated/hmh-coherent-world/level2-final-city/level2-final-city-manifest.json',
    contactSheet: 'docs/game-design/assets/hmh-level2-final-city-contact-sheet.png',
    reason: 'Best current city/noir-ish authored world-art pool for facade/lamp/landmark seed candidates.',
  }),
  Object.freeze({
    id: 'final-setpiece-kit',
    label: 'Final setpiece kit',
    kind: 'repo-owned-generated-setpiece-art',
    tool: 'repo-owned generated setpiece pass',
    manifest: 'apps/portal/assets/generated/hmh-final-setpiece-kit/hmh-final-setpiece-kit-manifest.json',
    contactSheet: 'docs/game-design/assets/hmh-final-setpiece-kit-contact-sheet.png',
    reason: 'Useful seed pool for tree, lamp, prop, and micro-scene composition bars.',
  }),
]);

const EXISTING_SLOT_CANDIDATES = Object.freeze({
  'storefront-facade': Object.freeze([
    candidate('level-two-final-city', 'level2-final-city/chrome-tower-facade', 'apps/portal/assets/generated/hmh-coherent-world/level2-final-city/chrome-tower-facade.png', 'Closest existing city facade seed; needs noodle-bar/neon/steam rerolls.'),
  ]),
  'bank-deco-corner': Object.freeze([
    candidate('level-two-final-city', 'level2-final-city/ltc-monument-fountain', 'apps/portal/assets/generated/hmh-coherent-world/level2-final-city/ltc-monument-fountain.png', 'Financial district material/lighting seed; not yet a corner facade.'),
    candidate('level-two-final-city', 'level2-final-city/chrome-tower-facade', 'apps/portal/assets/generated/hmh-coherent-world/level2-final-city/chrome-tower-facade.png', 'Best existing bank-tower surface seed.'),
  ]),
  'signature-street-tree': Object.freeze([
    candidate('final-setpiece-kit', 'level-final-setpiece/pine-wall-shadow', 'apps/portal/assets/generated/hmh-coherent-world/level-final-setpiece/pine-wall-shadow.png', 'Existing vegetation silhouette seed; not yet a city planter tree.'),
  ]),
  'wet-asphalt-ground-family': Object.freeze([
    candidate('level-one-final-paint-ground', 'final-paint/road-asphalt-handpaint-01', 'apps/portal/assets/generated/hmh-level-one-ground/final-paint/road-asphalt-handpaint-01.png', 'Zero-credit final-paint asphalt seed from the bake-off-preferred path.'),
  ]),
  'streetlamp-light-cone': Object.freeze([
    candidate('level-two-final-city', 'level2-final-city/plaza-streetlight-line', 'apps/portal/assets/generated/hmh-coherent-world/level2-final-city/plaza-streetlight-line.png', 'Best existing streetlight seed; needs single-prop light-pool version.'),
    candidate('final-setpiece-kit', 'level-final-setpiece/lantern-string', 'apps/portal/assets/generated/hmh-coherent-world/level-final-setpiece/lantern-string.png', 'Lighting mood seed for local glow language.'),
  ]),
  'lit-commando-idle-key-pose': Object.freeze([
    candidate('hmh-production-art-pass', 'lester-iso-hero idle frame 00', 'apps/portal/assets/generated/hmh-production-art-pass/characters/lester-iso-hero/idle/frame-00.png', 'Current hero-quality seed; must preserve chunky-head hero proportions.'),
    candidate('pixellab-calibration', 'lester calibration east rotation', 'apps/portal/assets/generated/pixellab-calibration/lester-hero-6d6e53e2/rotations/east.png', 'PixelLab prompt/provenance seed for hero bar.'),
  ]),
  'highest-spawn-enemy-redesign': Object.freeze([
    candidate('hmh-production-art-pass', 'evil-banker-ranged idle frame 00', 'apps/portal/assets/generated/hmh-production-art-pass/characters/evil-banker-ranged/idle/frame-00.png', 'Readable enemy seed; still requires highest-spawn-weight confirmation and redesign brief.'),
    candidate('hmh-production-art-pass', 'trench-degen-chaser idle frame 00', 'apps/portal/assets/generated/hmh-production-art-pass/characters/trench-degen-chaser/idle/frame-00.png', 'Alternate enemy seed for silhouette/faction review.'),
  ]),
  'major-boss-key-pose': Object.freeze([
    candidate('hmh-production-art-pass', 'chain-reaper-boss idle frame 00', 'apps/portal/assets/generated/hmh-production-art-pass/characters/chain-reaper-boss/idle/frame-00.png', 'Existing boss seed; likely underscaled vs true WO-76 boss bar.'),
    candidate('hmh-production-art-pass', 'bit-whale-boss idle frame 00', 'apps/portal/assets/generated/hmh-production-art-pass/characters/bit-whale-boss/idle/frame-00.png', 'Existing major boss seed for scale/identity comparison.'),
  ]),
  'micro-scene-composition': Object.freeze([
    candidate('final-setpiece-kit', 'level-final-setpiece/wagon-circle', 'apps/portal/assets/generated/hmh-coherent-world/level-final-setpiece/wagon-circle.png', 'Compositional setpiece seed; not the required delivery-cart/crates/rat micro-scene.'),
  ]),
  'ui-chrome-sample': Object.freeze([]),
});

function candidate(sourceId, label, src, notes) {
  return Object.freeze({ sourceId, label, src, notes });
}

function normalizeRepoPath(repoPath) {
  return repoPath.replaceAll('\\', '/');
}

function pathExists(repoPath) {
  return existsSync(path.join(ROOT, repoPath));
}

function readJsonIfPresent(repoPath) {
  const fullPath = path.join(ROOT, repoPath);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}

export function buildAnchorCandidateAudit() {
  const candidateSources = CANDIDATE_SOURCES.map((source) => Object.freeze({
    ...source,
    manifestExists: pathExists(source.manifest),
    contactSheetExists: source.contactSheet ? pathExists(source.contactSheet) : false,
  }));

  const slots = HMH_ANCHOR_SLOTS.map((slot) => {
    const existingCandidates = (EXISTING_SLOT_CANDIDATES[slot.id] ?? []).map((entry) => Object.freeze({
      ...entry,
      src: normalizeRepoPath(entry.src),
      exists: pathExists(entry.src),
    }));
    const generationDeficit = Math.max(0, slot.targetCandidateCount.min - existingCandidates.length);
    return Object.freeze({
      id: slot.id,
      title: slot.title,
      bar: slot.bar,
      brief: slot.brief,
      targetCandidateCount: slot.targetCandidateCount,
      existingCandidates: Object.freeze(existingCandidates),
      generationDeficit,
      status: existingCandidates.length === 0 ? 'needs-generation' : 'seeded-needs-generation',
    });
  });

  return Object.freeze({
    workOrder: HMH_ANCHOR_SET_STATUS.workOrder,
    status: HMH_ANCHOR_SET_STATUS.status,
    runtimeIntegrationAllowed: HMH_ANCHOR_SET_STATUS.runtimeIntegrationAllowed,
    generatedAt: new Date(0).toISOString(),
    sourcePolicy: HMH_ANCHOR_SOURCE_POLICIES,
    candidateSources: Object.freeze(candidateSources),
    placeholderDebt: Object.freeze(buildPlaceholderDebt()),
    slots: Object.freeze(slots),
    manifestFacts: Object.freeze({
      levelOneFinalPaintGround: readJsonIfPresent('apps/portal/assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.json')?.assetCount ?? null,
      levelTwoFinalCity: readJsonIfPresent('apps/portal/assets/generated/hmh-coherent-world/level2-final-city/level2-final-city-manifest.json')?.assetCount ?? null,
      finalSetpieceKit: readJsonIfPresent('apps/portal/assets/generated/hmh-final-setpiece-kit/hmh-final-setpiece-kit-manifest.json')?.assetCount ?? null,
    }),
  });
}

function buildPlaceholderDebt() {
  return Object.freeze(HMH_ANCHOR_SOURCE_POLICIES.placeholderScriptDenylist.map((script) => Object.freeze({
    script,
    anchorCandidateEligible: false,
    disposition: 'WO-90 redo queue; scaffolding only until regenerated through approved anchors',
  })));
}

function markdownImage(candidateEntry) {
  if (!candidateEntry?.src) return '';
  return `![${candidateEntry.label}](${path.posix.relative('docs/art', candidateEntry.src).replaceAll(' ', '%20')})`;
}

export function renderAnchorCandidateAuditMarkdown(audit = buildAnchorCandidateAudit()) {
  const lines = [];
  lines.push('# WO-76 AI Anchor Set Candidate Audit');
  lines.push('');
  lines.push('**HALT: Justin approval required before any anchor is committed as approved or used for runtime integration.**');
  lines.push('');
  lines.push(`- Work order: ${audit.workOrder}`);
  lines.push(`- Status: ${audit.status}`);
  lines.push(`- Runtime integration allowed: ${audit.runtimeIntegrationAllowed}`);
  lines.push(`- Tool verdict: ${audit.sourcePolicy.toolVerdict}`);
  lines.push('');
  lines.push('## Candidate source pools audited');
  lines.push('');
  lines.push('| Source | Kind | Tool | Manifest | Contact sheet | Reason |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const source of audit.candidateSources) {
    lines.push(`| ${source.label} | ${source.kind} | ${source.tool} | ${source.manifestExists ? 'present' : 'missing'} | ${source.contactSheetExists ? 'present' : 'missing'} | ${source.reason} |`);
  }
  lines.push('');
  lines.push('## Slot contact-sheet audit');
  lines.push('');
  for (const slot of audit.slots) {
    lines.push(`### ${slot.id} — ${slot.title}`);
    lines.push('');
    lines.push(`- Bar: ${slot.bar}`);
    lines.push(`- Brief: ${slot.brief}`);
    lines.push(`- Status: ${slot.status}`);
    lines.push(`- Existing viable seed candidates: ${slot.existingCandidates.length}`);
    lines.push(`- Generation deficit to minimum ${slot.targetCandidateCount.min}: ${slot.generationDeficit}`);
    lines.push('');
    if (slot.existingCandidates.length) {
      lines.push('| Preview | Candidate | Source | Exists | Notes |');
      lines.push('| --- | --- | --- | ---: | --- |');
      for (const entry of slot.existingCandidates) {
        lines.push(`| ${markdownImage(entry)} | ${entry.label} | ${entry.sourceId} | ${entry.exists ? 'yes' : 'no'} | ${entry.notes} |`);
      }
    } else {
      lines.push('_No existing real-generation candidate is eligible for this slot; generate the full 12–20 candidate batch after prompt/tool approval._');
    }
    lines.push('');
  }
  lines.push('## Placeholder packs excluded from anchors');
  lines.push('');
  lines.push('| Script | Anchor candidate eligible | Disposition |');
  lines.push('| --- | ---: | --- |');
  for (const entry of audit.placeholderDebt) {
    lines.push(`| ${entry.script} | ${entry.anchorCandidateEligible ? 'yes' : 'no'} | ${entry.disposition} |`);
  }
  lines.push('');
  lines.push('## Next approval gate');
  lines.push('');
  lines.push('Generate or collect 12–20 candidates per slot, machine-filter them, then present numbered contact sheets. Do not integrate winners until Justin picks one winner per slot or orders rerolls.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}
