# Silver Coast — area brief draft

Status: local Coast W2e geometry/nav/native-browser checkpoint passes; owner playtest, full area design and art acceptance remain open. Part of the continuous 20,000 × 14,000 world. See [brief index](INDEX.md) for shared scales, authorisation and gates.

**Story and flow.** Homes face the sea while a cliff road serves them from behind. Beaches, rock shelves and piers explain where players can walk and where the coastline blocks travel.

**Landmark.** A lighthouse over a layered headland, visible from the inland road.

**Routes in and out.** Paved road to Litecoin City and a coastal path into Scrypt Bayou. Provide a landward bypass so the scenic beach route is a choice rather than an untelegraphed trap.

**Objective staging.** Place a coastal service objective at its actual utility structure near the road, with a dry approach and clear interactable face. The lighthouse and mansions frame navigation; do not add new objective mechanics until their versioned slice exists.

**Combat and height.** A terrace court and an open beach clearing alternate with a cliff path. Stone walls and lower pier furniture offer cover; a dry overlook offers elevation with an explicit legal return route. Keep ledge/drop affordances gated until traversal is implemented.

**Secret.** A mansion-side service entrance leads into a playable mansion-interior secret and returns through a clear legal route. Its interior geometry, entry and return must pass the greybox nav contract before interior art starts.

**Art sub-palette.** Sand #B8AC8F, chalk #D8D5C6, water #406764; board L07/L08.

**Greybox acceptance focus.** Blocked deep water, walkable shore, pier decking and cliff edges need distinct shape/value cues. Waves and reflections remain presentation only. Check coast curvature and outside-bounds lattice guards, including phone visibility beside bright sand.

## W2e local layout checkpoint

Silver Coast contrasts with City's orthogonal streets through an oblique
rock silhouette, an open dry shelf and a faceted lighthouse. Two visible cliff
polygons shape the western edge rather than repeat four corner buildings. A
landward route connects the unchanged City and Bayou entrances, while a longer
scenic path curves around the lower rock mass. The scenic path can be blocked
without trapping through traffic. The dry overlook sits in a notch between the
rock masses and has a shallow ramp with a legal return route.

The mansion's road-facing south door enters an actual roof-free wall shell. Its
secret is inside that shell; a west-facing service door exits toward the coast
and rejoins the through-route. Roof visibility/occlusion and final interior art
are later presentation work. A small utility building sits beside the landward
route with its interaction marker just outside its west face. The lighthouse
is the headland landmark, not an unimplemented objective trigger.

Future terrain and asset placement follows the coast's use and exposure:

- Rock faces: large chalk facets and broken ledges following the authored oblique
  silhouette. Smaller rubble gathers at the foot and at sheltered corners; it
  must not scatter uniformly across the shelf or imply extra collision.
- Coastal shelf: pale dry ground with wind-aligned wear and sparse low planting.
  Keep a visible walking band between cliffs and the road. A lower beach is
  future art/map work, not something these dry-ground checks certify.
- Landward road: consistent paving and a small shoulder with service wear near
  the utility structure. Put bollards, drains and cables at logical edges,
  preserving the through-route and objective stand-off.
- Mansion: sea-facing principal facade, road-facing service access and contained
  garden edges. Furnish the interior by room purpose after its two-door travel
  works; avoid placing decoration in either entrance or the secret's return.
- Lighthouse: a taller faceted silhouette with a clear viewing apron. Keep
  planting low on the approach so the landmark remains visible before arrival.
- Overlook: supports, exposed rail edges and wind wear belong to the dry platform.
  A rail gap or ladder must not promise unavailable climbing or dropping.

These polygons are rock barriers and dry walkable ground. They do not implement
deep-water collision, swimming, tide changes, beach slowdown, reflection effects,
pier art or a new traversal rule. Those remain separate versioned/approved work.
All final terrain/material choices still require the art bible and target slice;
whole-area playtest, physical-phone performance and official map approval remain
open. Local geometry, RED/GREEN and one native browser check pass; the phone
walking view still needs nearby landmarks and stronger ground hierarchy.

See [W2e evidence and limits](../slices/WORLD-W2E-COAST.md) for the actual checks.
