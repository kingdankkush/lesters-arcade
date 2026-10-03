# STACKED ledger pacing — October 2, 2026

Owner-requested easier early hard rows. Implemented as a version-selected solo
rules change, dormant for the current 2.1.1 release. No version constants or
cache markers were changed by this slice.

| Timing | Existing runs / unspecified local labels | Canonical game 2.2.x |
| --- | --- | --- |
| Timer arms | 60 seconds | 90 seconds |
| First queued ledger row | 72 seconds | 108 seconds |
| Initial interval | 12 seconds | 18 seconds |
| Tightens | 0.5 seconds every 45 seconds | 0.5 seconds every 90 seconds |
| Minimum interval | 2 seconds | 6 seconds |

Rows still enter on the existing lock boundary, so visible rise may occur
after the scheduled queue tick. Gravity, scoring, board rules, input encoding,
row rejection, garbage hole RNG and local-versus attack routing are unchanged.

## Authority and compatibility

The server's canonical identity does **not** contain `gameVersion`. Its signed,
session-hash-bound `buildHash` contains `site-X:game-Y:cabinet-Z`. The solo runtime
strictly derives Y from that label once. Browser play, undo reconstruction,
parent lifecycle replay, verification worker, local score recording and server
reverification already supply the same buildHash; no URL or child-provided
choice can select another schedule once the server authorizes its release.

Independent review found a real authority gap: the seed issuer accepts a
format-valid build label, so a valid MAC alone cannot prove that its gameplay
rules have shipped. The production STACKED verifier is now bound to the deployed
`GAME_VERSION` inside a server-only factory. It rejects newer canonical game
versions before inspecting evidence; normal dispatch and stored reverification
use that same default verifier. The request cannot override this ceiling. An
isolated test factory bound to 2.2.0 verifies candidate parity without changing
release constants. Shared simulation dispatch supports legacy versions through
2.1 and the exact planned 2.2.x line; unknown later lines fail closed instead
of inheriting future rules. Seed issuance and settlement source were untouched.

Plain legacy local labels and missing versions keep the old schedule. An
optional strict `config.gameVersion` permits isolated development tests and
must agree with a canonical buildHash. Malformed versions, prerelease strings,
leading zeros, unsafe numeric components, getter properties and conflicting
explicit versions are rejected. New rules append a canonical-state hash domain
marker; old snapshots, state bytes, evidence and result tuple format remain.
SIC1 still needs its accompanying canonical session identity to replay correctly.

No bridge change is needed: the trusted init session already forwards buildHash
and the child spreads it into play-session creation. The worker accepts the
optional gameVersion, and Free undo retains its selected config. Normal local
versus configurations remain legacy, keeping its attack mechanics unchanged.

## Verification

Three new regression cases failed before implementation: new timing, strict
version selection and client/server new-run parity. The first undo test was
too weak to detect an ignored version; it was strengthened to step through the
90-second timer boundary after undo.

Focused simulation/determinism, core, match, play-session, worker, old server
fixtures, Ranked settlement, API guards, authority regressions and the purity
audit: **150 passed, zero failed** after the authority correction.
Additional assertions cover future-version selection, getter rejection, new
state domain and rejection of new evidence under an old canonical binding.

The existing purity gate initially rejected the new helper import. Its strict
graph now audits all four simulation modules with the same forbidden clocks,
randomness and ambient APIs; the helper is allowed to import constants only.
The purity/adversarial suite plus pacing cases passes **46/46**, including a
counterexample that attempts to import Date through the ledger helper. New
runtime modules and regression tests are registered in the syntax gate.

The 432,000-tick pinned legal legacy replay reproduces its exact existing tuple.
New no-input play reaches the first queue at tick 6,480; its eventual terminal
result matches browser play-session, parent lifecycle, worker and server replay.
This is deterministic automated evidence, not a human or live Ranked run.

Authority regressions issue valid tickets using the public fixture secret for
claimed 2.2 and 99.0 builds, prove canonical identity binding succeeds, and then
prove production replay and stored reverification reject those versions.
Historical 1.9.4, 2.0.0, 2.1.0 and 2.1.1 bindings still reproduce the old board.

Independent review, actual-browser playtest, combined byte-budget check and
full release certification remain owned by the integration agent. The easier
schedule becomes public only in a separately certified release carrying game
version on the certified 2.2.x line. Independent re-review of the authority
correction passed; browser, budgets and release certification remain pending.
