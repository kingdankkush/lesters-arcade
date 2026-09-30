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

The owner approved using the recommended reward package: two extra HMH trophy
achievements, three completion trophies, per-game Ranked rarity, the 12 proposed
rewards, Early Supporter recognition and optional gyro tilt off by default.
Implementation still needs exact achievement-ID and server-proof mappings;
descriptive unlock ideas are not yet executable rules. No earning rule or reward
is enabled by this task-list update.

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


## Rewards lane status (September 30, `claude/200-rewards`)

Source-checked only: no build, browser run, deployment or physical-device
check is claimed for these items, and no real wallet has earned anything.

- **Early Supporter badge — implemented, source-checked.** `early-supporter`
  (gold, category `founder`) is a parent-owned entry in the new
  `apps/portal/src/achievements/arcade.mjs` catalog (`gameId` `arcade`, not a
  cabinet). Criterion: the run's server `verifiedAt` stamp is before
  `EARLY_SUPPORTER_CUTOFF_ISO`, in any cabinet. **The cutoff
  `2026-10-31T00:00:00Z` is a placeholder; the 2.0 release commit must fix the
  real date.** Earning goes only through the existing server derivation
  (`deriveEarnedAchievements`, after the cabinet's own entries); the unlock is
  recorded under the cabinet of the qualifying run, the §6.5 history carries
  parent-owned unlocks from every cabinet, so it is earned once per wallet.
  Rarity: `GET /api/achievements/stats?game=arcade` counts every cabinet's
  eligible players and each wallet once; below twenty players it stays
  `Early`. The profile collection gains a "Lester's Arcade" section. Badge art
  is a labelled placeholder (the Cabinet Pioneer badge). Tier `gold` is a
  lane judgment pending the badge theme.
- **Optional gyro tilt, off by default — implemented, source-checked.** The
  focused badge (`achievements/detail-view.mjs`) offers a "Device tilt" button
  only where `DeviceOrientationEvent` exists. Off unless the player opts in; the
  preference is local (`lesters-arcade:achievement-detail:gyro`, guarded reads
  and writes). Enabling from the button calls
  `DeviceOrientationEvent.requestPermission()` where it exists (iOS), and
  anything but `granted` leaves it off silently; a persisted preference
  attaches on open without a prompt. Orientation maps through `gyroTilt` to the
  same bounded 35-degree tilt as a drag, baselined on the first sample; input
  is ignored under reduced motion, during a drag and while the dialog is
  closed. Five source tests cover the mapping, bounds, default-off, permission
  outcomes and reduced motion. No browser or physical-phone run is claimed.
- **Retained archive-label assertion — root cause fixed at the source.** The
  portal's global `button { text-transform: uppercase }` (`apps/portal/styles.css`)
  renders the Locker's `Archived look` control as `ARCHIVED LOOK`, so a browser
  check reading `innerText` compared the CSS rendering with the source string.
  `routes/unlockables-panel.mjs` now exports the source labels
  (`UNLOCKABLES_EQUIP_LABELS`) and `unlockablesLabelMatches(rendered, label)`,
  a case- and whitespace-insensitive comparison; the source test compares the
  DOM `textContent` against the exported string and proves the matcher accepts
  the upper-case rendering. The browser-review harness itself lives outside
  this repository (the shared Codex workspace `outputs/replacement-rewards-review/`);
  its archive check must read `textContent` or use the matcher. That browser
  run has not been repeated here; no other assertion changed.
- **Trophy criteria audit and catalog entries — implemented, source-checked.**
  Re-audit: the 13 existing `nft: true` candidates are unchanged (3 HMH run
  totals, 5 Chikun platinum, 5 STACKED platinum). Added, all with stable ids
  and criteria from existing server-verified stats:
  - HMH `full-roster-run` (mythic, boss, trophy): one kill of each schema-7
    boss row (`killsByRole` for `rug-pull-baron`, `lockkeeper`,
    `fifty-one-percent-foreman`, `liquidator`) in one run; a schema-6 summary
    can never earn it.
  - HMH `boss-rush-fifty` (mythic, boss, trophy): Σ `bossKills ≥ 50`, i.e.
    fifty Liquidator runs (plausibility caps a run at one).
  - STACKED `stacked-final-zone` (mythic, zone, trophy): `zone ≥ 5` in one
    run, the last simulation zone (25 minutes). The soak pilot never reaches
    it (p99 17.03 min); the owner may lower it to zone 4.
  - HMH `world-escape` (mythic, level-clear) `available: false`: every verified
    HMH run must end `defeated` and the ten-area world has no exit; needs an
    `escaped` end state and world/exit fields in a later run-summary schema.
  - Chikun `chikun-escape-complete` (platinum, escape) `available: false`:
    the replayed result records no course finish (the course loops; `laps ≥ 1`
    is already `chikun-loop-1`); needs an `escaped` terminal state.

  The three available trophies are catalog-only and server-derived (no
  device-local definition; parity tests exempt them). ERC-721 metadata files
  were regenerated for them; posters reuse existing badge art as labelled
  placeholders. No minting, contract or 3D work. Decision for the integration
  owner: the two HMH trophies rest on plausibility-checked boss facts, unlike
  the three run-total HMH candidates.

## G4 replacement package — implementation recommendation (September 30)

The original downloaded reward-definition guide is no longer present. Under the
owner’s best-judgment authorization, these twelve designs are the implementation
recommendation, not a claim to have recovered its missing definitions:

| Cabinet | Reward | Existing achievement |
| --- | --- | --- |
| HMH | Silver Sentinel body finish | `score-10000` |
| HMH | Blood Moon body finish | `enemy-reaper-250` |
| HMH | Ion Pulse weapon finish | `hash-rail-specialist` |
| HMH | Sunforge weapon finish | `grenade-century` |
| Chikun | Aurora coat | `chikun-reach-coast` |
| Chikun | Comet Wake trail | `chikun-close-call` |
| Chikun | Flight Goggles | `chikun-first-flight` |
| Chikun | Prospector Helmet | `chikun-survive-4m` |
| STACKED | Arcade Prism pieces | `stacked-first-line` |
| STACKED | Polar Circuit pieces | `stacked-level-10` |
| STACKED | Emberglass pieces | `stacked-halvings-3` |
| STACKED | Midnight Aurora scene grade | `stacked-survive-7m` |

The new Chikun accessories share the actual game/Locker painter. Piece previews
share the game palettes; the scene inspection applies the real grade to an
existing reference backdrop. HMH finishes are colour tints, with honestly labelled
reference previews. This does not deliver new hero costumes or visualizer modes.

The 25 classic entries remain in the ownership catalogue and inspectable archive,
with original gates intact. Only their equipped preferences retire to default;
Lester/Lilly and achievement records remain. Local cleanup does not overwrite a
wallet pick. Retired cached self preferences require a fresh wallet read; only
matching current-wallet responses can queue a save. Newer local picks merge,
failed saves retain retry state, and classics cannot be re-equipped.

Source checks: 56 existing reward/Locker/child/retirement cases passed, including
old Chikun and STACKED replay parity, HMH summary parity, the fresh-wallet race,
concurrent pick, failed save/retry, archive inspection and both child allowlists.
The root combined build was reviewed in actual Chrome: all twelve desktop reward
inspections and three phone inspections loaded, stayed horizontally contained and
kept unearned equip controls disabled. Eight original captures were inspected; no
page/console errors or non-read network requests occurred. The final Classic
archive check stopped on a viewer string assertion: CSS displays `ARCHIVED LOOK`
where the assertion expected `Archived look`. This is retained as a failed final
assertion, not a full browser pass; the source archive checks remain passing.
Chrome, HTTP and the owned child closed, and the shared lock was released.
Screenshots and the exact partial report are in the shared workspace
`outputs/replacement-rewards-review/`. HMH remains a labelled reference preview;
phone captures are a desktop Chrome device proxy, not a physical-device result.
No migration ran against a real wallet and nothing has been deployed.
