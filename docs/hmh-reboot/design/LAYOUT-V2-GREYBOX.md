# HMH layout v2 greybox (stage 2, built dark)

Stage 2 of the Level 1 design package (2026-09-25, sections 2.1-2.9 and slices S2.0-S2.6). Nothing here reaches players: the pilot runs only with `?evidenceSafe=1&layoutV2=1`, and `initializeSession` refuses a Ranked session while it is mounted. The default map, its collision, navgrid and sim digest are unchanged.

## Files

| File | Role |
|---|---|
| `apps/hmh-reboot/src/layout-v2-kit.mjs` | S2.0 greybox kit: masses, water, chasms, decks, terraces and ramps, gates and road tiers become elevation surfaces and static blockers |
| `apps/hmh-reboot/src/layout-v2-map.mjs` | Pure description of the v2 map (12,000 x 4,800) |
| `apps/hmh-reboot/src/layout-v2-checker.mjs` | Section 2.9 gates on the real navgrid (Node only) |
| `apps/hmh-reboot/src/layout-v2-pilot.mjs` | Lazy pilot: adopts the v2 world and draws the greybox |
| `scripts/hmh-layout-v2-check.mjs` | Prints the checker report |
| `scripts/hmh-layout-v2-pilot-browser-smoke.mjs` | Serial browser smoke and screenshots (hold the heavy lock) |
| `tests/hmh-layout-v2.test.mjs` | Kit, map contract, checker gates (with RED cases), pilot gating |

`?layoutV2At=x,y` starts the evidence hero on any walkable v2 point.

## District status

| District | Status | Slice |
|---|---|---|
| Frontier Relay | greybox, all gates enforced | S2.1 |
| Rugpull Ravine | greybox, all gates enforced | S2.3 |
| Liquidity Crossing | greybox, all gates enforced | S2.1 |
| Hashwood, Mining Camp, Liquidation Yard | roughed in (masses, water, terraces, gates, lairs, roads); whole-map gates only | S2.4, S2.5, S2.2 |

## Gates the checker enforces

Reachable share 50-80% per greybox district; no stranded walkable cells anywhere; every pocket sealed until its gate opens; sealed-lock floods for all four arenas; zero spawn sanctuaries and at least 90% of cells with two valid lairs (off the ±720 x ±450 view, at least 560 away, within 2,600 flow-field path units); lair, entry and site spacing; road clearance and corridor width per tier, a never-gated highway, hard cover within 250 of the highway, a longest highway straight of 1,000; seam openings; crossing cuts (river, Fork Island, gorge); at most 3 empty 400 x 400 cells. The test adds navgrid determinism and the 1.5x build-time budget. Density v2, decoded memory, visual review, XS Max scenes and the briefing belong to promotion (S2.6).

## Deviations from the package sketch

The package extents read under 50% reachable on the real navgrid (blockers inflate by 18 and cells sample a 3 x 3 lattice), so masses were thinned under decision 6:

- Perimeter strips are 100 wide on the west and east; south strips start at y 4,600-4,650.
- Relay north-west woods end at y 950; the seam woods leave the strip east of Relay Hill open.
- Ravine: west mesa 1,800-2,300 x 250-700; gorge 340 wide (2,480-2,820), its south arm 2,540-2,860; spires end at y 2,050; south-east mesa 2,800-3,200; Cliff Dwellings 2,860-3,600 x 3,200-3,700 with the stairs along their whole east side.
- Crossing: west branch 4,200-4,450 and east branch 5,250-5,500; the reservoir ends at y 4,250, leaving a south shore.
- Hashwood: Cut edges 200 deep.

Chain and spacing fixes:

- The Diggings is one pocket (3,800-4,040 x 250-1,105) between the claim gate and a haul-pass gate; both open on the Baron's defeat, so H1 is never reachable early.
- Lairs moved to keep 700 from the 2.2 chain sites and to meet the coverage gate: Relay cornfield (1,400, 3,600), Ravine Wash west (2,350, 4,250), Crossing west pines (4,370, 1,110), marsh (4,000, 3,750), east shore (5,690, 2,730), Hashwood Cut west (6,210, 2,250). The mill valve is at (5,250, 650) and the haven at (5,120, 620).
- The highway stops at the plaza mouth (10,450, 2,400) so it is never gated; Main Street carries on into the Margin Floor.

Known rough-district findings, left for their slices: Mining and Yard have spawn sanctuaries, Yard reads 45% reachable, and the Yard's West Street lair sits 451 from the Repo Office, as the package places them.
