# STACKED F2a — optional interactive quick start

The strict `stackedTutorial=tutorial-v1` switch adds a lazy five-action Free
tutorial: move, rotate, hold, hard drop and a four-row Halving. It opens on the
first entry, remembers completed versus skipped on this device, and can be
reopened with Learn to play. Unsupported/duplicate/absent switches and Ranked
leave the entry off. The production default remains off for the combined release.

This is an interactive practice diagram with no score, simulation, RNG,
recorder, bridge or verifier import. It uses its own bounded 80-cell display.
The real run remains paused; its tick and score stay unchanged throughout the
actual browser lesson. The only new storage write is the versioned onboarding
marker. No earning, rules, evidence, version or settlement behavior changed.

## Implementation and review

Lesson controls work by keyboard and native touch buttons. Next requires the
taught action; Escape/Skip restore the menu and focus. Repeated opening,
pending imports, module failure, five-second timeout and cabinet disposal are
covered. Loading or open training blocks resume and clears queued game input.
The parent forwards only individually validated presentation flags. Both
Character and World independently reviewed isolation and lifecycle with no
actionable findings.

The layout uses existing STACKED colors and text styles, 44px+ targets, a
static grid and visible piece/landing outlines. It has no animation or flashing.
First screenshot review found unequal row sizes and tablet controls below the
initial panel view. Fixed the grid tracks and constrained its size; final
browser metrics prove uniform rows and all lesson controls visible at the five
tested widths. Touch instructions name buttons as well as keyboard shortcuts.

## Actual evidence

- Genuine initial missing-implementation RED: 13 failures, zero skips.
- Initial GREEN 13/13 and exact isolated no-Git/no-modules/empty-PATH copy 13/13.
- Final related source tests 35/35, scoped view parse and fresh production build.
- Two actual Chrome attempts each pass 11 cases; the second checks final polish.
- Final seven original screenshots inspected at 320, 414, 768, 1024 and 1440px
  outer widths. Embedded desktop cabinet widths are smaller, recorded in metrics.
- Keyboard and touch complete all stages; skip/reopen/start, focus restoration,
  default/duplicate gating, optional import failure and unrelated storage pass.
- Actual fresh built Worker returns the old 432,000-tick fixture tuple exactly.
- Final initial/shared totals: HMH 1,039,992 B (8,584 B headroom); STACKED
  579,395 B (27,605 B headroom). Tutorial view/model are lazy chunks.
- Both browser/HTTP servers and native Chrome processes closed normally before
  owned shared markers were released. Final Node PIDs 22692/576/54584/5944 and
  Chrome 18916 were subsequently observed absent.

Exact logs, raw reports, build metadata and bounded harnesses are in
`../receipts/stacked-tutorial-f2a/receipt.json`. The initial integration script
stopped on a Windows text-decoding error before edits; explicit UTF-8 corrected
that preparation issue, not a runtime failure. No behavior tests were skipped.

## Visual assessment and limits

I first notice the lesson title, then the piece and guide, then its control.
Those are the intended priorities. The hold shelf teaches a separate concept;
the progress label sets scope, and Next/Skip control pacing. Verdict: clear.
The revised tablet layout keeps actions visible. The phone uses readable text
and large controls; its inherited touch highlight is transient. Existing arcade
scanlines remain behind the panel. These are inspected Windows Chrome captures,
not physical XS Max performance or a 60-minute soak. Automated design lint and
axe were not installed or downloaded. No HMH rendering code changed, so its
visual gate was not rerun for this DOM-only slice. No full release certification,
owner playtest, push, deployment or production acceptance is claimed.
