# HMH continuation: bounded source audits

Source inspected 2026-09-10. This is not a built-browser, visual, device, loudness, pipeline-reproduction or release certificate. The original 55-group/67-ID inventory is retained; no full register entry is closed by these audits.

## Asset, animation and audio audit

Authenticated data: [hmh-asset-audio-source-audit.json](hmh-asset-audio-source-audit.json). The collector enumerated and verified all four approved hero IDs rather than sampling one.

| Boundary | Current evidence | Remaining acceptance / smallest safe next verification |
|---|---|---|
| H-1 / B-6 identity | Existing canonical copy tests pass for all four identities, including Commando's mullet, Valkyrie's headband, Lester's sphere and Lilly's glasses/coat. | Full-resolution reference/model/current-gameplay visual comparison. Preserve approved source; do not restart the models. |
| H-2 custody / rig | All four current weighted `.blend` files match the canonical source manifest and gameplay metrics. Source-inspection hashes match the manifest, with required rig/action/weapon descriptors present. | Cold-host LFS custody, real waist/skin deformation at maximum torso rotation, and exact-candidate acceptance remain separate. No fresh Blender inspection/render ran. |
| H-3 / C-5 animation | All four manifests report 648 unique frame IDs and nine actions. Atlas and metadata bytes match the reports. Baked coat-tail bones are reported for Lilly. | Actual nine-action readability, foot planting, recoil/recovery/death and permitted secondary motion at gameplay zoom. Bone names or old drift reports do not prove this. |
| H-4 / C-6 budgets | Gameplay atlases total 15,796,588 bytes against the unchanged 16,777,216 aggregate cap; every hero is under 4,194,304 bytes. | Five-profile gameplay/earned unlocks, measured device decode and GPU allocation. `decodedRgbaBytes` is an allocation formula, not a device measurement. |
| H-5 / B-5 selector parity | Active selector metadata uses the same four packed gameplay-source hashes. All selector PNGs and all recorded selector provenance hashes match. Selector PNG total is 1,781,075 against 2,097,152 bytes. | Current framed/lighting/identity visual review and final browser consumer acceptance. |
| H-7 / R-4 held weapons | Current inspections identify native coin-blaster, knife and held/released grenade layers. | Actual shotgun/auto-miner/launcher and remaining weapons, sockets, poses, directions, muzzle/effect parity. Do not count pickup imagery as equipped art. |
| R-2/R-3/R-5 world assets | Native prop manifest records 56 locally adopted objects, `releaseCertified:false`; previous native return exists. | Use Codex's frozen return for final source/provenance, placement, collection/effect, grounding, collision and world-composition proof. No new library intake is justified by old inventory prose alone. |
| S-4 audio | Current cue registry has 102 cues. Existing audition has 83 distinct cues and omits the 19 exact IDs enumerated in the JSON audit. Current selector/copy/combat-audio source suite passes 36/36. | The old reel uses a separate synth audition renderer, not the actual sample-based combat mix, and contains peak/RMS rather than LUFS. Measure actual category mix, clipping, voice pressure and cue coverage; physical-device listening remains required. |

The original static selector GLBs are valid manifest-bound LFS pointers, not corrupt replacements. They are not the active gameplay-source selector input. The initial byte-only mismatch was retained in the raw local audit and qualified after pointer and current-source verification; no source was overwritten or fetched to hide it.

## M-3 challenge audit and bounded implementation

[hmh-parent-challenges-checkpoint.json](hmh-parent-challenges-checkpoint.json) records the exact ten-path delta and independent source PASS. Parent-owned UTC daily/Monday-weekly Free seeds, identity-scoped sharing, stale/malformed-link recovery, accessible optional selection/copy and central start/restart consumers are implemented locally. Chikun's existing daily feature is preserved. Free challenges cannot become official/Ranked writes.

Pinned Node v24.20.0: focused 32/32; expanded 166/167 with the exact pre-existing retired HD sprite assertion. No build/browser/mobile or complete M-3 closure is claimed. Two new source modules still need final inventory regeneration before a real combined build. Selection is tab-memory only; an explicit share URL reconstructs the selected course. This is not durable Ranked history or verified competition.

## D-2 privacy-conscious parent funnel audit

Existing consumers:

- `apps/portal/src/vercel-analytics.mjs`: host-gated generic insights-script injection, not a canonical HMH seven-stage event funnel.
- `apps/portal/src/session-analytics.mjs`: session/performance aggregation, not homepage-to-replay instrumentation.
- `apps/portal/main.js::recordCurrentSessionEvent`: requires a paid session and replay evidence. It is an integrity log, not a privacy-conscious Free/parent funnel.
- `main.js::onRunEvent`: currently forwards child events only into paid-session evidence.
- `apps/portal/src/hmh-reboot-portal-lifecycle.mjs`: canonical score-result/run-summary/game-over reconciliation and duplicate-terminal rejection. This is the safe terminal seam for any later funnel.
- `apps/hmh-reboot/src/main.mjs::applySelectedUpgrade`: records the canonical selection and resumes gameplay, but emits no dedicated upgrade-selected run event.
- `sdk/hmh-run-summary-schema.mjs`: final `upgrades` rows carry real offered/selected counts; they do not contain first-selection time. Do not infer the selection time or treat level-up offers as selections.

Remaining bounded implementation: a parent-owned, default-no-outbound diagnostic/aggregate funnel for homepage, play, hero, actual run-start, actual first-upgrade selection, canonical death and replay. It must exclude wallet/session IDs, full URLs, input streams and arbitrary child payloads from exported analytics. Define opt-in/out, retention/clear and transport policy before any persistent or remote collection; no analytics vendor behavior was changed here.

Minimal next RED coverage:

1. Duplicate/stale child events and duplicate terminal messages cannot increment a stage twice or cross a parent session.
2. Free gameplay contributes only to local diagnostics, never profile/achievement/leaderboard/settlement authority.
3. A real upgrade selection emits a bounded event from `applySelectedUpgrade`; an offered upgrade, cancelled panel or restored snapshot does not.
4. Failed starts, abandoned runs, ordinary restart and replay after canonical death remain distinguishable; no invented first-upgrade timestamp.
5. Disabled/no-consent outbound transport makes no network/storage write; explicitly allowed payloads contain only approved aggregate fields.
6. Parent homepage/character/start/replay consumers and the real lifecycle/bridge validation are exercised together, not only permissive mocks or source-name searches.

This first-upgrade producer touches Codex's currently owned child `main.mjs` seam. No competing edit was made while its final-validation claim remains active. A final summary could support explicitly labelled retrospective counts, but would undercount abandoned upgraded runs and does not finish the requested live funnel.

## Ownership and release

`codex-20260910-resumed-final-validation.md` confirms the independent Codex checkout is still running its reserved final checks. Its planned return deliberately excludes profile-truth and the later challenge delta. Hermes must preserve those layers, reconcile the frozen world/controls/provenance dependencies and rerun the actual combined candidate only after explicit release. No commit, push, production or chain change occurred in these audits.
