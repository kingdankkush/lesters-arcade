# HMH Cycle077 release and continuation

## Verified production

- Site: https://lestersarcade.io
- Source/runtime-boundary commit: `126dd58d862ae0d8c15e44c579069d1199c74fad`.
- Branch: `hermes/hmh-cycle-077-tripo-selector`.
- Preview: `dpl_4K5jBmEq54gmo7BbFiggcqTw5tnq`, https://lesters-arcade-81idxjq60-justin-agent-projects.vercel.app.
- Production: `dpl_2ij5eQq1c6FYKCeXQV9Qwz1MbKnb`, https://lesters-arcade-6xcz9rzfb-justin-agent-projects.vercel.app.
- Rollback: `dpl_7Ge2KAXfiSTFEzanHt6DLM6diafg`, https://lesters-arcade-rczxkd7mu-justin-agent-projects.vercel.app.
- Cache: `lesters-arcade-v29-hmh-textured-heroes` / `hmh-aaa-cycle-077-textured-heroes`.
- This handoff is a later docs-only publication outside Vercel's `apps/portal` output. Its commit is not the deployed runtime source. Do not promote an identical documentation Preview.

[Certificate](../hmh-reboot/RELEASE-CERTIFICATION-AAA-CYCLE-077.json) contains actual artifact hashes, exact review identity, test counts, browser/network metrics and limitations. [Cycle scope](../hmh-reboot/cycles/CYCLE-077.md). [Cycle075 handoff](2026-09-06-hmh-cycle-075-hermes-handoff.md) is historical and the rollback reference. `AGENTS.md` remains unchanged; its older cycle pointer is not current deployment evidence.

## What shipped

All four latest textured Tripo heroes now appear in the rotating pre-game selector. Eight384px PNG frames per hero use the existing direction/layout, grounding, loading, reduced-motion and byte limits. Existing IDs/stats and unlock rules are unchanged. The packed selector Blend and original GLBs are source-only Git LFS; source binaries do not ship in portal delivery.

Local49 focused tests passed; full release2,566 tests/2,515pass/51explicitly accepted legacy failures/0unexpected. Clean actual canonical-pointer no-Git host build passed on Node24.20.0/Pillow11.3.0. Twelve existing visual anchors passed; both selector renders had zero observed RGBA drift. Independent final code/image review passed.

Protected Preview35 stable artifacts matched raw bytes; two HTML bodies differed only by the exact host-owned163-byte Vercel feedback script and matched after its removal. Public production37/37 raw artifact hashes matched. Desktop,portrait,landscape and reduced-motion selection connected the child game with zero page/console errors. Four clean/warm portal/game network scenarios passed with zero failures. Production screenshots were directly inspected.

The expanded-source worktree's405MB health result exceeds350MB; do not claim it passed or raise the budget. The actual pointer-only deployment fixture passes the unchanged health/CDN/docs gates. Failed/provider-limited review attempts are historical, not approvals. Final Codex review has a complete structured response and `turn.completed`; its lingering PTY supervisor was subsequently cleaned up, so natural CLI exit0 is not claimed.

## Active local work and ownership

Human-facing root is `Desktop/Projects` under the owner's Windows home.

- `lesters-arcade-cycle077-selector`: isolated released selector worktree, then this documentation packet. Do not merge all Cycle076 WIP into it.
- `lesters-arcade-cycle075`: preserves full Tripo source intake, cleanup pilot, older model work and dirty Cycle076 world/AI/physics changes. It now also holds a bounded local audio fix. None of these are made live by the selector release.
- `lesters-arcade-cycle077-host-proof-nosmudge`: no-Git, actual-LFS-pointer clean host fixture. Dependencies installed with `npm ci`; all37 served artifacts matched the expanded-source build.

Cycle077 evidence in its release worktree:

- `.tmp/cycle077-final-freeze.json`, final binary/focused patch files and `.tmp/cycle077-codex-review.json`.
- `.tmp/cycle077-production-artifact-verification.json`, `.tmp/cycle077-production-selector.log`, `.tmp/cycle077-production-network.log`.
- `.hermes/evidence/hmh-cycle077-selector-production/`: actual public desktop/mobile captures and copied network report.
- `.tmp/verify-cycle077-artifacts.py` uses `--origin`, `--sha`, optional `--preview`. Do not invent a `--label` flag.
- `.tmp/cycle077-hosted-selector.mjs` adapts only origin/output/import/server handling; selector and bridge assertions are preserved, with no request interception.

## Local audio fix, not yet released

In cycle075, `apps/hmh-reboot/src/combat-audio.mjs` removed over-age voices from its registry without stopping their actual media elements. It now calls the existing stop/reset helper before releasing that slot.

- Regression test reproduced RED: expired media remained unpaused.
- `tests/hmh-reboot-combat-audio.test.mjs`:11/11GREEN, including actual stop/reset, no repeated stopping and exact lifetime boundary.
- `.tmp/cycle078-real-audio-smoke.mjs`: real Chrome HTMLAudioElement loaded and played the actual OGG, then verified pause/currentTime0 when expired; no interception or page errors.
- `.tmp/cycle078-audio-checkpoint.json` and `.tmp/cycle078-audio-only.patch` retain exact local evidence. Patch SHA256 `eec617a2815fa6a8dac467eff1ffefe1b28a4f58d710d4fb7aa7eb126d8b9dd2`.
- Requires isolated full build/release gate, independent review, served-gameplay verification and deployment. Do not claim final sound mix/listening acceptance.
- Earlier delegated audio work inspected legacy portal `main.js` and timed out. Its legacy-cue proposal is not an active-Reboot fix and must not replace the verified local change.

## Remaining full backlog

Owner explicitly requested continued characters, animations, enemies, weapons, effects/particles, levels/world, sound and more, with completed verified batches pushed live. This release completes selector art only, not that entire backlog.

1. **Four gameplay heroes:** preserve all originals. Latest four textured sources are available; the older named packet contains all-four parts but only Commando/Valkyrie textured variants. Do not confuse those packets. Fit the fourteen runtime-pinned bones, skin/weight and waist split, then author `HMH_Aim`, `HMH_Dash`, `HMH_Death`, `HMH_Grenade`, `HMH_Hurt`, `HMH_Idle`, `HMH_Melee`, `HMH_PistolFire`, `HMH_Run`. Existing `expected_frames()` computes648 layer×clip×direction frames per hero, not720. New gameplay256px art needs its own likeness, animation, decode/memory/mobile and reproducibility gates. Parent correction: cycle075 `.tmp/cycle078-hero-rig-checkpoint-verified.md`; the earlier delegated checkpoint contains disproven claims.
2. **Enemies/boss:** full source intake48downloads/47unique includes16textured,29geometry-only segmented and2untextured combined, with47native reopen checks/94renders. Raw sources have no rigs/animations. Some include accidental reference-sheet multiple bodies. One isolated zombie pilot retained UVs/three packed textures with zero cut edges and113,930triangles; it is not the accepted roster. Map actual source renders to existing human/zombie enemy IDs before cleanup/rigging.
3. **Weapons/grenades:** eleven reference/source tracks remain. Preserve existing mappings and IDs; complete cleanup, grip/socket/occlusion, pickup/held/use/throw release, animation and runtime gates. The amber grenade palm pilot is not final hand/finger/release acceptance.
4. **World/AI/physics:** existing cycle075 movement/enemy/crossing/boss focused tests rechecked59/59GREEN. Old visual failure and final latest-revision browser/performance certification remain unresolved; do not promote these changes as part of Cycle077.
5. **VFX/particles/UI/sound:** Cycle075 feedback/pooling/accessibility remains live. Advance bounded existing-system improvements rather than duplicate engines. Local audio fix above is the next small candidate; authored source work continues separately.

## Continuing safely

Recheck branch/HEAD/index and the public deployment tuple before editing. Explicitly stage only one completed, tested vertical slice. Preserve dirty source/model work and interactive Blender scenes. Use factory-startup isolated Blender processes and source-only LFS; set `GIT_LFS_SKIP_SMUDGE=1` when creating host archives and inspect extracted pointer bytes because Git archive otherwise can expand LFS objects.

Run the exact host command, current focused/full gates, actual visual/audio/runtime checks, then freeze and independently review the final candidate. Push the release branch, verify its immutable Preview and exact artifact bytes, promote only that accepted deployment, then read back the custom-domain deployment ID and public artifacts/browser flow. Keep rollback. No wallet/contract/settlement or real-funds operation was made in this release; separate approval gates remain in force.
