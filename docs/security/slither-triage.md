# Slither Triage

Status: placeholder for WO-125.

Slither is not yet wired as a blocking CI gate. The handoff requires `contracts:slither` to be informational, with new HIGH findings blocking once the suite is active.

Known baseline at remediation start:

- `contracts:check` is structural only and does not execute contract behavior.
- Foundry security baseline tests are being added under `contracts/test/` to cover the handoff's invariant requirements before production Solidity fixes land.
