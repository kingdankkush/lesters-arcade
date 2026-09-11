# HMH playable release and retained polish backlog

## Latest playable release

Verified live at https://lestersarcade.io from `cabe95165c68bdea77bb626d6c630b872e8c83b2`. [Release receipt](../qa/hmh-playable-release-20260910.json). The original work groups remain below as retained polish/acceptance work, not unstarted tasks. Additional follow-up: eliminate the brief first-frame loading fallback while preserving safe asynchronous native-atlas loading; stabilize the detailed enemy-crop capture. No financial activation or STACKED resumption is authorized.

## Current priority

Ship a verified, playable combined website/game update. Preserve approved heroes and Chikun, reconcile the incremental Codex return, and keep financial activation disabled. The owner explicitly approved publication with human playtests and unfinished AAA art still open. This is not full AAA acceptance.

## Release gates still requiring actual evidence

- [ ] **reconcile** — Authenticate Codex incremental commit/patch, before/after hashes and dependencies; preserve parent profile/challenge/M-2 and approved assets.
- [ ] **validation** — Run the exact host build and current release ledger; resolve unexpected failures without relaxing caps or hiding tests.
- [ ] **source-review** — Complete independent source/integration review and freeze the exact intended Git candidate.
- [ ] **playable-browser** — Verify ordinary Free entry, selectors, actual controls, combat, death/replay, parent profiles/challenges and Chikun in serial clean browser profiles.
- [ ] **clean-host-preview** — Prove generated/LFS dependencies on a clean host; create and verify an immutable Preview and retain rollback.
- [ ] **publish** — Commit/push only the coherent verified website candidate, promote, then verify exact production identity, served assets and live playable flows.

## Retained improvement groups

All 55 groups and their 67 original IDs are retained below. Source implementation, release verification and full-group acceptance are separate. Some implementation can ship while deeper polish remains open. Consult the final release receipt before redoing work. Older manual-control requirements are superseded by movement/aim/grenade plus automatic interactions.

- [ ] **hmh-01** — partial: Finish reference-to-model-to-biography consistency checks for all four approved heroes; preserve the existing identity work. (`REGISTER:H-1`, `REGISTER:B-6`)
- [ ] **hmh-02** — partial: Close remaining rig, skin weights, waist-seam, source-manifest and LFS custody acceptance for the approved hero models. (`REGISTER:H-2`)
- [ ] **hmh-03** — partial: Validate all nine hero actions at gameplay zoom, including foot planting, recoil, recovery, death and baked coat/hair/neckerchief motion. (`REGISTER:H-3`, `REGISTER:C-5`)
- [ ] **hmh-04** — partial: Complete current all-hero gameplay/profile acceptance, ordinary earned unlocks, reproducibility, mobile texture decode and GPU-memory measurements. (`REGISTER:H-4`, `REGISTER:C-6`)
- [ ] **hmh-05** — partial: Verify selectors use the same approved models as gameplay, with readable framing, lighting and identity details. (`REGISTER:H-5`, `REGISTER:B-5`)
- [ ] **hmh-06** — partial: Finish held-weapon model/socket/pose acceptance across directions and heroes, prioritizing pistol, shotgun, auto-miner and launcher, then the remaining reference-backed weapons. (`REGISTER:H-7`, `REGISTER:R-4`)
- [ ] **hmh-07** — partial: Finish integration and gameplay acceptance of native town, camp, industrial and bridge kits: grounding, collision proxies, depth, occlusion and authored composition. (`REGISTER:R-3`)
- [ ] **hmh-08** — partial: Reconcile any remaining trees, rocks, wrecks, stumps and debris against the already-delivered native source library and provenance. (`REGISTER:R-2`)
- [ ] **hmh-09** — partial: Verify every native pickup object, canonical effect, placement and actual collection path in the final world. (`REGISTER:R-5`)
- [ ] **hmh-10** — open: Finish or verify real campfire lighting and ember emitters, with feature-specific evidence and particle budgets. (`REGISTER:W-8f`)
- [ ] **hmh-11** — partial: Review Hashwood canopy clustering, depth and occlusion so foliage does not read as a flat green strip. (`REGISTER:W-17`)
- [ ] **hmh-12** — partial: Review yard slab variation, cracks, stains and decals at gameplay zoom; regenerate from the final topology where needed. (`REGISTER:W-18`)
- [ ] **hmh-13** — partial: Complete current bridge/ramp/platform/pit/terrace traversal and collision acceptance, preserving existing elevation authority. (`REGISTER:W-11`)
- [ ] **hmh-14** — open: Finish deterministic, genuinely reachable secrets: destructible-hidden caches, ledge rewards and lore props. (`REGISTER:W-12`)
- [ ] **hmh-15** — partial: Confirm the updated spawn/camp/landmark composition does not obscure or overlap the hero's spawn area. (`REGISTER:B-4`)
- [ ] **hmh-16** — owner-gated: Obtain a current owner visual decision on mining-camp haze and contrast; the old density-reduction recommendation is not an accepted change. (`REGISTER:B-11`)
- [ ] **hmh-17** — open: Plan Level 2 only after Level 1 meets its world and gameplay acceptance bar. (`REGISTER:W-16`)
- [ ] **hmh-18** — owner-gated: Confirm remaining reference/identity approvals for six enemy roles and three Liquidator phases, checking delivered material before requesting more art. (`REGISTER:E-2`)
- [ ] **hmh-19** — partial: Carry the already-adopted native Bagholder through final combined gameplay and release acceptance. (`REGISTER:E-7`)
- [ ] **hmh-20** — open: Measure boss-atlas headroom and roster reproducibility/drift trends; make only demonstrated phase-atlas/pipeline repairs without relaxing limits. (`REGISTER:E-8`, `REGISTER:P-8`)
- [ ] **hmh-21** — open: Capture each enemy role's tell-to-hit timing and readability at actual gameplay zoom. (`REGISTER:E-3f`)
- [ ] **hmh-22** — open: Prove market-open, margin-call and total-liquidation boss phases are visually distinct. (`REGISTER:E-5`)
- [ ] **hmh-23** — open: Finish benchmark-backed boss counters, add-wave pressure and arena-use depth after the current swarm baseline. (`REGISTER:E-6`)
- [ ] **hmh-24** — open: Fix ambient defeat-spread burning neutral actors before filtering, and automatic refresh overwriting a manually initiated burn's causal origin; prove replay/partition correctness. (`REGISTER:G-7`)
- [ ] **hmh-25** — partial: Produce current canonical swarm/weapon/boss pressure measurements, including clear time, overkill and projectile load, before balance claims or tuning. (`REGISTER:G-1`)
- [ ] **hmh-26** — partial: Re-run affected weapon, swarm and progression benchmarks after the merged simulation and automatic-action changes. (`REGISTER:G-6`)
- [ ] **hmh-27** — partial: Finish and prove the new automatic close-combat role, including eligibility, cooldown, damage attribution and readable feedback. (`REGISTER:G-3`)
- [ ] **hmh-28** — partial: Finish truthful action-map/help/onboarding for movement, aim and grenade only, including touch auto-targeting when aim is released and first-run cues. (`REGISTER:K-3`, `REGISTER:B-1`, `REGISTER:K-8`)
- [ ] **hmh-29** — partial: Verify rebinding, applicable aim-assist/sensitivity settings and left-handed touch layout have real consumers and persist parent-side without restoring obsolete controls. (`REGISTER:K-4`)
- [ ] **hmh-30** — open: Measure input latency, acceleration/deceleration, diagonal normalization and turn response before further movement tuning. (`REGISTER:K-5`)
- [ ] **hmh-31** — partial: Verify automatic dodge, buffering, edge forgiveness, cancellation and reset under the new controls; do not restore double-tap gestures. (`REGISTER:K-6`)
- [ ] **hmh-32** — partial: Recheck first-use mobile hint placement with the complete HUD visible and zero hero obstruction. (`REGISTER:B-2`)
- [ ] **hmh-33** — partial: Finish narrow-screen arsenal/status readability and unowned-slot collapse; preserve the corrected non-error combo label. (`REGISTER:B-7`, `REGISTER:U-9`)
- [ ] **hmh-34** — open: Review and accept the actual death, run-summary, replay and restart flow on desktop and phone. (`REGISTER:U-8`)
- [ ] **hmh-35** — partial: Recertify ad-strip containment and the ordinary three-click homepage-to-game flow across required profiles, with truthful competitive proof. (`REGISTER:B-3`, `REGISTER:L-3`)
- [ ] **hmh-36** — partial: Confirm the public leaderboard default and House/demo-score labeling; keep source/provenance filtering ahead of personal-best/top-N selection. (`REGISTER:L-2`)
- [ ] **hmh-37** — owner-gated: Resolve visibility of any still-banner-only cabinets, including the MWEB Invaders/LitVM Legends policy, without claiming unplayable content is playable. (`REGISTER:L-4`)
- [ ] **hmh-38** — partial: Finish independent review, build and desktop/portrait validation of the source-tested detailed profile UI; close the remaining real build-history/data requirements. Durable Ranked history is still separate. (`REGISTER:L-5`)
- [ ] **hmh-39** — open: Define and finish achievement unlock dates, progress meters and accessible tooltips from real canonical data. (`REGISTER:L-6`)
- [ ] **hmh-40** — open: Produce matching portal/key art from the accepted approved hero models rather than a separate redesign. (`REGISTER:L-8`)
- [ ] **hmh-41** — partial: Obtain exact-copy owner acceptance of the implemented privacy, terms, support, accessibility and Testnet trust surface. (`REGISTER:L-9`)
- [ ] **hmh-42** — open: Verify or complete the privacy-conscious parent-owned funnel from homepage through first upgrade, death and replay. (`REGISTER:D-2`)
- [ ] **hmh-43** — open: Publish internal balance dashboards/reports from actual canonical swarm and run-stat outputs. (`REGISTER:D-3`)
- [ ] **hmh-44** — open: Finish category loudness/LUFS mixing, clipping and voice-budget checks, cue coverage and actual device listening acceptance. (`REGISTER:S-4`)
- [ ] **hmh-45** — open: Investigate the current first-fill atmosphere/performance spike and record isolated p99 measurements before choosing a pool/prewarm fix. (`REGISTER:B-10`)
- [ ] **hmh-46** — partial: Recheck final repository/deployable size, LFS and clean-host behavior under the existing limits; the old 405 MB failure is not a reason to raise caps. (`REGISTER:B-9`, `REGISTER:N-9`)
- [ ] **hmh-47** — partial: Finish current per-profile browser isolation, hero/enemy crop coverage, full-HUD visual checks and valid final visual baselines. (`REGISTER:N-8`)
- [ ] **hmh-48** — partial: Reconcile both agents' bundle factoring, then decide whether the remaining lazy debug/evidence split is needed without increasing byte caps. (`REGISTER:N-4`)
- [ ] **hmh-49** — open: Verify immutable hashed atlas URLs, CDN/cache headers, service-worker updates and stale-client behavior on the exact hosted candidate. (`REGISTER:N-6`)
- [ ] **hmh-50** — owner-gated: Obtain an approved keep/retire inventory for superseded assets before any broad cleanup or deletion. (`REGISTER:N-2`)
- [ ] **hmh-51** — partial: Keep roadmap, handoffs and cabinet status aligned with actual local/preview/public state; do not retry the unnecessary protected AGENTS.md replacement. (`REGISTER:B-8`, `REGISTER:N-3`)
- [ ] **hmh-52** — open: Produce final-candidate hero turntables, full-HUD combat clips, map flyovers and mobile gameplay capture assets. (`REGISTER:M-1`)
- [ ] **hmh-53** — open: Create the truthful launch fact sheet/feature matrix separating public, local, simulated, unfinished and gated functionality. (`REGISTER:M-2`)
- [ ] **hmh-54** — open: Verify or finish deterministic parent-owned daily/weekly challenge seeds and seed sharing. (`REGISTER:M-3`)
- [ ] **hmh-55** — owner-gated: Complete five recorded first-time desktop playtests, five recorded first-time mobile playtests, physical-device coverage and owner exact-candidate acceptance. (`REGISTER:owner-playtests`)

## Separate Web3 preparation (not activated by this release)

- [ ] **WEB3:B-1** — Named preparation item in the separate Web3 roadmap, not the same-numbered live defect. Next: Retrieve exact chain requirement only if selected; do not infer deployment permission from this guide.
- [ ] **WEB3:B-2** — Named preparation item in the separate Web3 roadmap, not the same-numbered live defect. Next: Retrieve exact chain requirement only if selected; do not infer deployment permission from this guide.
- [ ] **WEB3:B-3** — Named preparation item in the separate Web3 roadmap, not the same-numbered live defect. Next: Retrieve exact chain requirement only if selected; do not infer deployment permission from this guide.
- [ ] **WEB3:B-4** — Named preparation item in the separate Web3 roadmap, not the same-numbered live defect. Next: Retrieve exact chain requirement only if selected; do not infer deployment permission from this guide.
- [ ] **WEB3:B-5** — Named preparation item in the separate Web3 roadmap, not the same-numbered live defect. Next: Retrieve exact chain requirement only if selected; do not infer deployment permission from this guide.

## Additional retained acceptance, Ranked and launch work

- [ ] **W-10** — Reopened fuel-yard / reservoir-route clearance: verify the incoming fix without reducing the 24-unit art guard or losing any of the three enclosures.
- [ ] **humans** — Five first-time desktop and five mobile recorded playtests, physical-device coverage and full AAA owner visual acceptance. Explicitly deferred for this verified website update, not completed.
- [ ] **wallet** — Real MetaMask/Rabby/compatible-provider identity, reject/reconnect, account/network-change acceptance on LitVM. No new wallet operations are part of this website release.
- [ ] **entry** — Ranked minimum .1 zkLTC native entry, payment/session binding and rejection. Financial activation remains separately gated.
- [ ] **settle** — Trusted, idempotent Ranked settlement, canonical result readback and verifier authority. Keep SETTLEMENT_LIVE=false until separate approval.
- [ ] **durable** — Durable paginated history for every Ranked session by wallet, chain, epoch and game. The local 50-summary cache is not this service.
- [ ] **global** — Verified global competitive statistics with an explicit, owner-approved tie-break rule.
- [ ] **nft** — Wallet-locked, non-transferable achievement NFTs: source/tests/readback and authority decisions; no activation in this update.
- [ ] **epoch** — Universal Mainnet launch-epoch separation for scores, achievements and unlocks, preserving Testnet archival history.
- [ ] **fee** — Additional Mainnet Ranked platform fee: amount, recipient/split, configuration and disclosure are owner-gated.
- [ ] **trailer** — Capture the verified candidate, then obtain the owner/editor final trailer cut; do not market unverified gameplay.
- [ ] **community** — Community seed/challenge/screenshots and verified-score materials without incentive promises.

## Paused and excluded: STACKED

Do not implement or publish this lane without a new applicable owner scope decision. All 22 exact IDs remain preserved:

`STACKED:S-01`, `STACKED:S-02`, `STACKED:S-03`, `STACKED:S-04`, `STACKED:S-05`, `STACKED:S-06`, `STACKED:S-07`, `STACKED:S-08`, `STACKED:S-09`, `STACKED:S-10`, `STACKED:S-11`, `STACKED:S-12`, `STACKED:S-13`, `STACKED:S-14`, `STACKED:S-15`, `STACKED:S-16`, `STACKED:S-17`, `STACKED:S-18`, `STACKED:S-19`, `STACKED:S-20`, `STACKED:S-21`, `STACKED:S-22`

## Canonical source and resumption rules

- [Machine-readable version](hmh-playable-release-and-polish-backlog.json)
- [Full 99-ID status register](../hmh-reboot/OPEN-WORK-CURRENT-STATUS.json)
- [55-group execution queue](../qa/hmh-upgrade-execution-queue.json)
- [Ranked/wallet/NFT/launch-epoch requirements](../hmh-reboot/RANKED-DATA-AND-LAUNCH-EPOCH-REQUIREMENTS.md)
- [Current rollout handoff](hmh-textured-rollout-progress.md)

Recheck live source, the release receipt and current owner decisions before selecting the next bounded polish slice. Never infer completion from a commit, checklist, source test, or old screenshot. Do not reopen approved models/atlas choices or overwrite mixed work.
