# Reboot 13 retained TDD RED evidence

Date: 2026-07-23

Command:

```text
node --test tests/hmh-reboot-production-unlockable-pilot.test.mjs
```

Initial result before implementation:

```text
tests 4
pass 0
fail 4
```

The four intended failures established that:

1. The production manifest had no `lester-original` or `lilly` entries.
2. No repository-owned Lester/Lilly atlas, metadata, metrics, or contact-sheet artifacts existed.
3. The runtime production registry approved only the two starter heroes.
4. The portal did not propagate the exact four canonical actor IDs into the reboot child.

A second focused RED after adding manifest/runtime wiring retained the missing-artifact failure:

```text
Lester and Lilly emit separate deterministic repository-owned production evidence
ENOENT: lester-original-production-pilot-atlas.json
```

The final focused suite passed only after both actors were generated, independently reproduced, registered, and bridged under their canonical IDs.
