# W3b — dormant ten-area geometry context

2026-09-30. Source geometry preparation passes. The active game and verifier retain their legacy defaults.

## Change

The new pure createWorldV2Geometry adapter accepts authored geometry, copies selected data before deep freezing, and rebuilds the existing ground query. It exposes exact bounds, ground, collider shapes/height bands, stable two-coordinate area lookup, road polylines/endpoints and an explicitly named inspection start. It preserves infinite collider heights and normalized ledge vectors without JSON conversion or renormalization.

The ten authored areas are sorted by stable ID. Road gaps return no area; x-only district guessing is not used. Duplicate/overlapping/outside areas, ambiguous road endpoints and broken entrance bindings fail early. Shared-edge lookup and road endpoints use the same ownership predicate. Input mutation cannot change a returned context, and the adapter does not freeze caller-owned data.

It omits gameplay tiers, seed entries, player/spawn contracts, objectives, secrets, bosses, arenas, rewards, triggers and climb/drop markers. Roads are metadata, not bidirectional movement permissions. No runtime, URL, schema, game-version or verifier registration imports this module. Current main, legacy map/context, collision, elevation, nav, gate logic, seed, settlement, schema and version bytes remain unchanged. The only other implementation edit is two syntax-list entries.

## Actual checks

First RED: all twelve original cases failed for the missing adapter; child 14736 exited 1/null. After implementation, independent Character review found a shared-edge endpoint/lookup disagreement. A thirteenth regression reproduced it: child 45196 exited 1/null for the missing expected TypeError. The original boundary wrapper is retained as failed because it expected twelve listed skips while this Node version emitted only the selected test. Its TAP proves one real regression failure; no retry or rewritten passed flag hides the reporting mismatch.

The minimal repair shares one area-owner predicate between lookup and road endpoint validation. The regression retains invalid from/to cases, a valid shared-edge control, and reversed area order. Character re-reviewed the installed repair and confirmed the finding resolved in source.

| Group | Source | Identical isolated copy |
| --- | ---: | ---: |
| geometry | 13/13 | 13/13 |
| ground-and-navigation | 18/18 | 18/18 |

Final total: **31/31 source and identical 31/31 isolated** with no failures, skips, cancellations or todos. The exact closure contains 34 files / 285804 bytes. The copy has no .git or node_modules and an empty PATH. Tests never query Git.

The new cases compare real authored ground samples and collision data, all fourteen roads and fifty-seven local polylines in both directions, exact full-world Uint8Array nav and Int32Array/Int8Array flow arrays, all twenty-eight entrances and inspection-start clearance. Eleven independent caller mutations cover nested geometry and query ownership. A real one-way ledge and the existing interior gate open/reclose comparator retain directed semantics. Existing W0 coverage still exposes the unresolved outer-border gate patch mismatch; it is not silently accepted as fixed.

Each final group had a 30-second cap. All four children (18884, 46060, 39564, 12544) closed 0/null, were observed absent before marker release and independently afterward. Protected files stayed byte-identical. Compact lossless reports, hashes, runners, exact pre-fix helper, closure and review are listed in [the archive manifest](../receipts/world-w3b/archive-manifest.json). The 34-file execution copy stays outside Git.

## Limits and next step

This is a dormant geometry adapter, not a complete official world contract or playable runtime integration. No new map or evidence schema is registered. No renderer, browser, full release gate, Ranked end-to-end, production probe or physical-phone test ran for this source-only slice. W3a old-run evidence remains unchanged; its full corpus was not redundantly rerun for an unimported geometry module.

Next integration must explicitly carry world context through the actual simulation, entry selection, reveal, placements, atmosphere, field map, missions and boss slots, with separately reviewed versioned evidence. Inspection starts and preview labels must not be promoted into gameplay rules by inference. Owner greybox/art approval, production area art, whole-map streaming and actual iPhone performance remain open.
