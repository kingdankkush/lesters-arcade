# Hard Money Heroes — Cycle 021 Post-Production Closeout

Date: `2026-07-27`
Branch: `reboot/hmh-aaa-continuous`
Author: Claude Agent, per
`docs/handoffs/2026-07-27-hmh-cycle-021-production-claude-handoff.md` §6 (P1).

Supersedes the production-status and rollback-identity sections of:

- `docs/hmh-reboot/RELEASE-CERTIFICATION-AAA-FINAL-CANDIDATE.md`
- `docs/hmh-reboot/DEPLOYMENT-ROLLBACK-RUNBOOK-AAA-FINAL-CANDIDATE.md`

Their safety rules remain valid. Their production identities were stale; the
identities below are the current ones.

**Status: `PRODUCTION VERIFIED BY AUTOMATION · HUMAN ACCEPTANCE OUTSTANDING ·
VERCEL DEPLOYMENT IDS UNRESOLVED`.** This is not a full closeout. Two items the
handoff lists as P0 cannot be completed from this environment and are recorded
as open below.

---

## 1. Repository identity (verified)

| Item | Value |
| --- | --- |
| Branch | `reboot/hmh-aaa-continuous` |
| Local HEAD | `1b1bd62e0380297358a66a387a85d1baaf4a4982` |
| `origin/reboot/hmh-aaa-continuous` | `a81f1c8f830f3339ebb568de166c108e58f695d3` |
| Local vs origin | **ahead 1** — the handoff commit is local-only |
| Production source commit | `a81f1c8f830f3339ebb568de166c108e58f695d3` |
| Working tree | clean |

The one unpushed local commit (`1b1bd62e`, `docs(hmh): hand off Cycle 021
production`) is documentation only and contains no runtime change, so the
runtime validated below is byte-identical to what production serves. Pushing it
requires explicit approval per the handoff's stop boundaries and has not been
done.

## 2. Local authoritative gates (all re-run 2026-07-27)

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — 332 JS modules + 49 Python scripts |
| `npm run test:release` | PASS — `1721 total / 1669 passing / 52 accepted legacy / 0 unexpected` |
| `npm run build` | PASS — HMH bundle 988.4 KB emitted |
| `npm run visual:reboot` | PASS — 8/8 scenes unchanged, 0 changed cells |
| `npm run assets:qa:hmh-reboot` | PASS |
| `npm run design:security-audit` | PASS — 5/5 checks, 0 findings |
| `npm run design:third-party-security` | PASS — 3/3 |
| `npm run design:web3-audit` | PASS — 9/9 |
| `npm run design:web3-live` | PARTIAL — 3/4 gates, 1 blocked (expected: HALT-gated paid economy) |
| `npm run audit:hmh:network` | PASS — 4 audits, zero failures |
| `npm run repo:health:strict` | PASS |
| `npm run repo:cdn-gate` | PASS — 33 CDN candidates / 101 MB, no destructive action |
| `npm run docs:links` | PASS — 8 current/public documents |
| `certify:hmh:browser` (local) | PASS |
| `smoke:hmh:cockpit` (local) | PASS |
| `smoke:hmh:collectibles` (local) | PASS |
| `smoke:hmh:performance` (local) | PASS |

Every figure matches the Cycle 021 automation totals recorded in the handoff.

## 3. Public production verification (verified against `https://lestersarcade.io`)

```bash
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run certify:hmh:browser   # PASS
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run smoke:hmh:cockpit     # PASS
HMH_REBOOT_ORIGIN='https://lestersarcade.io' npm run smoke:hmh:collectibles # PASS
```

### Public artifact fingerprints (fetched and hashed 2026-07-27)

| Artifact | Bytes | SHA-256 | Matches handoff |
| --- | --- | --- | --- |
| `/dist/hmh-reboot/game.js` | `1,012,139` | `7e6938dbad83dd1b36d71cc2cdc03008f36b30213754b2fb36bc13d4643492da` | yes |
| `/hmh-reboot/index.html` | `5,919` | `4d388732081fd597ad4e7de7b0267ba3bd86f51ddf85bc14ea93b3503752c525` | yes |
| `/sw.js` | `3,508` | `8146ed967e426c70d9dc439494168c85be32892720fec8e9794347a10d6b504a` | yes |

- `Cache-Control: public, max-age=0, must-revalidate` — as recorded.
- `Content-Type: application/javascript; charset=utf-8` on the bundle.
- No Vercel Authentication shell on the public alias.

The public build is therefore confirmed to be exactly Cycle 021.

## 4. Deployment identities

| Role | Source commit | GitHub deployment | Immutable URL | State |
| --- | --- | --- | --- | --- |
| Current production | `a81f1c8f` | `5626423782` | `https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app` | success |
| Cycle 021 preview | — | `5626388771` | `https://lesters-arcade-fgzvqbcjk-justin-agent-projects.vercel.app` | success |
| Immediate previous production | `9ff359ea` | `5619406683` | `https://lesters-arcade-g242ggtb8-justin-agent-projects.vercel.app` | success |

Both production records were re-queried through the authenticated GitHub CLI
and confirmed: commit SHAs, `Production` environment, `deploy` task, `success`
state, and matching `environment_url`.

### Open: Vercel `dpl_...` IDs remain unresolved

The handoff's claim is confirmed. The GitHub deployment payloads are empty
(`{}`) and the statuses expose only `target_url` / `environment_url`. No
`dpl_...` identifier is retrievable from GitHub. The Vercel CLI is not
installed and no local Vercel auth state exists.

**Warning for whoever resolves this.** Fetching the immutable production URL
unauthenticated returns HTTP 200 with a 484 KB HTML page titled
`Login – Vercel` — Vercel's SSO login app, not the deployment. That HTML
carries a `data-dpl-id="dpl_9CHmB6wfZMkqAyxsk3eX3ZV4sg6R"` attribute, which
belongs to **Vercel's own login application**, not to this project's
production deployment. Do not record it as the production deployment ID. The
real IDs must come from an authenticated Vercel CLI session or the dashboard.

Consequence: the rollback identity chain is documented by immutable URL and
commit, but not yet by `dpl_...` ID. Rollback should not be attempted until
those are resolved — and rollback itself requires explicit approval regardless.

## 5. Human acceptance — NOT COMPLETE

The handoff's P0 desktop/controller and real-phone checklists require physical
hardware and human judgement. Neither has been performed, and neither can be
performed from this environment. Nothing in this document should be read as
substituting automated viewport certification for physical-device acceptance.

Outstanding, verbatim from the handoff §6:

- Desktop/controller: keyboard+mouse and real controller including reconnect
  and focus loss/recovery; audio balance; Liquidator warnings; grenade radius;
  damage feedback; reduced motion; reduced flash; screen shake.
- Real phone (not emulation): iOS or Android; portrait and landscape; both
  sticks and all eight touch controls; HUD/minimap/warnings/upgrades/Pause/
  Restart usability; touch ergonomics; audio balance; heat/thermal; battery;
  motion comfort. Record model, browser, OS version, session length, verdict.

## 6. Settlement and Web3 boundary (verified unchanged)

- `SETTLEMENT_LIVE` remains `false`.
- `design:web3-audit` 9/9; `design:web3-live` PARTIAL 3/4 with the single
  blocked gate being the pre-existing HALT-gated on-chain registry/economy item.
- No wallet, signature, transaction, LitVM, contract, or settlement action was
  taken or attempted in producing this document.

## 7. Rollback procedure (current)

Until `dpl_...` IDs are resolved, the rollback target is identified by commit
and immutable URL:

- Roll back to source commit `9ff359ea` / GitHub deployment `5619406683` /
  `https://lesters-arcade-g242ggtb8-justin-agent-projects.vercel.app`.
- Execution requires an authenticated Vercel session and **explicit approval
  for that exact action**. Confirm first whether the Hobby-tier rollback UI can
  still target that deployment.
- The older `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9` record referenced in pre-Cycle-021
  documents is **no longer** the immediately previous production and must not be
  used as the rollback target.

## 8. What this closeout does not certify

- Physical desktop/controller acceptance.
- Physical phone acceptance.
- Vercel `dpl_...` deployment identities.
- Any live verified Web3 publication or settlement.
- Long-horizon production observation (service-worker update behaviour, stale
  bundle reports, mobile heat/battery, controller reconnect in the field).

Closing those is the remaining path to a full production closeout.
