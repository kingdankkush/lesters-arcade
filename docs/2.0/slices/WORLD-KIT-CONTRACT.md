# WORLD kit polygon contract

The local greybox kit now rejects self-intersecting stars, repeated loops and
duplicate/zero-length edges before passing a polygon to the unchanged collision
constructor. Local convex-turn signs alone did not reject these shapes. The
authoring-only simplicity tolerance is1e-8; valid winding and exact visible versus
physical footprint behavior are retained. No active collision/rules module,
authored layout, normal game input graph or version changes.

Actual RED: four cases give one valid triangle/winding control PASS and three
genuine malformed-polygon FAILs. Minimal GREEN:4/4 and the same4/4 in an exact
six-file copy with emptyPATH, no.git and no node_modules, zero skips/cancels.
Both actual Node children close normally, exact shared marker is released, and
all seven old authority-helper hashes remain unchanged. Counts are repeated,
not additive. Original source/test/harness and raw observations are preserved
under `docs/2.0/receipts/world-kit-contract/` with an exact manifest.

This is a pure authoring guard, not a new nav/world/device/performance/browser
acceptance. W1b/W2a remains the repetitive local navigation checkpoint described
in [WORLD-W1B-W2A](WORLD-W1B-W2A.md); Meadows authored-flow has separate tests and
actor-scale native review pending. No push, version bump or deployment.
