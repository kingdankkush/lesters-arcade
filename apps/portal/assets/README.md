# Prototype Graphics

This folder contains hand-authored SVG graphics used by the local Lester's Arcade prototype.

## Current assets

### Portal/cabinet assets

- `lester-pilot.svg` — wallet/profile avatar.
- `cabinet-lester-blaster.svg` — playable Hard Money Heroes arcade cabinet.
- `cabinet-generic-pinball.svg` — coming-soon pinball cabinet.
- `cabinet-generic-brawler.svg` — coming-soon beat-em-up cabinet.
- `cabinet-generic-platformer.svg` — coming-soon platformer cabinet.
- `cartridge-lester-blaster.svg` — SNES-style cartridge for Hard Money Heroes.
- `cartridge-lilly-pinball.svg` — SNES-style cartridge placeholder.
- `cartridge-block-brawler.svg` — SNES-style cartridge placeholder.
- `cartridge-mega-lester.svg` — SNES-style cartridge placeholder.

### Hard Money Heroes refinement assets

- `lester-blaster-sprite-sheet.svg` — high-detail pixel-art sprite-sheet concept for Lester idle/run/jump/shoot/blade/throwable/hurt/death frames.
- `lester-blaster-weapons.svg` — weapon and pickup concepts: The Settler, Block Breaker, Hashstorm, Litecoin Blade, Crypto Bombs, Hard Forks, Hash Rail, and Oracle Slayer.
- `lester-blaster-enemy-fx.svg` — Hard Money Heroes enemy concepts with sparks-first death effects and optional gore treatments.
- `lester-blaster-level-parallax.svg` — The Slums, The Tower, and The Getaway parallax/escalation overview.

These are local prototype graphics only, not final production artwork or official Litecoin mascot art.

### Hard Money Heroes banner art (owner art, 2026-09-26)

`hmh-art/` holds the WebP derivatives of the owner's 23 HMH banner PNGs, built by
`python scripts/build-hmh-banner-art.py` (`--check` runs in `npm test`) and recorded in
`hmh-art/manifest.json`. The source PNGs stay in the vault
(`C:/Users/just_/lesters-arcade-vault/hmh-art/banners-2026-09-26/`), never in the repository.

- `hmh-art/banners/` — homepage feature banner and portal backdrop (HMH-Extra4), Free Mode
  (HMH-FreeMode2) and Ranked Mode / leaderboard (HMH-RankedMode), 1600/960/640 px.
- `hmh-art/share/` — Free and Ranked share covers at 1600 px, the sources of the og image and
  `share-cards/lester-blaster.png` / `lester-blaster-free.png`.
- `hmh-art/loading/` — the Level 1 intro and loading rotation pool (17 images at 1280/800/480 px).
  Level-Load-Extra-01 is excluded: its zombies wear Bitcoin logos.
- `hmh-art/og/hmh-free-share-1200x630.jpg` — og:image of `/games/hard-money-heroes`.

The old `generated/hmh-banners/hard-money-heroes-*-banner.jpg` and
`generated/hmh-key-art/hard-money-heroes-keyart-bg.jpg` were retired with this refresh.

### Generated Hard Money Heroes image drafts

Stored under `generated/` and created as local prototype concept assets. These are **not** final launch artwork; they need human cleanup, sprite slicing, animation timing, compression, and brand/legal review before production use.

Primary text-free drafts now wired into the portal gallery:

- `generated/lesters-arcade-parent-portal-hero-textfree.png` — parent portal/arcade-room mood art.
- `generated/hmh-cabinet-key-art-textfree.png` — blank-marquee cabinet/poster key art.
- `generated/hmh-lester-hero-sprite-sheet-textfree.png` — Lester sprite-sheet draft.
- `generated/hmh-level-1-underchain-parallax-textfree.png` — Underchain District Level 1 background draft.
- `generated/hmh-enemy-wave-sprite-sheet-textfree.png` — first enemy wave draft.
- `generated/hmh-boss-roster-concept-textfree.png` — text-free boss silhouette roster.

Additional generated drafts for planning/extraction:

- `generated/hmh-lilly-unlockable-sprite-sheet.png` — Lilly unlockable character sheet concept.
- `generated/hmh-level-2-foundry-vertical-kit.png` — foundry/tower vertical stage concept.
- `generated/hmh-level-3-getaway-parallax.png` — high-speed financial-district getaway stage concept.
- `generated/hmh-props-destructibles-tile-sheet.png` — props/destructibles/platform tiles.
- `generated/hmh-weapons-pickups-icon-sheet-textfree.png` — weapon/pickup icons; review before production because generated icon sheets may still need manual cleanup.
- `generated/hmh-achievement-badge-sheet-textfree.png` — achievement/UI badges; review before production because generated icon sheets may still include accidental text-like marks.
- `generated/hmh-generated-contact-sheet.png` and `generated/hmh-generated-textfree-contact-sheet.png` — visual QA contact sheets.

Text/logos note: generated images sometimes introduce accidental text even when prompted otherwise. Prefer the `*-textfree.png` revisions for portal use, and manually remove/replace any accidental lettering before final game assets.