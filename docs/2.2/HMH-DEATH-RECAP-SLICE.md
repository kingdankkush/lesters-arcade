# Liquidated recap — 2026-10-03

The standalone Free shell previously stopped on death without a usable result
screen. A lazy presentation view now follows the existing death camera with a
Liquidated report, existing run stats, final hit and bounded damage-source
totals. Grade thresholds are cosmetic: C at 20 kills, B at 75, A for one boss,
S for two. No score, reward, achievement, persistence or evidence changes.

The view owns no clock. The existing camera releases the held canonical result
once, with its existing 72 presentation ticks and two-second backstop. Reset
and disposal suppress stale completion. HUD visibility restores to its prior
state. Only standalone unbridged Free exposes a restart; embedded and Ranked
results remain parent-owned. Damage projection reads positive applied damage
only, retains at most four named sources plus Other, and clears each session.

Independent review corrected short-phone cropping with bounded panel height,
scrolling and touch pan. Inactive touch controls/hints hide during the report.
Four new behavioral tests plus death-camera and parent recap checks pass
(17 combined); the final art/actor/view integration suite passes 115 cases.

Actual desktop and 414×896 DPR3 Chrome checks pass for readable stats, final
hit, keyboard focus, local restart/reset and one parent schema-8 summary with
matching score/kills. 896×414 phone-layout scrolling keeps restart reachable.
Screenshots and machine-readable results live in the chat workspace at
`outputs/22-timber-death/`. Terminal fixtures use the existing evidence-only
pilot and Valkyrie: Commando's armor survives its max-health+1 hit. This does
not prove natural long-run deaths, physical XS Max behavior or Ranked delivery.
The local Ranked release check remains separate. No runtime pilot was changed.
