# Terrain and farmhouse source review

September 30, 2026. The owner reiterated approval to improve and polish terrain
and characters. This review supports the next private art iterations; it admits
no runtime asset and does not mark terrain or characters complete.

## Useful source material

Five existing GLBs were read and their embedded texture payloads inspected:
road47, hedge75, fern04, shrub01 and daisy10. Original files retain exact hashes.
The road has 57,960 triangles; each inspected source carries three 4096-square
maps. Those are source assets, not proposed phone payloads. A simple RGBA8 decode
would be 192 MiB before mipmaps per source; actual GPU residency was not measured.
Existing ground maps largely contain noise/flecks, explaining why palette changes
alone did not supply recognizable leaves, grass or asphalt aggregate.

Road47 native top views now show the real UV-mapped geometry and surface character.
One PBR view and one copied-material emission/albedo view were reviewed at their
original 768-square size. They intentionally use different shading; neither is a
runtime tile. A source-space patch above the painted stripe and left of the hole
is a useful candidate: after four-metre horizontal normalization, approximately
centre (-0.55, 0.7), footprint 1.75 by 1 metres. A 224 by 128 bake would provide the
draft 128 texels/metre. This crop has not yet been baked or placed. Its edge mask,
sampling and composed appearance still need review. Preserve quiet path centres;
do not imply a new step or hazard from the source slab or pothole.

## Farmhouse findings and correction

The first comparison toggled the retained A5 body, foundation and replacement
roof under identical lighting and camera. All three original 768-square images
were inspected. Its `original.png` label means the retained imported component
inside the A5 derivative, not the untouched owner GLB. A5 had already removed
upper roof faces. The added slate plane obscures upper architectural detail;
the dark porch is present without it. Thin straight foundation lines remain.

The next attempt correctly stopped before import on a source-hash mismatch:
the raw `models/62` file differs from the delivery GLB actually recorded by A5.
That failed attempt is retained. The corrected comparison uses the exact
6,942,096-byte `delivery/HMH-Level-Design-Batch-2-Models/GLB/B2-62 - Clapboard
Farmhouse.glb`, SHA-256
`a63251de2278f8de195776a0d9eac2304c1ad70224063f1ec87b57f491356fb8`.
Its original hierarchy and A5 normalization were independently reviewed.

The two corrected original images show that the complete owner model has a
shallower apparent roof, visible upper windows and a separate porch roof. The A5
replacement extends farther down the image and hides that storey. Recommendation:
reuse the complete owner house for the next composed study; preserve weathering
initially and scope any later hole repair locally. Do not retain the broad A5
replacement merely because its technical checks passed. Porch lighting/readability
remains a separate problem; no global lighting change was made.

## Evidence and limits

Each native comparison ran once in its reviewed bounded slot with two CPU threads.
House components: 21.58 seconds, PID19744, successful closure. Wrong-source attempt:
6.14 seconds, PID42776, failed as described. Correct owner comparison: 11.93 seconds,
PID18092, successful closure. Road top views: 4.92 seconds, PID27904, successful
closure. Every child closed with null signal and was independently observed absent;
each exact owned lock was released. All source inputs remained unchanged.
The archive retains producers, wrappers, complete receipts, failed attempt,
source inventory and image hashes; full originals remain in workspace outputs.

World W3d was gathered as `9b10c5610`. A 63-entry closure audit verifies all source
and protected bindings, allowing one source newline normalization and explicitly
preserving the root's previously committed STACKED local-page build entries.
The root build blob is identical before/after the gather. This is source/evidence
equivalence, not fresh combined-build or release certification.

A18's calm ground and smoother boundaries are useful but the composed patch still
fails art review. Grass geometry, original-house reuse, local road detail and
readable contacts are active work. Native stills do not certify gameplay framing,
actor/doorway scale, depth sorting, final art, physical-phone performance, or release.
