# Slither Triage

Status: **active local baseline established 2026-07-08**.

## Gate

```bash
npm run contracts:slither
```

Current script:

```bash
slither . --config-file slither.config.json --fail-high
```

Current config:

- Filters dependency noise: `filter_paths = node_modules`
- Excludes low/informational findings from the gate output
- Uses `--fail-high` so new high-severity findings block the security gate

## Current baseline

Toolchain used locally:

- Foundry: `forge 1.7.1`
- Slither: `0.11.5`
- Solidity compiler through Foundry: `0.8.24`

Latest local result:

```text
INFO:Slither:. analyzed (18 contracts with 63 detectors), 0 result(s) found
```

Verdict: no Slither findings are currently accepted as known-risk baseline items. Any future nonzero result should be triaged here before suppression or merge.

## Triage policy

Slither is a static analyzer, not a full audit. Treat it as a fast CI guardrail paired with Foundry behavior tests.

For each future finding:

1. Record detector name, impact, confidence, file, function, and command output.
2. Decide: true positive, false positive, intentionally accepted risk, or test-only/dependency noise.
3. If true positive, add or update a Foundry/JS regression test before fixing.
4. If false positive or accepted risk, document the reason here before adding any exclusion.
5. Keep `--fail-high` enabled; do not globally downgrade the gate to hide a finding.

## Related docs

- `docs/security/WEB3_SECURITY_SKILL_NOTES.md`
- `docs/security/REMEDIATION_LOG.md`
- `docs/security/lesters-arcade-security-remediation-handoff.md`
