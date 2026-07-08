import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACHIEVEMENT_LIST,
  LESTER_ARCADE_BRAND_SYSTEM,
  LESTER_BLASTER_POWER_UPS,
} from '../apps/portal/src/arcade-core.mjs';
import { HMH_FINAL_COMBAT_VFX_PACK } from '../apps/portal/assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';
import { HMH_PICKUP_ICON_PACK } from '../apps/portal/assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs';
import { HMH_ACHIEVEMENT_ATLAS } from '../apps/portal/assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs';
import { HMH_VFX_UI_CHROME_PACK } from '../apps/portal/assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs';
import { buildGlobalArtCensus } from './global-art-census.mjs';

const ORIGINAL_POLICY = 'Original repo-owned pixel art only; no downloaded pixels copied; manifest-backed before runtime use.';

const PICKUP_PRIORITY_BY_RARITY = Object.freeze({
  common: 'P1',
  uncommon: 'P1',
  rare: 'P0',
  'super-rare': 'P0',
});

const VFX_REQUIRED_RUNTIME_ROLES = Object.freeze([
  'muzzle-flash-pistol',
  'muzzle-flash-rail',
  'hit-spark-metal',
  'hit-spark-flesh',
  'shell-casing-brass',
  'coin-pickup-pop',
  'grenade-explosion-ring',
  'death-dust-burst',
  'gore-pixel-splatter',
  'level-up-burst',
]);

const VFX_MISSING_REDO_ITEMS = Object.freeze([
  Object.freeze({
    runtimeId: 'achievement-unlock-burst',
    title: 'Achievement unlock burst',
    status: 'missing-spritesheet',
    priority: 'P0',
    reason: 'Achievements currently rely on text/emoji badges; unlock moments need a reusable readable sprite burst.',
  }),
  Object.freeze({
    runtimeId: 'pickup-rarity-beams',
    title: 'Pickup rarity beams',
    status: 'missing-spritesheet',
    priority: 'P1',
    reason: 'Rare and super-rare pickups should read before the player reaches them without noisy full-screen effects.',
  }),
  Object.freeze({
    runtimeId: 'ui-confirm-spark',
    title: 'UI confirm spark',
    status: 'missing-spritesheet',
    priority: 'P1',
    reason: 'Menus and official-run confirmations need a small shared pixel flourish instead of ad-hoc CSS glow only.',
  }),
]);

const UI_CHROME_REDO_ITEMS = Object.freeze([
  Object.freeze({ runtimeId: 'combat-hud-frame', title: 'Combat HUD frame and stat chips', priority: 'P0', status: 'redo-css-plus-sprite-border', reason: 'HUD should read as a diegetic arcade overlay without covering Level 1 combat space.' }),
  Object.freeze({ runtimeId: 'level-up-card-frame', title: 'Level-up / upgrade card frame', priority: 'P0', status: 'handoff-to-wo-40', reason: 'Upgrade cards are gameplay critical and need consistent rarity/category chrome.' }),
  Object.freeze({ runtimeId: 'achievement-toast-frame', title: 'Achievement toast frame', priority: 'P0', status: 'needs-spritesheet', reason: 'Profile/on-chain accomplishments should have a unique badge reveal language.' }),
  Object.freeze({ runtimeId: 'minimap-frame', title: 'Finite-map minimap frame', priority: 'P1', status: 'needs-sprite-border', reason: 'WO-21 minimap exists; its frame should match the arcade-LitVM HUD language.' }),
  Object.freeze({ runtimeId: 'wallet-ranked-badges', title: 'Wallet/ranked/testnet status badges', priority: 'P1', status: 'needs-icon-atlas', reason: 'Web3 state must be legible without long copy blocks during the run flow.' }),
  Object.freeze({ runtimeId: 'mobile-control-chrome', title: 'Mobile control button chrome', priority: 'P1', status: 'needs-touch-scale-pass', reason: 'Touch controls need high-contrast hit affordances that survive phone glare and reduce-motion mode.' }),
]);

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function freezeItems(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

function pickupQueueItems(powerUps = LESTER_BLASTER_POWER_UPS) {
  return freezeItems(powerUps.map((powerUp) => {
    const iconAsset = HMH_PICKUP_ICON_PACK.assetsById?.[powerUp.id] ?? null;
    return {
      runtimeId: powerUp.id,
      title: powerUp.title,
      category: powerUp.category,
      rarity: powerUp.rarity ?? 'common',
      priority: PICKUP_PRIORITY_BY_RARITY[powerUp.rarity ?? 'common'] ?? 'P1',
      status: iconAsset ? 'manifest-backed-runtime-icon' : 'needs-manifested-pickup-icon-or-confirmed-keep',
      sourcePolicy: iconAsset?.sourcePolicy ?? ORIGINAL_POLICY,
      iconSrc: iconAsset?.src ?? null,
      reason: powerUp.sprite,
      acceptance: Object.freeze([
        '64x64 or 48x48 transparent pixel icon/spritesheet with readable silhouette at 1x scale.',
        'Color/shape communicates category and rarity without relying only on text.',
        'Manifest entry is referenced by runtime pickup drawing or explicitly marked defer/keep.',
      ]),
    };
  }));
}

function achievementQueueItems(achievements = ACHIEVEMENT_LIST) {
  const byTier = new Map();
  const byUnlockType = new Map();
  for (const achievement of achievements) {
    byTier.set(achievement.tier, (byTier.get(achievement.tier) ?? 0) + 1);
    byUnlockType.set(achievement.unlockType, (byUnlockType.get(achievement.unlockType) ?? 0) + 1);
  }
  const tierItems = [...byTier.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tier, count]) => {
    const tierAsset = HMH_ACHIEVEMENT_ATLAS.tiersById?.[tier] ?? null;
    return {
      runtimeId: `achievement-tier-${tier}`,
      title: `${tier.toUpperCase()} badge atlas`,
      priority: tier === 'bronze' || tier === 'silver' ? 'P1' : 'P0',
      status: tierAsset ? 'manifest-backed-tier-atlas' : 'needs-badge-atlas-certification',
      sourcePolicy: tierAsset?.sourcePolicy ?? ORIGINAL_POLICY,
      iconSrc: tierAsset?.src ?? null,
      reason: `${count} runtime achievements use ${tier} tier language; replace emoji/placeholder badge reads with tier-consistent medals.`,
      acceptance: Object.freeze([
        'Locked and unlocked badge states exist for every achievement in this tier.',
        'Badge shape/color remains readable in profile grid, toast, and game-over summary.',
        'Atlas filenames map directly to ACHIEVEMENT_LIST ids or an approved tier fallback.',
      ]),
    };
  });
  const unlockItems = [...byUnlockType.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([unlockType, count]) => {
    const unlockAsset = HMH_ACHIEVEMENT_ATLAS.unlockTypesById?.[unlockType] ?? null;
    return {
      runtimeId: `achievement-unlock-${unlockType}`,
      title: `${unlockType} achievement icon language`,
      priority: ['boss', 'skill', 'level-clear'].includes(unlockType) ? 'P0' : 'P1',
      status: unlockAsset ? 'manifest-backed-unlock-type-icon' : 'needs-icon-language-pass',
      sourcePolicy: unlockAsset?.sourcePolicy ?? ORIGINAL_POLICY,
      iconSrc: unlockAsset?.src ?? null,
      reason: `${count} achievements share unlock type ${unlockType}; define a visual motif so badge art is not one-off noise.`,
      acceptance: Object.freeze([
        'Icon motif is distinct from pickup and weapon icons.',
        'Motif works in grayscale/value for colorblind mode.',
      ]),
    };
  });
  return freezeItems([...tierItems, ...unlockItems]);
}

function vfxQueueItems(vfxPack = HMH_FINAL_COMBAT_VFX_PACK) {
  const manifestAssets = new Map([
    ...(vfxPack.assets ?? []).map((asset) => [asset.key, asset]),
    ...(HMH_VFX_UI_CHROME_PACK.vfx ?? []).map((asset) => [asset.key, asset]),
  ]);
  const requiredItems = VFX_REQUIRED_RUNTIME_ROLES.map((runtimeId) => {
    const asset = manifestAssets.get(runtimeId);
    return {
      runtimeId,
      title: asset?.key ?? runtimeId,
      priority: ['coin-pickup-pop', 'level-up-burst', 'grenade-explosion-ring'].includes(runtimeId) ? 'P0' : 'P1',
      status: asset ? 'manifest-backed-keep-or-wire' : 'missing-spritesheet',
      sourcePolicy: asset?.sourcePolicy ?? ORIGINAL_POLICY,
      reason: asset ? `${asset.frames} frames, ${asset.frameWidth}x${asset.frameHeight}, role ${asset.role}.` : 'Required role has no final VFX manifest asset yet.',
      acceptance: Object.freeze([
        'Effect has bounded lifetime and does not obscure bullets, enemies, or pickup silhouettes.',
        'Effect is manifest-backed or explicitly listed as a coded primitive exception.',
        'Reduce-motion/reduce-flash settings can dampen intensity without deleting gameplay information.',
      ]),
    };
  });
  const missingItems = VFX_MISSING_REDO_ITEMS.map((item) => {
    const asset = manifestAssets.get(item.runtimeId);
    return {
      ...item,
      status: asset ? 'manifest-backed-vfx-ui-chrome' : item.status,
      sourcePolicy: asset?.sourcePolicy ?? ORIGINAL_POLICY,
      src: asset?.src ?? null,
      iconSrc: asset?.src ?? null,
      acceptance: Object.freeze([
        'Spritesheet is transparent, repo-owned, and registered in a generated manifest.',
        'Runtime use is capped and respects reduce-motion/reduce-flash settings.',
      ]),
    };
  });
  return freezeItems([...requiredItems, ...missingItems]);
}

function uiChromeQueueItems() {
  const brandTokens = LESTER_ARCADE_BRAND_SYSTEM?.tokens?.length ?? 0;
  const chromeAssets = new Map((HMH_VFX_UI_CHROME_PACK.uiChrome ?? []).map((asset) => [asset.key, asset]));
  return freezeItems(UI_CHROME_REDO_ITEMS.map((item) => {
    const asset = chromeAssets.get(item.runtimeId);
    return {
      ...item,
      status: asset ? 'manifest-backed-ui-chrome' : item.status,
      sourcePolicy: asset?.sourcePolicy ?? ORIGINAL_POLICY,
      src: asset?.src ?? null,
      iconSrc: asset?.src ?? null,
      reason: `${item.reason} Brand token count available for palette alignment: ${brandTokens}.`,
      acceptance: Object.freeze([
        'Uses shared arcade/LitVM palette tokens and remains readable over bright combat backgrounds.',
        'Has desktop and mobile sizing rules; no click target below 44 CSS px on touch controls.',
        'Does not introduce new unmanifested downloaded art.',
      ]),
    };
  }));
}

function categorySummary(items) {
  return Object.freeze({
    itemCount: items.length,
    p0Count: items.filter((item) => item.priority === 'P0').length,
    p1Count: items.filter((item) => item.priority === 'P1').length,
    missingCount: items.filter((item) => /missing|needs/i.test(item.status ?? '')).length,
  });
}

export function buildArtRedoQueue({ repoRoot = repoRootFromHere() } = {}) {
  const census = buildGlobalArtCensus({ repoRoot });
  const pickups = pickupQueueItems();
  const achievements = achievementQueueItems();
  const vfx = vfxQueueItems();
  const uiChrome = uiChromeQueueItems();
  const achievementTiers = [...new Set(ACHIEVEMENT_LIST.map((achievement) => achievement.tier))].sort();
  const categories = freezeItems([
    {
      id: 'pickups',
      title: 'Pickups',
      summary: categorySummary(pickups),
      coverage: Object.freeze({ runtimePowerUpCount: LESTER_BLASTER_POWER_UPS.length, manifestId: HMH_PICKUP_ICON_PACK.id, manifestAssetCount: HMH_PICKUP_ICON_PACK.assetCount }),
      items: pickups,
    },
    {
      id: 'achievements',
      title: 'Achievements',
      summary: categorySummary(achievements),
      coverage: Object.freeze({ runtimeAchievementCount: ACHIEVEMENT_LIST.length, tiers: Object.freeze(achievementTiers), manifestId: HMH_ACHIEVEMENT_ATLAS.id, manifestAchievementCount: HMH_ACHIEVEMENT_ATLAS.achievementCount, unlockTypeCount: HMH_ACHIEVEMENT_ATLAS.unlockTypeCount }),
      items: achievements,
    },
    {
      id: 'vfx',
      title: 'VFX',
      summary: categorySummary(vfx),
      coverage: Object.freeze({ manifestId: HMH_FINAL_COMBAT_VFX_PACK.id, manifestAssetCount: HMH_FINAL_COMBAT_VFX_PACK.assetCount }),
      items: vfx,
    },
    {
      id: 'ui-chrome',
      title: 'UI chrome',
      summary: categorySummary(uiChrome),
      coverage: Object.freeze({ brandTokenCount: LESTER_ARCADE_BRAND_SYSTEM?.tokens?.length ?? 0, manifestId: HMH_VFX_UI_CHROME_PACK.id, manifestAssetCount: HMH_VFX_UI_CHROME_PACK.uiChrome?.length ?? 0 }),
      items: uiChrome,
    },
  ]);
  const allItems = categories.flatMap((category) => category.items);
  return Object.freeze({
    version: 'wo-20-pickups-achievements-vfx-ui-redo-v1',
    generatedBy: 'scripts/art-redo-queue.mjs',
    sourceCensus: Object.freeze({ version: census.version, complianceScore: census.summary.complianceScore, path: 'docs/art/GLOBAL_ART_CENSUS.json' }),
    summary: Object.freeze({
      categoryCount: categories.length,
      totalItemCount: allItems.length,
      p0Count: allItems.filter((item) => item.priority === 'P0').length,
      p1Count: allItems.filter((item) => item.priority === 'P1').length,
      needsManifestCount: allItems.filter((item) => /needs|missing/i.test(item.status ?? '')).length,
    }),
    categories,
    recommendations: Object.freeze([
      'WO-40 should consume the level-up-card-frame UI chrome item before deeper upgrade-menu polish.',
      'Generate pickup and achievement icon atlases before replacing runtime CSS/emoji placeholders.',
      'Keep normal bullets coded primitives; use final VFX sheets for large readable moments only.',
    ]),
  });
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replaceAll('\n', ' ').replaceAll('|', '\\|')).join(' | ')} |`),
  ].join('\n');
}

export function renderArtRedoQueueMarkdown(queue) {
  const sections = queue.categories.map((category) => {
    const rows = category.items.map((item) => [item.priority, item.runtimeId, item.title, item.status, item.reason]);
    return `## ${category.title}\n\n- Items: ${category.summary.itemCount}\n- P0: ${category.summary.p0Count}\n- P1: ${category.summary.p1Count}\n\n${table(['Priority', 'Runtime ID', 'Title', 'Status', 'Reason'], rows)}`;
  }).join('\n\n');
  return `# Hard Money Heroes Art Redo Queue\n\nGenerated by \`${queue.generatedBy}\` from \`${queue.sourceCensus.path}\`.\n\n## Summary\n\n- Version: ${queue.version}\n- Source census score: ${queue.sourceCensus.complianceScore}/100\n- Categories: ${queue.summary.categoryCount}\n- Queue items: ${queue.summary.totalItemCount}\n- P0 items: ${queue.summary.p0Count}\n- P1 items: ${queue.summary.p1Count}\n- Items needing manifest/replacement work: ${queue.summary.needsManifestCount}\n\n${sections}\n\n## Recommendations\n\n${queue.recommendations.map((item) => `- ${item}`).join('\n')}\n`;
}

export function writeArtRedoQueue({ repoRoot = repoRootFromHere() } = {}) {
  const queue = buildArtRedoQueue({ repoRoot });
  const outputDir = path.join(repoRoot, 'docs', 'art');
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'ART_REDO_QUEUE.json');
  const mdPath = path.join(outputDir, 'ART_REDO_QUEUE.md');
  writeFileSync(jsonPath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderArtRedoQueueMarkdown(queue), 'utf8');
  return Object.freeze({ queue, jsonPath, mdPath });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { queue, jsonPath, mdPath } = writeArtRedoQueue();
  console.log(`Art redo queue written: ${jsonPath}`);
  console.log(`Art redo markdown written: ${mdPath}`);
  console.log(`Queue items: ${queue.summary.totalItemCount}; P0: ${queue.summary.p0Count}; P1: ${queue.summary.p1Count}; needs manifest/replacement: ${queue.summary.needsManifestCount}`);
}
