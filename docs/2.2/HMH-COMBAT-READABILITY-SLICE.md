# Combat readability slice — 2026-10-03

Presentation-only candidate work for master item 8. Boss attack tables, damage,
hit tests, health, camera/input inverse, event lifetimes and simulation streams
are unchanged. This is a partial delivery, not the complete combat/art track.

## Visible changes

- Impact fragments are filled tapered chips with broad shoulders, retaining
  their existing directional fan, surface colours, gravity and profile counts.
  A short warm core uses the existing bounded sprite pool; reduced flash caps
  it at .16 alpha. Reduced motion retains the existing zero-fragment behavior.
- Boss danger fields have a fine reusable grain material, a soft wide rim and
  a strong boundary. Their interior grows with the authoritative tell progress;
  the complete danger outline is visible throughout the windup. There is no
  independent flashing/pulsing clock. Reduced flash caps the base fill at .22.
- Circles, rings and summon sites project actual ground points/elevation.
  Lanes now include the capsule ends already used by collision. Ring markers
  use a real Pixi cutout, and safe sectors clear the red floor before drawing
  green. A ring uses one fill and four strokes, rather than 32 filled segments.
- Low health uses one soft radial texture, with a clear centre and a continuous
  fade below 35% health. It has no pulse and peaks at .24 display alpha.
  It sits below the health pips/UI and never changes input or simulation.

## Budgets, ownership and review

Both materials are generated once per runtime: 256×256 RGBA for the vignette,
64×64 RGBA for danger grain, **278,528 decoded bytes** total before overhead.
The vignette module loads through the existing lazy runtime loader. No art
downloads, filter buffers or extra particle pool were added. Both textures
release their owned sources during bridge disposal; canvas failure quietly
falls back to solid boss fields/no vignette.

Independent review caught Pixi consuming the path after the first stroke:
the strong second rim was empty despite the recording fake counting its call.
Both rims now receive explicit paths; installed `GraphicsContext` tests verify
actual path instructions. Review also identified the inherited missing capsule
ends and unnecessary 32-fill ring cost; those were corrected before acceptance.
Real-context tests assert the annular hole, five instructions per ring, capsule
extent and safe-sector cutout. Projection tests preserve the input event bytes.

## Acceptance status

Focused component, boss and weapon-feedback checks pass. Actual desktop boss
field rendering was observed with the native actor layer and no page errors.
First combined Chrome job built successfully (HMH initial including shared
1,005,148 / 1,048,576 B; STACKED 583,177 / 607,000 B), then failed its short
natural low-health observation: the Free run did not reach the warning during
the 60-second window. That is unobserved, not a successful visual check. The
job closed its owned Chrome/server resources and released its owned lock.
The original failure is preserved in root `outputs/22-water-combat-sky/`.

Pending acceptance: final desktop/phone viewport field screenshots and metrics,
natural in-game low-health observation, real phone performance, final visual
regression comparison. Ground-aware gore/death dressing, boss framing camera,
expanded weapon grips/clips and full combat art quality remain open elsewhere
in the master list. No release or deployment occurred.

The fresh combined art review subsequently passed eight desktop/phone viewport
scenes with no page errors and confirmed owned Chrome/server closure. Actual
Baron danger fields used the grain material at both sizes; recorded draw
instructions are available alongside primitive counts. Full-resolution PNGs
were inspected. Required HMH visual comparison passed 12 legacy scenes, all
unchanged. Natural low-health observation and physical-phone acceptance stay
open; the successful art review did not rerun or erase the earlier failed check.
