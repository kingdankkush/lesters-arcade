# HMH Cycle 080 release and withheld-work handoff

## Verified live boundary
- Runtime source: `5d28dfb69c721465a925df2a9142a8848e52d44f`, branch `hermes/hmh-cycle-080-corpse-audio`.
- Public: https://lestersarcade.io
- Production: `dpl_HskTDVZr72FVDUD7zHnZTHRCtmCx`, https://lesters-arcade-cjqehxa53-justin-agent-projects.vercel.app
- Verified preview: `dpl_78mUCWZKrCpMHLXid7KPUCbZLAZi`, https://lesters-arcade-9hn5alf83-justin-agent-projects.vercel.app
- Rollback: `dpl_3vyy1XDPsCAveFDhvm1uvYyFmMPs`, source `65dd4522edcc6158f61e3dafbe6188d7be4e11bb`.
- The runtime starts from the later STACKED/security documentation head `aaf113c5214ee6bed3b8b3efba55ff4b9501af95`; no preceding security/STACKED work was rolled back.
- This handoff is a later docs-only commit. Do not promote its identical preview merely to publish documentation.

## What shipped
- Enemy corpse projection expires after 2,000 monotonic milliseconds OR 120 fixed ticks, with a 24-graphic cap, oldest disposal and final 200 ms fade.
- Authoritative retirement, health, scoring and collision remain immediate and unchanged. This is not live 3D ragdoll physics.
- Expired combat voices stop/reset before removal; no new mix or sound-design acceptance is claimed.
- Cache invalidation, regression tests and syntax registration.

## Evidence
[Machine-readable certificate](../hmh-reboot/RELEASE-CERTIFICATION-AAA-CYCLE-080.json) records the exact reviewed patch, clean Node24/no-Git/LFS-pointer host proof, 2,702-test ledger (2,651 pass;51 existing accepted retirement failures;zero unexpected), two passed12-scene visual runs, 35 exact public artifact hashes, four public selector profiles and four clean/warm network scenarios.

Real-input public desktop evidence observed an enemy corpse for approximately1,989ms before disappearance. Portrait and short-landscape/reduced-motion gameplay passed without browser errors. Source policy tests cover the exact lifetime boundary and capacity; this single public death observation is not a24-corpse stress test.

Local evidence is retained in the Cycle080 worktree under `.tmp/` and `.hermes/evidence/cycle080-production/`. Repository documentation is not served from the portal output directory.

## Preserved, NOT released
### Cycle079 pacing and combat
The `lesters-arcade-cycle079-live-integration` worktree retains the exploration/provocation/rally, faster-player, opening-health/session scaling, pistol/shotgun and automatic-damage changes. Do not publish its frozen candidate: the bounded review loop ended with unresolved Burner issues:
1. Automatic defeat-spread creates burns on neutral nearby actors before later damage filtering.
2. Automatic refresh can downgrade an existing manually initiated burn's causal origin.

Preserve failing reviews and counterexamples. Reconcile onto the current Cycle080 boundary before further correction; do not copy old Cycle079 cache markers or duplicate the already shipped corpse/audio patch. Intentional player collection of the existing nuke remains a player-triggered world action, not automatic weapon fire.

### Tripo gameplay art
- The Commando prototype is preserved in the Cycle078 worktree's `.tmp/tripo-gameplay-demo-portal`, served locally at http://127.0.0.1:8918/hmh-reboot/ when its listener is running. It is not production.
- Restoring accepted canonical output after archiving the private demo yielded25/25 atlas/pilot/driver checks without weakening legacy tests. The demo's schema2 bytes were read back from the isolated listener.
- All648 Commando frames remain preserved. Eight lossless trials did not fit the3.25MiB texture limit. No4MiB approval was received; no limits changed.
- Four derived textured hero rig candidates exist. Remaining hero props/layers/atlases, cloth/deformation and gameplay acceptance are still open.
- An unbound zombie candidate completed152frames in each of two Blender passes with zero pixel differences; parent verification checked667 receipt artifacts. It lacks required existing-roster identity details and is not an accepted enemy replacement.
- Other weapons, enemy variants, selector camera/frame polish, true ragdoll alternatives, coherent new world assets and broader sound design remain unfinished.

## Next-work rules
Read actual HEAD, remote and production again before editing. Keep source/visual/animation/runtime/release gates separate, preserve original assets and actor IDs, use the established engine and budgets, and publish only independently certified slices. Wallet/mainnet/funds/settlement authority is outside this website release; no Web3 state changed.
