# STACKED source import and implementation baseline

Date: 2026-09-06

## Original source

The owner supplied `stackedplandocsetff2934dbf26de3d7bc4c6aa1271455202d419c50.zip`.
The archive contains ten design documents and one provenance file. All ten document
SHA-256 checksums were independently checked against the archive's checksum list:
**10 matched, 0 mismatched**. The original ZIP and a separate extracted intake copy
remain unchanged outside this checkout.

The source branch is `fable/hmh-cycle-072-visual-facelift`; the source baseline is
`ff2934dbf26de3d7bc4c6aa1271455202d419c50`. That commit was found in the separate
source checkout named by the original provenance. It is the baseline the documents
were written against, **not a commit containing these previously untracked documents**.
No source code or world assets from that divergent branch were merged.

## Implementation baseline

STACKED work is isolated on `feature/stacked-solo`, starting at
`3dea4e17fb5c0e43121fc6f67b26c741202bbca0` from
`origin/hermes/hmh-cycle-075-reference-heroes`. Its ancestry from
`origin/reboot/hmh-aaa-continuous` was checked before creating the worktree.
Existing dirty HMH work in other checkouts is outside this change.

Historical measurements and source line references in the imported plans refer to
`ff2934db`, not automatically to this implementation baseline. Recheck each affected
subsystem before its cycle; do not silently replace current HMH code with old source.

## Import edits

The checksum list in `PROVENANCE.txt` records the **original archive**, not future
revisions of this document set. Each of the seven area specs received the precedence
header required by S-01. Two local-path disclosures were also removed on import:

- The source checkout path in `PROVENANCE.txt` is explicitly redacted.
- `spec/portal.md` names the repository root instead of an absolute user-home path.

No gameplay value or owner decision was changed by those redactions. Further spec
reconciliations must be recorded in the relevant cycle ledger.

## Current implementation status

S-01 is implemented and verified at
`64ba50c18c2b93bc2d277c25610f7cb9888d8f67`. The contract module and supporting tests
are not a playable cabinet. Refer to `cycles/CYCLE-001.md` and its machine-readable
evidence for actual execution results. `DECISIONS.md` now records the owner's
subsequent delegation of routine decisions and the retained irreversible boundaries.
S-02 gameplay implementation follows on this isolated branch.
