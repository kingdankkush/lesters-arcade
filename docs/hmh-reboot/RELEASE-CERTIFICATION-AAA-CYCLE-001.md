# HMH AAA Cycle 001 Release Certification

Generated: `2026-07-24T15:40:48Z`

Status: **PREVIEW VERIFIED; PRODUCTION APPROVAL PENDING**

## Scope

Cycle 001 closes the historical local analytics 404, removes four latent broken retired-art references, adds permanent clean/warm network and console observability, fixes direction-dependent movement acceleration, and aligns camera follow with interpolated render state.

It does not deploy contracts, change Web3 authority, promote production, change save/bridge/session contracts, or replace active artwork.

## Exact source

- Branch: `reboot/hmh-aaa-continuous`
- Base: `68c981449f6c62936729f14ec08c4d6f6db57d66`
- Code patch scope: `git diff --binary 68c981449f6c62936729f14ec08c4d6f6db57d66 -- apps scripts tests package.json`
- Code patch SHA-256: `88bf1d296e7ff1f7127744c365dee8b2c1c4400a30acbbefeac67c2668990edd`

## Verification

| Gate | Result |
|---|---:|
| Syntax | PASS, 319 JS + 40 Python |
| Exact release suite | PASS, 1,616 total / 1,564 pass / exact 52 accepted failures |
| Build | PASS |
| Active assets | PASS, 4 atlases / 2,569,321 bytes |
| Security | PASS, 5/5, zero findings |
| Sandbox security | PASS, 3/3 |
| Web3 source boundary | PASS, 9/9 |
| Web3 live readiness | PARTIAL, 3/4, contracts undeployed |
| Repository budget | PASS |
| CDN gate | PASS, no destructive action |
| Fuzz/benchmark/soaks | PASS |
| Four production heroes | PASS desktop/mobile |
| Combat/cockpit/embedded/portal | PASS |
| Clean/warm network audit | PASS, zero HTTP/fatal request/console/page errors |
| Chrome matrix | PASS, 5/5 |
| Edge matrix | PASS, 5/5 |
| Visual review | PASS, no Cycle 001 regression |

## Built artifact

- HMH game bundle: `962,113` bytes
- HMH game bundle SHA-256: `bde4d3e5b9df49760c5944c0d0c84b020656f071eccb48732db8bcdcb604d847`
- Portal main SHA-256 after the required curated-level generator: `df9c811971dfec7ba7b88e2cf4b4c20d216faeffbf814f613daf7f791926ae81`
- Service worker SHA-256: `8146ed967e426c70d9dc439494168c85be32892720fec8e9794347a10d6b504a`
- Portal index SHA-256: `06465ce0e247a3d07c27e384ad845fc2feb2e77a1cf4d5e26d044f607d682184`

## Runtime evidence

- Desktop keyboard: `+75.185 x`, `0 y`
- Mobile touch: `+40.637 x`, `0 y`
- Desktop/mobile p95 frame time: `7 ms`
- Desktop heap delta: `-8,362,073` bytes
- Mobile heap delta: `-5,968,187` bytes
- Maximum retained heap delta across controlled soaks: `604,512` bytes
- Browser errors: `0`

## Boundaries

- Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`.
- Durable rollback remains `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`.
- Production promotion is not authorized.
- LitVM contract deployment remains HALT-gated and was not performed.

## Remaining release gate

Replacement preview `dpl_CZoPtPy5uriibhEmpcrnZPsEpD26` is exact-artifact verified. Stop for explicit production approval.
