# Meadows native layers and painted-bounds fading

September 30. The A21 native terrain, complete owner farmhouse and foliage now
run together in the actual HMH game behind its existing private art switch.
No art is accepted or enabled by default, and no simulation/rules version changes.

The real phone-framing view exposed a rendering defect: a padded prop card faded
when the actor overlapped only transparent pixels. The display now uses measured
painted bounds for fading. Full-card culling and legacy frames without alpha
bounds retain their behavior. Actual overlap still fades for readability.

## Evidence

- Focused RED reproduced one failure with two controls passing. After correction,
  all16 focused/existing prop tests pass, plus the same3 new tests in an isolated
  source copy without Git. World independently reviewed the change.
- Two actual-game runs each pass six desktop/phone-framing scenes: candidate,
  real movement/blocker contact, default-off behavior and failed-load cleanup.
  The second run shows the house fully opaque beside the actor. Root reviewed
  original1440x900 desktop and1242x2688 phone screenshots.
- Both runs perform fresh builds and the standard12-scene visual gate; all
  comparisons are unchanged, maximum mean delta0.019 and maximum cell delta4.
  No baseline was accepted. These browser/build checks used the Art worktree,
  with the exact root-tested authored-prop-display source; this is not the full
  combined-root release gate or a physical iPhone test.
- Three lossless pages retain original native pixels and uncropped prop pivots:
  two1024x768 ground halves and one768x1536 prop page. Both preview tiers share
  them:1,662,584 encoded bytes and11,010,048 RGBA bytes before GPU overhead/mips.
  Density is64texels/metre; final128density and physical-device memory remain open.
- Original models/maps stayed unchanged. The first native attempt failed when
  Blender clamped pixel-aspectY below1. UsingX=1/cos55,Y=1 gives the same intended
  ratio, confirmed within0.000183pixels. The corrected native completed; its
  initial pixel checker failed a stale schema literal. The separate corrected
  pixel check passed without rerendering. Those failures remain retained.
- All owned Node/Python/Chrome children closed and were independently absent;
  HTTP servers closed and each owned shared-lock marker was released.

Compact source and receipts: `../receipts/meadows-a21-painted-bounds/manifest.json`.
Original screenshots stay in workspace `outputs/hmh-a21-game-preview-01/screens`
and `outputs/hmh-a21-game-preview-02/screens`; their hashes are in the manifest.
Art native source/archive commits are78f4d155b and514216090. The standalone
calibration-loader change remains on Art's branch pending its own source commit.

## Remaining visual work

The complete house is a useful improvement, but the scene remains below final
quality. Ground needs natural blending instead of the rectangular house apron,
polygonal root patch and visible outer calibration rectangle. Vegetation needs
more convincing density/variation and the dark root/porch contact needs review.
The next A22 sampler separates decorative ground fields from solid-prop clearance;
it retains entry wear, road boundaries and all collision/placement clearances.

Character progress remains separate: the16k source study improved silhouette,
but the first corrective export was rejected before writing a runtime model.
Measured indexed seams now show two leg patches with arm contamination and two
hand-side patches with leg contamination. A topology-bound bidirectional repair
is under independent review; the previous claim of four native leg islands was
incorrect. No rejected model entered the game. The private ten-area world is also
gaining one Meadows relay using the existing quick-switch timing, still unshipped.
