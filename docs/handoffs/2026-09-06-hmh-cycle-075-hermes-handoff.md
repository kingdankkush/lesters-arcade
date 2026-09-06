# Cycle 075 release and continuation handoff

## Verified live boundary

- Site: https://lestersarcade.io
- Worktree: `C:/Users/just_/Desktop/Projects/lesters-arcade-cycle075`
- Branch: `hermes/hmh-cycle-075-reference-heroes`
- Runtime implementation: `d53ed420edc71ec026177cb0bc1d9cbadde8c97e`.
- Deployed source: `d70ad0603d96786520b4784adf5441d2061aaeda`. The follow-up pins TAP output in a nested test; served artifacts did not change.
- Preview: `dpl_8wc8CdQbyXF3BUwrcxLZ2X2XsD43`, https://lesters-arcade-2ab09lgrq-justin-agent-projects.vercel.app, READY.
- Production: `dpl_7Ge2KAXfiSTFEzanHt6DLM6diafg`, https://lesters-arcade-rczxkd7mu-justin-agent-projects.vercel.app, READY. The custom domain was read back against this exact ID.
- Retained Cycle 074 rollback: `dpl_6eQiyfLKrCT5aLWRjivcTGQuqWbR`, https://lesters-arcade-276x61nsi-justin-agent-projects.vercel.app.
- Portal token: `hmh-aaa-cycle-075-feedback-and-ui`; SW: `lesters-arcade-v28-hmh-feedback-and-ui`.
- This document is a later documentation-only publication, not a claim that its own future commit is the deployed source.

## What changed

See [Cycle 075](../hmh-reboot/cycles/CYCLE-075.md) for the complete scope. Live changes are bounded death effects/accessibility, mobile debris scaling, shield/blood selection, particle-pool allocation and upgrade-menu confirmation/listener cleanup. Source-only reference intake, packed-image inspection and opt-in exact WebP encoding are also committed. No new models, weapon IDs, levels, physics or AI authority were activated.

## Verification and limitations

- Full host command passed in an isolated staged-tree archive with Git discovery disabled, real LFS-pointer source intake and Pillow 11.3.0. Node 22 and Node 24.20.0 checks passed after explicitly selecting TAP for the nested fixture suite.
- Release ledger: 2,563 evaluated, 2,512 passed, 51 accepted legacy failures, zero unexpected/cancelled/skipped tests.
- Frozen runtime/source diff: `6fde5c5e7fd3e2c36c13c33d42965a5ecf0cca03a7116d9b8f1042bf57dadfcb`; two completed independent reviews returned PASS. One-line host-harness fix: `6ed5d08c3f227d40a3c252adf82cea0319d545b2990edf602859c990a7566d76`, separately reviewed PASS.
- Twelve visual anchors passed without new baselines; five responsive profiles and four real-touch emulations passed. Existing cockpit, performance and enemy/boss presentation checks passed serially.
- Thirty-four emitted JS/CSS/HTML/SW artifacts matched the clean build on authenticated Preview and cache-busted public production.
- Child JS SHA-256: `40d7a61c0ed85d04c14b2f96c01c8ed41e707725a3f6b7e5e895a83c7ed49ec1`.
- Actual public kill feedback produced 8 desktop / 5 mobile / 0 reduced-motion shards, one canvas and no horizontal overflow. Public portal-clean/warm and HMH-clean/warm network checks passed with zero HTTP, fatal request, console and page errors.
- Browser measurements are desktop-host emulation, not physical-phone or long-endurance proof. The established network auditor distinguishes successful 200/206 media-stream cancellations from genuine failures. No response interception or fake asset bodies were used for public certification.
- The first Preview failed on Node's reporter-default difference and was never promoted. Production remained Cycle 074 until the corrected candidate passed.

Local evidence is retained under `.tmp/cycle075-*.json`, `.tmp/cycle075-*.log`, and `.hermes/evidence/hmh-cycle075-defeat-feedback-{preview,production}/`. These are local evidence paths, not public website assets.

## Continue without overwriting unfinished work

The protected `AGENTS.md` handoff pointer was left unchanged because approval was not granted; README and this handoff carry the current release facts. Preserve the policy invariants in `AGENTS.md`.

The worktree intentionally retains untracked model WIP. Do not run broad clean/reset/add commands or claim the entire worktree is clean. Source candidates and generators remain local, including `apps/hmh-reboot/assets/source/models/`, `scripts/hmh-blender/create-hmh-reference-{commando,grenade}.py`, source validation and `tests/blender/`.

1. Commando: source structure passed, but reference likeness, animation readability, full 256px delivery, memory/decode, selector and runtime acceptance remain open.
2. Valkyrie, Lester and Lilly: reference-faithful model/skin/rig/nine-action production remains open.
3. Eleven weapons/grenades: references are committed. Sci-fi grenade has an editable source pilot; amber material/likeness, held attachment, atlas and runtime acceptance remain open. Preserve current gameplay IDs.
4. Continue bounded world/level/road/water/prop, AI/pathing, movement, combat/boss and portal improvements from actual active Reboot source. Historical delegated audit drafts are not an authoritative backlog; many incorrectly labeled established systems as missing.
5. Existing Tripo credit/reference-upload permission is already recorded. No generation/spend was confirmed in this slice; login and final commercial/runtime acceptance remain separate evidence requirements.

No wallet, contract, settlement, real-funds or mainnet authority was changed. Publish future website slices only after their own tests, visual/runtime evidence, exact review and production read-back.
