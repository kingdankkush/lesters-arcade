# Release scope reconciliation — 2026-09-30

The owner resumed existing 2.0 work after the app update and supplied these two
documents as the next upgrade brief, allowing suitable items to move forward.
The documents are archived verbatim in source-originals/ with byte/hash evidence
in SOURCE-RECEIPT.json. Readable copies normalize CRLF to LF only.
Statements about existing implementation, production, platforms, prices and owner
decisions in those documents remain source claims to verify when their slices start.
They do not authorize keys, contracts, minting, outreach or a production release.

## Current priority: finish 2.0

Continue the approved visual, world, character, replay/performance, achievements,
unlockables, Locker, site and combined-release blog work. Retain the existing art,
greybox, physical-device and release checkpoints. Reuse current work; the new brief
does not restart completed slices or replace exact replay/version compatibility.

The shared 3D arcade cabinet kit is a candidate for 2.0 because it can reuse the
trophy-viewer pipeline and replace the current cabinet image defects independently
of gameplay. First audit approved banners, logos, character references and current
player/asset budgets. Use existing faithful flat artwork where possible. Any new
panel artwork is reviewed before it is applied. Render actual RGBA transparency;
never remove white by colour key. Target poster <=30 KB, visible/idle-only 16-frame
WebP strip <=350 KB, optional interaction-loaded model <=1 MB per cabinet, fixed
dimensions and poster-only reduced motion. Measure decode memory as well as bytes:
one 16-frame 384x420 RGBA strip is about 9.84 MiB before GPU overhead. Do not weaken
current loading budgets or permit three continuous hidden animations.

Other low-risk overlap candidates are shared accessibility controls, keyboard
navigation, haptics rate limits and clear menu/weapon HUD presentation. Audit each
against current 2.0 ownership before adding it. New game rules or expanded scope
remain separate tested proposals; avoid silently turning visual polish into a
scoring, balance, input or Ranked rule change.

## After 2.0

| Sequence | Work | Prerequisites |
| --- | --- | --- |
| 2.1a | Finish railgun/wheel, gamepad menus/remapping, STACKED menus, haptics; fair-play review and measured tech health | Audit actual code and real-run corpus; independent review for verifier/rule changes |
| 2.1b | HMH built-but-dark content and new modes; Chikun progression/course additions; STACKED Sprint/Ultra/puzzles/replays | Approved per-mode/course rules, boards and old-run compatibility |
| 2.1c | Content achievements, rarity-informed rebalance, pinned trackers and trophy sharing | Verified earning facts, preserve all historical unlocks, minting deferred |
| 2.1d | Profile progression, synced settings, accessibility centre, leaderboards, discovery/PWA/help | Privacy review and budgets; separate direct approval for external outreach |
| 2.2 | Level 2 art/world, six enemies, three bosses, weapons, power-ups, skills and achievements | Owner setting choice, art addendum, playable greybox, versioned verifier and certification |

Level 2 options remain Mempool Metro, Silicon Tundra (guide recommendation) and
Halving Badlands. Do not build one merely because the guide recommends it. No
seasons/events/rivals, online multiplayer/co-op or fifth hero are added by this
brief. Existing authorized 2.0 local STACKED versus remains in scope.

Soulbound minting is deferred. The appendix is planning context only: no chain,
wallet, relayer, contract, key, deployment or media-publishing action follows from
this intake. Re-check platform support and real costs only when a decision is due.

Open gameplay decisions are retained in the original roadmap section 8 for the
relevant later slices. Do not interrupt 2.0 now with decisions that are not needed.
