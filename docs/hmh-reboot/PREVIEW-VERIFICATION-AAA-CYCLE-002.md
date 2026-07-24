# HMH AAA Cycle 002 Preview Verification

Verified: `2026-07-24T22:41:50Z`

Status: **PASS**

## Exact candidate

- Source commit: `ab8eecdbe7ec40e3451ef8b10f58ae3095a3a170`
- Deployment: `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN`
- Target: `preview`
- State: `Ready`
- URL: `https://lesters-arcade-ck25dqelb-justin-agent-projects.vercel.app`

## Remote build

The Vercel build independently passed:

- release ledger: `1,619 total / 1,567 passed / 52 accepted / 0 unexpected`
- syntax: `319` JavaScript modules + `40` Python scripts
- contract structure
- generated-asset verification
- curated runtime references: `74/74`
- HMH bundle budget

## Byte verification

Protected preview artifacts were fetched with authenticated `vercel curl`.

| Artifact | Bytes | SHA-256 | Result |
| --- | ---: | --- | --- |
| `/dist/hmh-reboot/game.js` | 963,568 | `33131067b0c913afce71d2c0633254c4ea5b4a3828a0483ba79cf21f52e986a1` | exact match |
| `/dist/main.js` | 1,246,613 | `df9c811971dfec7ba7b88e2cf4b4c20d216faeffbf814f613daf7f791926ae81` | exact match |
| `/sw.js` | 3,508 | `8146ed967e426c70d9dc439494168c85be32892720fec8e9794347a10d6b504a` | exact match |

Vercel preview feedback injection adds one 163-byte deployment-scoped script after each delivered HTML document. Removing that expected line leaves source HTML byte-identical:

- HMH delivered: `4,528` bytes, `6356dbdf61668fb8939f6d4dfc18216a02151931f712b100a30c8ed6b5e07d60`
- Portal delivered: `37,255` bytes, `50e6b5db81ff23d3926e39b24c18551b5e91a55dbc64832094842418b6107291`

## Headers

- Parent portal: `200`
- HMH route: `200`
- HMH game bundle: `200`
- HMH route alone permits PixiJS `unsafe-eval`
- Parent portal and JavaScript route do not permit `unsafe-eval`
- HSTS and `nosniff` are present
- Preview is `noindex`

## Browser proof

The final Vercel-built game bytes were exercised locally before deployment:

- desktop same-task pointer fire, melee, grenade, and dash: PASS
- mobile same-task melee, grenade, and dash: PASS
- active actor: Lit Commando production atlas
- page, console, and HTTP errors: `0`
- exercised game SHA-256 matches the deployed preview artifact

## Protected state

- Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`.
- Durable rollback remains `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`.
- No production alias changed.
- No LitVM transaction or deployment occurred.

## Next gate

Explicit approval is required to promote exact deployment `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN` to production. LitVM remains separately HALT-gated.
