# Chikun E1 — optional obstacle animation pipeline

The existing Eagle now has a tested eight-frame animation pipeline and low,
medium and high texture sheets. The pilot is off by default. The sheets remain
private test assets: the primitive bird model is **below the final art bar** and
has not been admitted to production assets.

## Verified behavior

- Real Chrome drew all eight frames at each tier. Reduced motion held frame zero.
- Six actual game cases produced the same score, final state and byte-identical
  v6 evidence, and each replay matched. Default mode downloaded no optional
  animation resources; invalid metadata used the existing static art.
- Delayed loading after disposal did not revive the game. The actual portal
  forwarded only the cosmetic switches and completed Guest → Chikun → Free →
  native start/jump/pause → visible mobile exit.
- 72 related JavaScript checks and nine Python pack/transform/cleanup checks
  passed. An independent source review found no simulation, collision, RNG or
  evidence changes.
- The normal build stayed within budget: HMH 1,039,992 B (8,584 B headroom),
  STACKED 577,431 B (29,569 B headroom). These are local candidate measurements.

The three sheets use 18,120 / 35,322 / 56,994 encoded bytes. Their decoded RGBA
sizes are 262,144 / 589,824 / 1,048,576 bytes; only the selected tier loads.
Native posing restored the original in-memory scene exactly and left the saved
source unchanged. CPU rendering, selected-sheet loading and atlas registration
are checked; the XS Max physical performance gate remains open.

## Quality and remaining work

The bird still reads as a simple grey body with a fan of rods. It needs a proper
Eagle silhouette, feather forms and materials before release. This checkpoint
finishes the pipeline slice, not the Chikun overhaul or a final asset.

The desktop and phone-size screenshots show the real game. The phone images
come from Windows Chrome at an XS Max viewport, not a physical iPhone. The
controlled-clock replay cases are correctness witnesses, not FPS measurements.

All failed attempts are preserved in the compressed raw archive. Later checks
reused unchanged checked inputs and only reran the missing browser step. Real
Chrome and HTTP closure was observed before releasing each owned heavy marker.
No deployment, version change, credits, contracts or transactions were involved.
