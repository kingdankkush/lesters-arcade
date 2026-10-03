# STACKED presentation independent review — 2026-10-02

Reviewed the new luminous scene state/view, lazy loader and build import path,
renderer resize/disposal, mino/particle pools, settings transport and live preview.
This was a source review and focused native Node verification, not a browser,
physical-phone performance test or release gate.

## Corrections

- Resize could repeatedly destroy the shared `GlProgram.from` cache entry.
  Pixi assigns the next compilation a different shader name/key and retains
  each resulting GPU program in its renderer until application disposal. The
  luminous view now retains one process-cache program/source and releases its
  owned mesh, shader and geometry. Renderer/application disposal releases native
  GPU program data. Twenty alternating mobile/desktop view rebuilds verify one
  shared program identity, empty child layers and disposed owned resources.
- Luminous signals omitted `available`, so the default reduced-flash board pulse
  interpreted live music as unavailable and stayed dark. Availability now reaches
  the board pulse; a regression verifies gentle glow during live audio, zero after
  audio expires, no beat onset under reduced flashes and zero under reduced motion.
- Luminous information omitted the HUD's `name` field. It now follows the current
  scene display name; the view check asserts a nonempty string and matching label.

The initial suspicion that cached metadata would crash resize was disproved:
Pixi's generated shader names prevent reuse of that destroyed program key.
The correction addresses cumulative GPU retention, not a reproduced crash.

## Compatibility and safety

Expanded preference enum values cannot be safely sent to already-open old hosts:
their strict validator rejects the preference before advancing message sequence,
which can then reject run results. Root owns retaining the original five fixed
choices, all eight automatic journey scenes and a local-only next-world action.

The reviewed presentation state reads committed feedback without writing it;
shader noise and particle patterns do not consume simulation RNG. Reduced motion
freezes shader clocks and suppresses moving gameplay particles. Reduced flashes
removes beat luminance onset and caps smoothed energy. Preview copies the rendered
game canvas in the same frame and creates no second visualizer/GPU context.
Particles and mino geometry reuse bounded pools/shared contexts. The luminous
shader owns no bulk texture assets or post-processing targets and loads lazily.

## Verification and limits

Twelve focused checks pass across luminous state, real Pixi view resource lifecycle
and board pulse. No broad test suite or browser job was run by this reviewer.
Root must record built chunk budgets, shader compile/visual review, resize in the
real browser and physical-phone frame time/memory results separately.

## Quiet fallback follow-up

Reviewed the new static six-node nebula fallback and its renderer integration.
Production default/fallback now uses this scene instead of the legacy line-art
factory. It respects Off, has no clocks, flash or simulation writes, and updates
the existing shapes during resize. Reported a cleanup correction to root:
`root.destroy({children:true})` does not release owned Pixi Graphics contexts
when that options object reaches the five child graphics. Root should explicitly
pass `context:true` for these locally owned contexts and verify their destruction.
