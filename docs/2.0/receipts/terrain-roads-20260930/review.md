# Roads, banks, signs and fog — real-child inspection, 2026-10-01

Real child at `/hmh-reboot/index.html?mode=free&world=ten-area&evidenceSafe=1`,
headless Chrome (WebGL) under the heavy lock, desktop 1280×800 @1x and phone
414×896 @3x, walked with WASD at 240 units/s (time under a level-up modal
does not count). `areaArtStatus` was `ready` on every capture, no page or
console errors (`real-child-report.json` per pass). Owner acceptance is not
claimed. "Before" is `pass-1/` (first road mesh build); the terrain-20260930
receipts show the earlier Graphics ribbons.

Kept: `pass-1/` (first mesh pass, both tiers) and `final/` (all seven
scenes, both tiers, after the rock-face fix, the City mast rule and the
half-tier frame fix). Receipts are JPEG q80–82; phone shots are stored at 2×
(828×1792) instead of 3×. Total 4.6 MB. Intermediate passes were dropped.

| Scene | Before (`pass-1/`) | After (`final/`) |
| --- | --- | --- |
| Meadows–Woods road | Earlier receipts: flat brown slab with two ruled rut lines beyond the area border. Pass 1: road is a dark blurred band that reads as a shadow. | Dusty compacted track lighter than the verge, eroded edges, faint broken ruts, ends fade into the meadow. No straight band. |
| Woods camp | Pass 1: worn trails as straight green/brown stripes; vertical dirt road as a ruled band. | Trails meander and wear patchily; the camp court is one irregular trodden earth area; the dirt road edge is ragged. |
| City highway | Pass 1: speckled asphalt; the closed mass south of the road is a rock slab with a ruler-straight lip. | Asphalt calmer, crack cards subdued, worn dashed chalk centre line; the mass lip is ragged and continuous across the thin closed-mass strips. The gantry card is the existing prop (fades when the hero is under it). |
| Farms gravel road | Pass 1: gravel ok, but the bank south of the road is a straight slab. | Gravel core with eroded earth shoulders; ragged bank lip, rock top with moss patches. |
| Ledger Ridge cliffs | Pass 2 never reached the ridge; pass 3 rock ground was harsh salt-and-pepper. | The lower cut reads as a cliff: continuous strata face, ragged foot, dark foot band, lit lip, above calmer rock/scree ground. An intermediate pass showed vertical stripes per ragged segment; faces now shade from the authored edge and map world-continuously. Phone tier is soft (the face strip is 256×64 at @0.5x). |
| City signs | — | `ARKADA` on the junction shelter, chalk on slate, legible on desktop. Phone: the hero walks clear; the junction mast stands on the pavement at human scale and the wreck card is whole (see below). Weak: the paving pocket between the two asphalt streets reads as a soft "spotlight" (rounded outside corner of the field ramp). |
| Bayou channel | — | Marsh/moss ground with iris on the bank, faint low fog over the channel side and banks under the hero, the bayou–river track fading out at the area edge. Fog is subtle by design (≤ 0.24 alpha). |

Phone City fix (`final/phone-city-signs.jpg`): earlier phone captures showed
clipped card rectangles filling the frame and hiding the hero. Two causes:
(1) junction masts stood 140 units from both street centrelines and never
faded — they now stand on the pavement, stay ≤ 160 units, fade over the hero,
and no ground card taller than 100 units may sit within 120 units of a walked
street or road centreline (test-enforced); (2) Pixi reads `@0.5x` file names
as resolution 0.5, so every half-tier card frame was cut in pixels against a
2048-unit page — frames, alpha sizes and fill matrices now use texture units.

Still weak: rounded city kerb corners; rock-face strip repetition every 260
units and softness on phone; uniform tops on the big closed masses; no
phone frame-cost measurement.
