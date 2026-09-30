# Combined release checklist

Updated September30 after the owner's request to cut credit use and prioritize
visible, playable delivery. No percentage is assigned: the earlier60–75% remaining
estimate was subjective and must not be treated as a measured audit.

| Work | Current state | Next deliverable |
| --- | --- | --- |
| HMH world | Ten-area private greybox has movement and prop residency. One Meadows relay is integrated; its source checks passed before the workflow reset. | Finish and use the playable world, integrate terrain and objectives; avoid another general framework. |
| HMH terrain | A23 terrain atlas and farmhouse/foliage loader are integrated behind the art-target switch. Desktop game review confirms a softer ground boundary. Flat lawn/path and sparse planting still need art improvement. | Improve the terrain materials and natural placement; reuse the integrated assets. |
| HMH characters | Existing3D renderer and model work are reusable. Corrected Liquidator body has163 repaired skin vertices. Root-space conversion is corrected; the model passes saved-pose checks and renders in the desktop game. Integrated into the existing character switch, replacing the rusher slot when the boss is visible. | Improve its dark/narrow appearance; reuse the working conversion for the roster. |
| HMH readability | Painted-bounds prop fading fixed and committed. Objective pointer/text overlap fixed and confirmed in actual phone-framed game. | Keep these fixes in the combined candidate. |
| Chikun | Positive coin flight, chime and counter feedback enabled by default in the candidate. Existing parity checks are retained; final creature art and versioned additions remain unfinished. | Review what is already playable and finish one coherent visual package. |
| STACKED | Solo results now show a clear score, practice best and eight stats; actual desktop/phone views fit. Tutorial, daily, local versus link and living visualizer are now enabled in normal play; fixed music-world settings remain usable. | Make the completed modes and visuals usable together in the candidate. |
| Achievements and site | Collection/rarity and blog rendering infrastructure exist. The current-catalog Locker now has inspection/equip/default controls. Replacement rewards and publication remain. | Review the integrated Locker; finish the replacement rewards and earning flow without discarding legacy unlocks. |
| Release | Production remains1.9.4 at last live verification; nothing from this checkpoint deployed. | Produce a concrete integrated candidate and an accurate list of shipped/deferred items. |

## Execution rules

- Use bounded parallel production lanes for art, models/rigs/animation, VFX and UI.
  Root integrates each tangible deliverable; stop agents when that work is done.
- No new harness families, speculative prototypes, extra scope or paid asset
  generation. Reuse current models, exporters and tools.
- Per latest owner instruction, defer expanded testing and prototype cycles.
  Keep necessary build/playability checks; do not claim unrun checks passed,
  bypass hooks, weaken Ranked rules or touch settlement/secrets.
- Batch visible fixes, integrate them, and report what the player can actually
  see or do. Infrastructure and assertion counts are not product completion.

## Current checkpoint verification

Pointer fix:10 existing/focused checks plus2 isolated checks passed before the
workflow reset. Relay: prior45+45 scene/runtime checks reused; no new test run.
A22 actual-game preview: all6 scenes passed, original phone image inspected.
The already-running broad visual job ended with a Chrome-close deadline and is
not counted as passing; all recorded processes were confirmed absent and its
owned lock released. No repeat was launched. Evidence remains in the local
workspace at `outputs/hmh-a22-game-preview-01/`; no duplicate receipt archive.

Owner clarification: parallel agents are authorized for bounded production art, modeling/rigging/animation, VFX and UI deliverables. Avoid open-ended harness/prototype work; root integrates the finished content.

## Owner budget and release decision — September 30

Owner reported about30% weekly allowance remaining and asked whether the entire
original overhaul could ship today. Root did not promise this; the account tool
reported38% remaining at that check (shared across the account, not a project
budget). Owner explicitly chose **keep the full scope; release later**, declining
a reduced release today. Do not publish a partial release under that conversation.
Finish bounded production deliverables, preserve progress, avoid expanded test
frameworks/prototype loops and paid generation. The full overhaul remains the goal.