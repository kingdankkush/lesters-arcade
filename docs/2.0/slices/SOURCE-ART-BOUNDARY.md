# Source-art boundary A0 â€” local authoring prerequisite

2026-09-29. A pure Python input helper is implemented; no authoring pipeline has
been migrated and no artwork has been copied, moved or removed by this slice.

`scripts/lib/source_art_paths.py` requires an explicit existing absolute art root,
a canonical relative path, a positive byte length and a lowercase SHA-256. It
rejects path traversal, absolute/UNC/alternate-stream paths, symlinks and Windows
reparse points, including root aliases and junctions that remain inside the root.
The helper reads one declared regular file in bounded chunks. A context manager
checks the same source identity before and after an authoring operation, including
when that operation fails. If the source is unchanged, the original operation
error survives; if both fail, the source failure retains the original as context.
It chooses no default archive and accesses no credentials.

The initial missing-helper RED is preserved. **17 fixture tests pass**, including
real controlled Windows junctions and input mutation/deletion/replacement. The
normal Node test wrapper passes one case containing those same 17 checks; counts
are not additive. The exact two-file Python closure also passes **17/17** with
empty PATH and without `.git` or `node_modules`. Python source compilation passes
for those two files. These cheap fixture checks are not native or browser jobs.

The helper does not lock files, withstand a malicious concurrent filesystem
writer, verify conversion fidelity, or replace an actual Blender inspection.
Before/after content identity does not prove an input was unchanged at every
instant between checks. Same-byte file replacement and hardlinks are not excluded.
The helper is not a secrets classifier; future callers must select the specifically
authorized non-secret artwork root. No real source model, image or private archive was read
by these tests. Runtime, game rules, versions and initial bundle bytes are
untouched; no new browser or release certification is claimed.

An independent source review and independent empty-PATH two-file run pass the
stated scope; their 17 checks repeat the same cases.

Next: audit one coherent source family's
real dependencies, then adapt its local authoring tools and cloud runtime checks
in a separately tested slice. Hash-copy review and actual native reconstruction
must precede any original removal, as required by SOURCE-ART-ARCHIVE.md. The strict
repository-size gate and the complete source migration remain open.
