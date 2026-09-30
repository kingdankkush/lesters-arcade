# Lester’s Arcade 2.0 — rewards, site and blog work added

The owner added the companion guide to the same combined 2.0 release. The existing
HMH, Chikun and STACKED overhaul remains active. This document adds scope; it does
not claim any of the new work is implemented, accepted or live.

## Audited starting point

The current source has 124 available achievements: 44 HMH, 40 Chikun and 40 STACKED.
HMH has 57 catalog rows including unavailable future entries. The 13 existing
`nft: true` candidates match the guide: three HMH and five in each other game.

There are **25 cosmetic items to replace**, rather than the guide’s stated 22:
eight HMH, ten Chikun and seven STACKED. Lester and Lilly are the other two catalog
entries and remain. Migration will use actual item IDs, preserving earned
achievement history and the two character unlocks. No migration has run.

The portal currently declares the old apple-touch image twice. There is no blog
content directory or achievements-rarity endpoint in the current source inventory.
The existing `achievements/stats.mjs` maps verified-run results to earning criteria;
it is not a public aggregate rarity service.

## Added workstreams

| Track | Slices | Acceptance |
| --- | --- | --- |
| G1: Badge system | Shared theme/manifest contract; six tier frames; game emblem families; lazy focused shader; drag tilt and spring; static grids and fallback | Final art for every available badge; ±35° limits; keyboard/text access; reduced motion; desktop and physical-phone performance |
| G2: Rarity and profile | Excluded-wallet aggregate query/API/cache; rarity boundaries and “Early”; profile summary, filters, showcase, progress/detail; empty-panel fix | Per-game denominator; no wallet details in public stats; tested server ownership and profile behavior; responsive real-browser review |
| G3: Trophies | Existing 13 models and posters; shared lazy single-model viewer; stable IDs/hashes/metadata; optional proposed and completion trophies | Models, textures and animation within budget; poster fallback; clean shares; server-recorded earning; no minting or contract work |
| G4: Unlockables | Exact retirement-ID inventory; safe preference migration; replacement catalog/slots; ownership validation; 12 proposed rewards and locker | Lester/Lilly retained; saved old selections fall back safely; no loss of earned achievements; presentation/replay parity; final game-art reviews |
| H1: Site pass | Shared tokens/navigation/shells; profile layout; cabinet favicon/app icons; responsive assets; route splitting/accessibility; SEO/sitemap/llms checks | Actual public-page metadata coverage; keyboard/focus/contrast review; measured load/interaction targets; existing cabinet and link gates |
| H2: Blog | Static Markdown builder/index/categories/feed; article layouts/TOC/related links; five articles, OG images and owner-postable X drafts | Source/live facts checked; owner editorial review; no unshipped-feature or real-money claims; release article finalized with the certified 2.0 candidate |

Start with small independent site/profile fixes and blog scaffolding while the
game-art pipelines continue. Build badge/profile contracts with existing art
first, then produce final badge art, trophies and rewards through the approved
game direction. Reuse existing models before creating anything new; no credits
are spent by adding this plan.

The guide’s proposed reward-earning choices remain open pending the owner’s
answer. Safe UI/art scaffolding and audits can proceed meanwhile. The two extra
HMH trophies, three completion trophies and Early Supporter earning rule are not
enabled by this task-list update. The proposed reward package needs explicit
achievement-ID and server-proof mappings; descriptive unlock ideas are not yet
executable rules.

The owner’s combined-release direction takes precedence over the guide’s optional
early-blog publication suggestion. Drafts can be reviewed earlier; publication
remains part of the reviewed release. No posting to social accounts is authorized.

## Release and continuity

Keep game simulation, evidence and old-run verification unchanged by rewards and
visual effects. Any new achievement criteria or server validation receives its
own tests and independent review. Keep the viewers out of initial game bundles,
and measure actual asset, texture-memory and frame costs.

The existing full-gate, physical-device, art-review and specific-release approval
requirements remain. This substantial additional scope increases the remaining
work; the two-day goal is not evidence of completion. Progress is tracked by
checked slices, not a percentage.
