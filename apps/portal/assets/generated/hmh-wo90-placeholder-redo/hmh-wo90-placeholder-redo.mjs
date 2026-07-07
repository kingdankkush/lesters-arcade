// WO-90 placeholder redo certification.
// This module certifies the regenerated repo-owned art packs that replaced the
// old placeholder buckets for pickup icons, VFX/UI chrome, stamp art, and
// achievement atlas.

export const HMH_WO90_PLACEHOLDER_REDO = Object.freeze({
  id: 'hmh-wo90-placeholder-redo-v1',
  workOrder: 'WO-90',
  status: 'certified-regenerated-and-integrated',
  sourcePolicy: 'Repo-owned generated pixel art from tracked generators; no raw PixelLab output, prompt logs, or third-party pixels committed.',
  generatorCommands: Object.freeze([
    'npm run assets:hmh:pickup-icons',
    'npm run assets:hmh:vfx-ui-chrome',
    'npm run assets:hmh:authored-stamp-art',
    'npm run assets:hmh:achievement-atlas',
  ]),
  packs: Object.freeze([
    Object.freeze({
      id: 'pickup-icons',
      manifest: './assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs',
      contactSheet: 'apps/portal/assets/generated/hmh-pickup-icons/hmh-pickup-icons-contact-sheet.png',
      assetCount: 5,
      verdict: 'approved-runtime-ready',
      notes: 'Five P0 power-up icons remain legible at small HUD/card size.',
    }),
    Object.freeze({
      id: 'vfx-ui-chrome',
      manifest: './assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs',
      contactSheet: 'apps/portal/assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-contact-sheet.png',
      assetCount: 9,
      verdict: 'approved-runtime-ready',
      notes: 'Three animated VFX strips plus six UI chrome frames for HUD, cards, toast, minimap, wallet/ranked, and mobile controls.',
    }),
    Object.freeze({
      id: 'authored-stamp-art',
      manifest: './assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-manifest.mjs',
      contactSheet: 'apps/portal/assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-contact-sheet.png',
      assetCount: 3,
      verdict: 'approved-runtime-ready',
      notes: 'Route marker, boss warning pylon, and extraction beacon are clear authored Level 1 signposting props.',
    }),
    Object.freeze({
      id: 'achievement-atlas',
      manifest: './assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs',
      contactSheet: 'apps/portal/assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-contact-sheet.png',
      assetCount: 78,
      verdict: 'approved-runtime-ready',
      notes: '57 achievement records, 6 tier icons, and 15 unlock motifs form the atlas layer.',
    }),
  ]),
  qa: Object.freeze({
    visualInspection: 'no blockers on pickup, VFX/UI chrome, authored stamp, or achievement atlas contact sheets',
    testCommand: 'node --test tests/hmh-pickup-icon-pack.test.mjs tests/hmh-vfx-ui-chrome.test.mjs tests/hmh-curated-level-kit.test.mjs tests/hmh-achievement-atlas.test.mjs tests/hmh-wo90-placeholder-redo.test.mjs',
  }),
});

export const hmhWo90PlaceholderRedoPacks = HMH_WO90_PLACEHOLDER_REDO.packs;
