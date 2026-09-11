# Consolidated playable release and remaining work

Live at https://lestersarcade.io from `4122eb04b77804e2ab19b9917c0217bf59015867`. [Exact release receipt](../qa/hmh-consolidated-release-20260911.json).

Hermes had already integrated and published the overhaul after the supplied Codex handoffs. This follow-up verified that integration and fixed a remaining pre-game instruction mismatch: the old text advertised manual dash/power-ups and incorrect mobile aiming. The intro now describes the controls that actually ship.

The frozen Codex archive and manifest match their supplied SHA-256 identities. All 59 returned files are present: 55 have identical Git blobs; the other four preserve a whitespace cleanup, better failure diagnostics, newer parent syntax entries and a real gate-reset regression. No frozen task file is missing.

Hermes supplied the combined native assets, parent account/profile/challenge work, compatibility fixes, navigation optimization and original hosted release. Codex supplied the incremental world/control features and independent compatibility/navigation checks. Both contributions are retained in the canonical Hermes branch.

## Remaining acceptance for all 55 groups

These rows distinguish delivered work from remaining requirements. No full-group AAA acceptance is newly claimed. The complete original requirements remain in the linked backlog and JSON; 67 grouped IDs, all 99 original register IDs, five Web3 preparation items, 12 additional retained items and 22 paused STACKED IDs are preserved.

| Group | Original IDs | Current delivery and remaining scope |
| --- | --- | --- |
| hmh-01 | REGISTER:H-1, REGISTER:B-6 | Four approved hero identities, biographies and native asset selections are integrated. |
| hmh-02 | REGISTER:H-2 | Native weighted hero sources and provenance are retained; broader rig acceptance remains. |
| hmh-03 | REGISTER:H-3, REGISTER:C-5 | Native action atlases and projection are integrated; complete animation acceptance remains. |
| hmh-04 | REGISTER:H-4, REGISTER:C-6 | Four hero atlases and parent unlock rules are integrated; device/earned-unlock acceptance remains. |
| hmh-05 | REGISTER:H-5, REGISTER:B-5 | Four native hero selectors are integrated; ordinary starter selection was release-tested. |
| hmh-06 | REGISTER:H-7, REGISTER:R-4 | Existing approved weapon/action routes are preserved; full weapon/socket coverage remains. |
| hmh-07 | REGISTER:R-3 | Native town, camp, industrial and bridge composition plus alternate routes are integrated. |
| hmh-08 | REGISTER:R-2 | Delivered native terrain props and provenance are retained; remaining inventory acceptance stays open. |
| hmh-09 | REGISTER:R-5 | Native pickups and automatic collection are integrated; full final-world pickup acceptance remains. |
| hmh-10 | REGISTER:W-8f | Bounded campfire ground lighting and embers are implemented and shipped. |
| hmh-11 | REGISTER:W-17 | Canopy depth, foreground fading and spatial culling are integrated; visual composition debt remains. |
| hmh-12 | REGISTER:W-18 | Final-topology yard materials/decals are integrated; repetition and seam polish remain. |
| hmh-13 | REGISTER:W-11 | Water/bridge/elevation safety, enclosure clearance and gate navigation are integrated. |
| hmh-14 | REGISTER:W-12 | Destructible supplies, same-height ledge/lore rewards and pause field map are implemented. |
| hmh-15 | REGISTER:B-4 | Spawn/camp/landmark clearance fixes are integrated; full AAA composition acceptance remains. |
| hmh-16 | REGISTER:B-11 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-17 | REGISTER:W-16 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-18 | REGISTER:E-2 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-19 | REGISTER:E-7 | Native Bagholder and enemy projection/lifecycle fixes are integrated. |
| hmh-20 | REGISTER:E-8, REGISTER:P-8 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-21 | REGISTER:E-3f | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-22 | REGISTER:E-5 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-23 | REGISTER:E-6 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-24 | REGISTER:G-7 | Runtime Burner eligibility and manual-origin causality are implemented; historical ambient program was not imported. |
| hmh-25 | REGISTER:G-1 | Existing deterministic swarm baseline and pressure tooling are preserved; current broad tuning remains. |
| hmh-26 | REGISTER:G-6 | Merged release retained weapon/Burner source benchmarks; full current balance acceptance remains. |
| hmh-27 | REGISTER:G-3 | Automatic close combat with eligibility, cooldown, attribution and native feedback is implemented. |
| hmh-28 | REGISTER:K-3, REGISTER:B-1, REGISTER:K-8 | Simplified gameplay controls are integrated; this follow-up corrects the stale parent pre-game instructions. |
| hmh-29 | REGISTER:K-4 | Saved custom-control startup compatibility and parent settings authority are integrated and independently reviewed. |
| hmh-30 | REGISTER:K-5 | Canonical movement and browser event-to-render measurements exist; physical input latency is unmeasured. |
| hmh-31 | REGISTER:K-6 | Automatic safe dodge, buffering, cancellation and reset are implemented without extra gestures. |
| hmh-32 | REGISTER:B-2 | Short dodge status and phone hint-position corrections are integrated. |
| hmh-33 | REGISTER:B-7, REGISTER:U-9 | Cockpit and status readability fixes are integrated; broader arsenal acceptance remains. |
| hmh-34 | REGISTER:U-8 | Existing death, run-summary and replay flows are release-tested; human acceptance remains. Follow-up observation: parent pause snapshot can show Level 1 while the child HUD shows Level 2 after an upgrade; reconcile that display. |
| hmh-35 | REGISTER:B-3, REGISTER:L-3 | Three-click Free entry and portal containment are integrated and release-tested. |
| hmh-36 | REGISTER:L-2 | Leaderboard source/provenance filtering before ranking is integrated; public competitive authority remains separate. |
| hmh-37 | REGISTER:L-4 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-38 | REGISTER:L-5 | Detailed local profile history and truthful mode/receipt projection are integrated; durable Ranked history remains. |
| hmh-39 | REGISTER:L-6 | Parent-local achievement dates/progress/disclosures are integrated; canonical/NFT acceptance remains. |
| hmh-40 | REGISTER:L-8 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-41 | REGISTER:L-9 | Implemented trust surfaces are preserved; exact-copy/legal acceptance remains separate. |
| hmh-42 | REGISTER:D-2 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-43 | REGISTER:D-3 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-44 | REGISTER:S-4 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-45 | REGISTER:B-10 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-46 | REGISTER:B-9, REGISTER:N-9 | Clean-host and cloud builds prove the combined candidate under unchanged repository and delivery caps. |
| hmh-47 | REGISTER:N-8 | Desktop/mobile release flows and reviewed scenes exist; detailed enemy-crop repeatability and full visual acceptance remain. |
| hmh-48 | REGISTER:N-4 | Combined bundle factoring ships under original entry/aggregate caps; only 378 bytes aggregate headroom remains. |
| hmh-49 | REGISTER:N-6 | This release reverified 60 served assets/routes in each hosted environment and returning-client intro refresh; broader stale-client/endurance coverage remains. |
| hmh-50 | REGISTER:N-2 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-51 | REGISTER:B-8, REGISTER:N-3 | Live release identities and contribution reconciliation are recorded; historical snapshots are retained. |
| hmh-52 | REGISTER:M-1 | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |
| hmh-53 | REGISTER:M-2 | Offline fact-sheet generator and source coverage are integrated; this release receipt supplies current hosted facts. |
| hmh-54 | REGISTER:M-3 | Parent-owned daily/weekly Free challenges and validated seed sharing are integrated; Ranked remains separate. |
| hmh-55 | REGISTER:owner-playtests | Retained unfinished or owner-gated work; this release makes no new completion claim for this group. |

## Next-session priorities

1. Cold-start native atlas presentation, repeatable enemy crops and physical-device performance/readability.
2. Level 1 composition, seams, enemy/boss tells, animation/weapon sockets, balance and audio mixing.
3. Recorded first-time desktop/mobile playtests and exact-candidate acceptance.
4. Separately scoped real-wallet/Ranked payment and verifier work, durable history/global scores, wallet-bound achievements and Mainnet epoch/fee decisions.

`SETTLEMENT_LIVE=false`. Web3 activation and STACKED resumption are not part of this release. A transient atlas-loading fallback and detailed enemy-crop repeatability remain disclosed; release verification does not erase them.

[Full retained backlog](hmh-playable-release-and-polish-backlog.md) · [Machine-readable reconciliation](hmh-release-reconciliation-20260911.json)
