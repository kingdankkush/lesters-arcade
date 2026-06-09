# Playtest Findings — 2026-06-08 (post controls/sprites/lighting)

Live playtest on lestersarcade.io (v12), driven via browser console eval
(browser_navigate was timing out; console/CDP worked).

## Flow walked end-to-end — ALL PASS
- `/` logged-out homepage renders, wallet-splash, 0 JS errors.
- Connect wallet → routed to `/games` (cabinet-select). ✅
- Select "PLAYABLE NOW ⚡ Hard Money Heroes" → `/games/hard-money-heroes`
  (mode-select). ✅
- Free Mode → character-select. Both heroes show with skill-type icons
  (💥 Power / ⚡ Speed / 🛡️ Armor / 🍀 Luck). ✅
- Select Lit Commando → Begin Level → `gameplay`, canvas 1180×528 visible,
  actively rendering (718 non-black px / 36 distinct colors in a small sample),
  `ingame=true`. ✅
- **Zero JS errors across the entire flow.** ✅

## Findings
- UX (minor): the "Featured Cabinet" header text is not the actionable element;
  the clickable selector is the "PLAYABLE NOW … Hard Money Heroes" card button.
  Selection works once the right element is used. Consider making the whole
  featured panel clickable for discoverability. (Not a blocker.)
- Routing + session architecture confirmed working in production (deep routes,
  base href, wallet-gating).

## Verified deployed this batch (v12)
- Desktop WASD + mouse-aim auto-fire; mobile drag-to-move unchanged.
- Hero sprite-lock: one design per hero, full anim kit, no mid-run design swap.
- Contact shadows on all world objects (no more floating look).

## Not changed (deliberate)
- Weapon balance (pistol 2.6/s·1.5s reload, shotgun 0.95/s·2.0s, MG 12/s·3.0s),
  40-skill +5%/rank upgrade library, and the 20-min difficulty director are
  already coherent and on-spec. Avoided speculative number churn without
  telemetry; revisit with real session-stat data once ranked runs accrue.
