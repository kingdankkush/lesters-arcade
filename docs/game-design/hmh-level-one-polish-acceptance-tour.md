# Hard Money Heroes Level 1 Polish Acceptance Tour

- Tour ID: `wo66-level-one-polish-acceptance-tour-v1`
- Level: `level-1-crypto-wasteland`
- Scope: camera-by-camera Level 1 polish acceptance for readability, composition, and navigation after render stability gates
- Steps: 8
- Open punch-list items: 3

## Acceptance Steps

| # | beat | camera | acceptance focus | expected cues |
|---:|---|---|---|---|
| 1 | spawn / Broken Highway / Litecoin Bus Stop | 4,5 ±18 | Broken Highway / Litecoin Bus Stop: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `street/bus-stop-sign`<br>`curated/jul9-fences-barricades-10-concrete-barrier`<br>`curated/jul9-fences-barricades-12-sandbag-barrier`<br>`level-1/prop/dragon-bones-body-ground-shadow` |
| 2 | arena / Gas Station Forecourt Arena | 10,5 ±18 | Gas Station Forecourt Arena: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `crypto/landmark-gas-station`<br>`curated/jul9-fences-barricades-10-concrete-barrier`<br>`curated/jul9-fences-barricades-12-sandbag-barrier`<br>`level-1/prop/dragon-bones-body-ground-shadow` |
| 3 | arena / Ghost Town Main Street | 40,6 ±18 | Ghost Town Main Street: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `crypto/ghost-saloon-front`<br>`wo102-megaprop/noodle-bar-storefront`<br>`level-1/building/ghost-saloon-front`<br>`level-1/prop/street-lamp` |
| 4 | loop / Farmstead Side Loop | 78,5 ±18 | Farmstead Side Loop: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `construct/fence-gate`<br>`wo102-megaprop/forest-rock-outcrop`<br>`level-1/flora/broken-tree3`<br>`level-1/flora/burned-tree2` |
| 5 | chokepoint / River Bridge / Wash Crossing | 62,6 ±18 | River Bridge / Wash Crossing: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `construct/wood-bridge`<br>`wo102-megaprop/forest-rock-outcrop`<br>`level-1/flora/broken-tree3`<br>`level-1/flora/burned-tree2` |
| 6 | pressure / Desert Boulder Road / Mesa Cut | 24,5 ±18 | Desert Boulder Road / Mesa Cut: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `crypto/canyon-cliff-edge`<br>`curated/jul9-fences-barricades-10-concrete-barrier`<br>`curated/jul9-fences-barricades-12-sandbag-barrier`<br>`level-1/prop/dragon-bones-body-ground-shadow` |
| 7 | boss / Second Town / Extraction Yard | 92,6 ±18 | Second Town / Extraction Yard: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `level-final-setpiece/cohesive-boss-yard-gate`<br>`curated/jul9-extraction-monuments-b-00-extraction-arch`<br>`curated/jul9-extraction-monuments-b-01-closed-boss-gate`<br>`curated/jul9-extraction-monuments-b-02-open-boss-gate` |
| 8 | extract / Litecoin Extraction Pad | 98,5 ±18 | Litecoin Extraction Pad: player should understand the immediate objective before enemy density rises If the player pauses here, the safe forward direction should be legible within 2 seconds | `level-final-setpiece/cohesive-extraction-flare-road`<br>`curated/jul9-extraction-monuments-b-00-extraction-arch`<br>`curated/jul9-extraction-monuments-b-01-closed-boss-gate`<br>`curated/jul9-extraction-monuments-b-02-open-boss-gate` |

## Punch List

| severity | area | beat | finding | fix |
|---|---|---|---|---|
| medium | navigation | chokepoint | River Bridge / Wash Crossing requires manual visual acceptance after render-stability gates | Run the browser tour, verify route direction, silhouette safety, enemy readability, and capture a note/screenshot if unclear. |
| high | navigation | boss | Second Town / Extraction Yard requires manual visual acceptance after render-stability gates | Run the browser tour, verify route direction, silhouette safety, enemy readability, and capture a note/screenshot if unclear. |
| medium | navigation | extract | Litecoin Extraction Pad requires manual visual acceptance after render-stability gates | Run the browser tour, verify route direction, silhouette safety, enemy readability, and capture a note/screenshot if unclear. |

## Verification Commands

- `npm run visual:regression`
- `MSYS_NO_PATHCONV=1 npm run smoke:portal:interactions`

## Manual Browser Tour Notes

- Run after major art/layout changes; attach screenshots or notes to any punch-list item that remains unclear.
