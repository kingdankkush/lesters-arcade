# 2.0 source-art archive: measured prerequisite

2026-09-29. Planning and metadata inventory only. No artwork has been removed from Git, moved or deleted. This prerequisite implements the owner's runtime-only Git LFS and repository-size requirements; it does not authorize a release or weaken existing identity checks.

## Current bytes

Candidate `25bdb41f6947e14c58aa6b782ae7928704509912`. [Inventory](receipts/tracked-art-inventory-20260929.json) records tracked artwork filenames and filesystem lengths, with no image/model payload. Git is used for this one-time authoring inventory, never by tests.

| Measurement | Bytes |
| --- | ---: |
| All 4,251 tracked files, resolved checkout | 870,164,584 |
| Strict repository cap, 350 MiB | 367,001,600 |
| All 1,185 tracked art-format files | 708,418,735 |
| Editable Blender models | 494,780,386 |
| Other art under source directories | 43,289,889 |
| Other art, including runtime and references | 170,348,460 |

All tracked files are present; this inventory found no unresolved LFS pointers. The total-file measurement uses the same `stat` accounting as `scripts/repo-health.mjs`. It excludes Git history/object storage and untracked files. Categories use extension/path heuristics; they do not establish that a file is unused or safe to remove.

Archiving models alone would project 375,384,198 B remaining, still above the cap. Models plus other source-art candidates would project 332,094,309 B before further assets and documentation. This is subtraction, not a passed strict gate. Runtime animation, sound and texture packing may need further savings as the final world and roster grow; their actual measurements will set that work.

## Archive boundary

Use only the non-secret artwork root supplied by the owner: `C:\Users\just_\Desktop\Projects\LestersArcade-Assets\2.0\Source\`. New Meadows authoring has its own `Meadows-Pilot-20260929` folder. A legacy-source snapshot should use a separate `Legacy-Integration-04366747` folder and preserve original repository-relative paths.

Resolve every source and destination before copy. Sources must be tracked art within the selected worktree; destinations must remain inside the exact artwork archive folder. Never follow a candidate symlink into unrelated data. Never read or modify the credentials vault, `.tripo`, Vercel secrets or existing reference folders.

For each copied file, record path, bytes and SHA-256 before copy, verify the archive copy against the same hash, then recheck the original. Keep originals until all copy receipts and the source-dependent pipeline changes have passed review. Do not rewrite Git history, remove referenced runtime assets, or remove anything from another session's worktree.

## Required tested migration

1. Audit every selected source's real references in scripts, manifests, authoring commands, tests and documentation. Classify runtime, authoring-only and archive/reference uses explicitly. The numerical categories above cannot replace this dependency audit.
2. Introduce an explicit non-secret source-art root for authoring tools. Write failing tests for approved source resolution, missing files, escaping paths, wrong hashes and immutable inputs before adapting the tools. Preserve source identities, rigs, UVs, clips and reproducible runtime output.
3. Keep the cloud build independent of the private artwork archive and `.git`. Runtime checks must validate committed optimized assets, declared hashes and durable conversion/pose receipts. Actual editable-source and native-render checks belong to a separately named local authoring gate. Preserve meaningful identity checks rather than adding retired exceptions or accepting unverifiable substitutions.
4. Archive and hash-copy a small coherent source family first. Run its local authoring gate from the archive, runtime checks from a source-free/no-Git checkout, actual browser checks when runtime packaging changes, and the strict byte gate. An absent private source must not masquerade as a passing native source inspection.
5. After these pass and independent review confirms the retained source copies and checks, remove only that family from this branch's index and checkout. Update manifests, reproducibility commands and handoff together. Repeat in small reviewed families.

The final combined release still needs fresh full certification under the shared heavy lock. This inventory changes no runtime, assets, rules, versions, settlement or deployment.
