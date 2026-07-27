# HMH AAA Continuous Improvement Cycle 017

Date: 2026-07-26
Status: `LOCAL CERTIFIED · INCLUDED IN THIS CYCLE COMMIT · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `6292cc57` — `feat(hmh): show grenade danger radius`

## Player-facing problem

Desktop upgrade cards explained each offered choice, but the mobile breakpoint deleted every explanation with `display: none`. A touch player could see the themed title and short mechanical label but could not inspect the authored explanation before selecting. Putting a help control inside the selection button would create invalid nested interaction and accidental purchases.

## Bounded implementation

- Wrapped each authored upgrade option in a semantic `role=listitem` card.
- Kept upgrade selection as its own button.
- Added a sibling `<details><summary>` disclosure for the existing authored description.
- Compact phone layouts start collapsed; desktop/tablet/short-landscape preserve visible descriptions.
- Added truthful `aria-expanded` updates and an authored cyan focus treatment.
- Preserved three-column desktop/short-landscape composition.
- Added a portrait-tablet two-column layout with the third option spanning both columns.
- Removed the mobile CSS rule that destroyed descriptions.
- Did not change upgrade IDs, ranks, effects, balance, selection ordering, save authority, bridge authority, or settlement behavior.

## TDD evidence

1. **RED** — the upgraded cockpit browser contract required three disclosure siblings; the untouched UI failed `0 !== 3`.
2. **GREEN** — production cockpit DOM and CSS added sibling disclosures without nested controls.
3. **Browser proof** — real interaction opened the first phone disclosure without selecting it, produced `aria-expanded=true`, retained three enabled choices, used a 44 px target, and kept the panel within the viewport.
4. **Regression guard** — source contract rejects hidden mobile descriptions and nested description content inside the selection button.

## Responsive evidence

`node scripts/hmh-reboot-cockpit-browser-smoke.mjs`

- Desktop `1440×900`: three complete cards, descriptions visible, selection still works.
- Tablet `768×1024`: two-column plus full-width third option; no title/mechanical fragmentation.
- Phone `390×844`: one-column bottom sheet, 44 px disclosure target, open explanation contained at `x=0`, `y=284.3125`, `w=390`, `h=559.6875`.
- Short landscape `844×390`: three readable cards fully contained.
- All profiles: no browser errors; menu, profile, music, upgrade selection, score, level, and XP behavior preserved.

Visual evidence is stored only under ignored `.hermes/evidence/hmh-reboot-16-cockpit/` and is not committed.

## Certification

- Focused progression/shell tests: `19/19` PASS.
- Visual regression: `8/8` PASS, zero delta.
- Performance: desktop/mobile p95 `7 ms`.
- Release retirement gate: `1,714 total / 1,662 passing / 52 accepted legacy / 0 unexpected`.
- Five-profile browser release certification: PASS.
- Security audit: `5/5`, zero findings.
- Bundle: `1,008,729 / 1,050,000` bytes.
- Syntax, build, diff check: PASS.

## Safety statement

- `SETTLEMENT_LIVE=false` unchanged.
- No wallet request, signature request, transaction, LitVM operation, settlement change, push, deployment, or production replacement occurred.
