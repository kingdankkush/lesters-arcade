# Hard Money Heroes Level 1 World Blueprint v3 - Image 2.0 Prompt Catalog

Status: approved production reference; the certified World v3 material and landmark manifests implement this direction
Purpose: preserve the coherent world-art language used to generate and review the Level 1 runtime library.

## 1. Production rule

Do not send 10,000 unrelated prompts to the image model.

The 10,000-row tile-context CSV records what every logical cell is and how it connects to its neighbors. Image generation produces:

- reusable terrain-family masters
- edge and corner transition families
- bridge and ford families
- biome-specific decorative variants
- authored multi-cell landmark chunks

The runtime later selects art from terrain code, neighbor mask, biome, elevation, route role, and landmark membership.

## 2. Master visual-style lock

Append this style block to every Level 1 world prompt:

> Original high-detail 16-bit arcade pixel art for Hard Money Heroes, an isometric Litecoin-themed run-and-gun roguelite. True 2:1 isometric projection, crisp deliberate pixel clusters, readable SNES and Neo Geo era material detail, restrained cinematic palette, dusty silver-blue Crypto Wasteland atmosphere, warm amber practical lights, cool teal environmental accents, consistent northwest key light and southeast cast shadows. Hand-authored environment composition, grounded material transitions, strong silhouettes, clean combat-readable negative space. No painterly brushwork, no smooth vector gradients, no photorealism, no 3D render sheen, no antialiasing, no text, no logos, no watermark, no UI, no characters, no enemies, no floating props, no random scatter.

## 3. Runtime geometry lock

Append this geometry block to tile and chunk prompts:

> The logical ground uses a 64 by 32 pixel 2:1 isometric diamond. The generation may use a large square transparent source canvas, but every ground edge must align to the same isometric diamond grid. Keep the tile origin, corners, and ground-contact plane exact. Vertical objects may extend upward only. No object may extend below the ground-contact baseline unless it is an intentional cliff face. Preserve transparent padding around the source and do not crop edge pixels.

## 4. Negative prompt block

> Avoid: perspective camera, top-down square tiles, hex tiles, orthographic front view, blurry pixels, mixed pixel scales, inconsistent light direction, soft airbrush shading, realistic photograph textures, noisy dithering everywhere, oversaturated neon, cyberpunk city content, modern skyscrapers, characters, vehicles, weapons, readable writing, labels, interface panels, fake transparency checkerboard, white background, black background, baked collision outlines, baked selection outlines.

## 5. Master per-cell context template

Use this only when a cell requires a specific preview or transition proof. Replace bracketed values from the tile-context CSV.

> Create one reusable isometric terrain tile for Hard Money Heroes. Tile coordinate context: `[x],[y]`. Terrain family: `[terrainId]`. Biome: `[biome]`. Elevation band: `[elevation]`. Navigation class: `[groundNav]`. Route role: `[route]`. Encounter zone: `[encounter]`. North neighbor terrain: `[northTerrain]`. East neighbor terrain: `[eastTerrain]`. South neighbor terrain: `[southTerrain]`. West neighbor terrain: `[westTerrain]`. The visible edges must connect naturally to those four neighbors. Use prompt family `[promptFamilyId]`. The output must remain a reusable terrain asset without actors, major landmarks, or unique storytelling props.

## 6. Terrain-family prompts

### `terrain-dry-grass`

> A reusable dry prairie grass isometric ground tile, dusty olive and straw-yellow grass clumps over compact soil, sparse low tufts, broad quiet center for combat readability, subtle wind-worn directionality, no tall plants, no rocks larger than ankle height.

### `terrain-lush-grass`

> A reusable green lowland grass isometric ground tile, muted sage and cool green grass, occasional tiny clover clusters, slightly darker moist seams, restrained detail, readable under moving sprites, no flowers larger than a few pixels.

### `terrain-forest-floor`

> A reusable dry pine forest-floor isometric ground tile, dark mossy soil, pine needles, tiny roots and leaf litter, cool shadow pockets around the rim, clean center, no tree trunks baked into the ground tile.

### `terrain-packed-dirt`

> A reusable packed dirt road and path tile, warm brown compacted earth, wheel ruts and boot wear aligned to the requested route direction, tiny gravel at edges, broad smooth center for movement and projectile readability.

### `terrain-wasteland-sand`

> A reusable Crypto Wasteland sand tile, sun-bleached amber dust with silver-blue mineral flecks, subtle wind ripples, sparse pebble clusters near edges, calm center, no dunes tall enough to imply collision.

### `terrain-rocky-ground`

> A reusable rocky highland ground tile, slate grey and weathered brown stone chips embedded in hard soil, fractured strata aligned to the isometric plane, low relief only, strong but restrained northwest highlights.

### `terrain-cliff-mountain`

> A hard-blocking isometric cliff tile with a walkable plateau diamond on top and a vertical weathered rock face descending below the south edges, layered slate and rust strata, readable impassable silhouette, matching inner and outer corner family, no staircase unless explicitly requested.

### `terrain-cobblestone`

> A ghost-town cobblestone tile, irregular frontier stones partly buried in dirt, worn wagon grooves, dusty mortar, sparse weeds at edges, center kept clean, old-west material language without readable signs.

### `terrain-cracked-asphalt`

> A cracked rural asphalt tile, faded charcoal road surface, repaired seams, subtle reflective aggregate, thin dirt shoulders where requested, no readable road text, lane paint only when the route mask explicitly requests it.

### `terrain-farm-field`

> A traversable farm-field ground tile, short harvested rows aligned to the requested direction, ochre stubble and dark fertile furrows, low enough for characters to remain visible, no full-height crops baked into the ground tile.

### `terrain-beach-sand`

> A pale coastal beach tile, damp-to-dry sand gradient, tiny shell and driftwood flecks near edges, subtle wave-combed lines, no water unless requested by the adjacency mask.

### `terrain-mud-reeds`

> A blocked shoreline mud-edge tile, dark wet silt, shallow reflective puddles, low reed clusters concentrated along the water edge, clear visual language that ground actors cannot cross, no giant plants.

### `terrain-fresh-water`

> A deep freshwater isometric tile for river or lake, cool teal-blue pixel clusters, directional flow or calm ripple behavior according to context, dark depth center, crisp bank-compatible edges, clearly non-traversable, no visible tile seams.

### `terrain-shallow-ford`

> A rare authored shallow ford tile, clear ankle-deep teal water over visible stones and sand, obvious stepping route, slower movement read, connected dry entry and exit edges, foam and ripples kept low for enemy readability.

### `terrain-sea-water`

> A deep coastal sea tile, darker navy and teal water than the freshwater family, slow diagonal swells, sparse foam only at beach-adjacent edges, seamless continuation into neighboring sea tiles.

### `terrain-wood-bridge`

> A frontier wood bridge deck tile crossing water, thick weathered planks aligned to the requested road direction, stout rail or post variants at outer edges, deep contact shadow over water, deck corners aligned to the 2:1 grid.

### `terrain-stone-road-bridge`

> A rural stone-and-asphalt bridge tile, cracked road deck over a compact stone support, low guard edges, dirt shoulder connection, dark water shadow beneath, clear uninterrupted movement lane.

## 7. Required adjacency variants

Every common ground family should support:

- full interior
- north edge
- east edge
- south edge
- west edge
- northeast outer corner
- southeast outer corner
- southwest outer corner
- northwest outer corner
- four inner corners
- narrow channel
- end cap
- isolated patch
- T transition
- four-way transition

Do not generate all combinations blindly. Generate only combinations present in the 10,000-cell context CSV.

## 8. Transition prompts

### Forest to mountain foothill

> An isometric transition chunk where dry pine forest floor rises naturally into rocky mountain foothills. Small roots grip fractured stone, tree density increases away from the playable center, loose rock gathers at the slope base, and the transition follows the exact 2:1 grid without a straight rectangular seam.

### Desert to ghost-town cobble

> An isometric frontier transition where windblown wasteland sand thins across packed dirt and reveals old cobblestones. Wagon ruts continue through all materials, weeds gather between stones, and the center route remains broad and readable.

### Grass to cracked asphalt

> An isometric country-road transition with muted grass, compact dirt shoulder, broken asphalt edge, shallow drainage groove, and scattered gravel. The road edge is irregular but tileable and never becomes visual noise.

### Freshwater to rocky bank

> An isometric river-bank transition with deep teal water, dark submerged stones, wet rock edge, mud seam, sparse low reeds, and a crisp non-traversable boundary. Water flow direction remains consistent across neighboring tiles.

### Lake outlet to farm bridge

> An isometric water-to-bridge transition where Silver Wallet Lake narrows into a river outlet beneath a weathered wood farm bridge. Reed banks frame the channel, planks cast a coherent southeast shadow, and dry farm paths align on both sides.

### Beach to sea

> An isometric beach shoreline transition with damp pale sand, thin pixel foam, darkening shallow water, and deep navy sea beyond. The coastline curves naturally through the requested adjacency mask and remains seamless.

## 9. Landmark chunk prompts

### Ghost Saloon Square, 12 by 12

> A 12 by 12 logical-cell isometric ghost-town combat arena for Hard Money Heroes. A broad cobblestone-and-dirt main street forms a clean central dodge oval. A weathered frontier saloon anchors the northwest rim, a boarded storefront and water tower silhouette anchor the northeast rim, broken porch posts and waist-high barrels create controlled edge cover, and wagon ruts connect the southwest entry to the east exit. The middle 45 percent stays visually quiet for swarm combat. Two side alleys provide short cat-and-mouse lanes. No characters, enemies, text, readable signs, UI, or random clutter.

### Dry Forest Cave, 8 by 8

> An 8 by 8 logical-cell isometric dry-forest landmark chunk. A dark cave mouth sits beneath a layered pine-and-rock wall on the north rim. A curved forest trail enters from the south and splits around a low central root island before reaching the cave. Tree walls shape a compact dodge pocket without covering the player. Moon-cool shadows and tiny mushroom glints provide contrast. No actors or readable signs.

### Mesa Overlook, 8 by 8

> An 8 by 8 isometric mountain switchback chunk with layered slate cliffs, two walkable terraces, a narrow but readable uphill path, a small overlook platform, and a distant visual opening toward Litecoin City. Preserve clear projectile lanes and avoid tall foreground occlusion.

### Old Hashrate Camp, 12 by 12

> A 12 by 12 isometric open desert combat arena with half-buried mining rigs, collapsed cooling pipes, dragon-bone fragments, silver-blue dust flares, and sparse tarp shelters concentrated around the perimeter. Keep a wide central kite oval and three readable spawn gates.

### Crossroads Trading Post, 8 by 8

> An 8 by 8 isometric route-choice landmark with a wagon circle, trading-post porch, tall signpost silhouette without readable lettering, lantern string, water trough, and four clearly different route exits. The center is a quiet rest and upgrade space.

### Frontier Town Square, 12 by 12

> A 12 by 12 isometric normal frontier-town square with cracked asphalt approaches, a cobblestone center, courthouse clock silhouette, diner frontage, gas canopy, low planters, and controlled waist-high cover around the rim. Preserve four movement exits and a large swarm-readable center.

### Wrecked Litecoin Lighthouse, 12 by 12

> A 12 by 12 coastal isometric arena with a leaning silver-blue lighthouse, shipwreck ribs, wet rocks, beach sand, boardwalk remains, and deep sea on the outer edge. Build a dry half-ring combat lane with two escape paths and keep water clearly blocked.

### Rugpull Gulch Boss Yard, 16 by 16

> A 16 by 16 isometric final-boss arena framed by a ruined vault facade, backlit scam billboard structure without readable text, false-front buildings, broken stone walls, and dragon-bone caps. The center is a clean dark dirt circle for the Rug Pull Baron. Three add gates are visible before activation. The east extraction road remains visually closed until boss defeat. Use strong noir rim lighting while preserving attack telegraph visibility.

### Litecoin City Threshold, 8 by 8

> An 8 by 8 post-boss extraction road chunk with clean cracked asphalt, low flare sockets, a bus-stop silhouette, boundary warehouses, and a distant silver-blue Litecoin City glow beyond the map. Keep the extraction pad empty and readable with no enemies or random props.

## 10. Sample generation prompt A

ID: `sample-terrain-river-road-transition`

> Create an approval concept for a reusable Hard Money Heroes world-terrain transition. Show a compact 6 by 6 logical-cell isometric chunk on a square transparent canvas. Two mountain-fed teal river channels descend from rocky pine foothills and converge toward the edge of a small lake. A cracked rural asphalt road crosses one channel on a compact stone bridge, while a narrower packed-dirt adventure path crosses the other on a weathered wood bridge. Include dry forest floor, muted prairie grass, rocky banks, mud seams, low reeds, road shoulders, and exact edge connections that visibly continue into neighboring tiles. Keep road lanes and dry banks broad enough for run-and-gun combat. No actors, buildings, labels, UI, readable signs, or decorative clutter in the center. [MASTER VISUAL-STYLE LOCK] [RUNTIME GEOMETRY LOCK] [NEGATIVE PROMPT BLOCK]

Approval questions:

- Does the 2:1 projection read correctly?
- Are river and road edges seamless and reusable?
- Is the pixel density detailed but still game-readable?
- Does the palette feel like Crypto Wasteland rather than generic fantasy?
- Are the bridges grounded rather than floating?
- Is the center quiet enough for combat?

## 11. Sample generation prompt B

ID: `sample-landmark-ghost-saloon-arena`

> Create an approval concept for the Ghost Saloon Square, a 12 by 12 logical-cell authored isometric combat chunk for Hard Money Heroes. Square transparent source canvas, exact 2:1 isometric world grid. A dusty silver-blue frontier ghost town under late-afternoon noir light. A broad cobblestone-and-packed-dirt main street creates a clean central dodge oval. A weathered saloon anchors the northwest rim, a boarded storefront and water tower silhouette anchor the northeast rim, broken porch posts and waist-high barrels provide deliberate edge cover, and wagon ruts connect the southwest entrance to the east exit. Include two short side alleys for cat-and-mouse movement, but keep the middle 45 percent uncluttered for a large enemy swarm. Litecoin-themed shapes may appear abstractly in metalwork and lighting, but include no readable words or logos. No characters, enemies, weapons, UI, labels, random prop scatter, modern city skyline, or floating buildings. [MASTER VISUAL-STYLE LOCK] [RUNTIME GEOMETRY LOCK] [NEGATIVE PROMPT BLOCK]

Approval questions:

- Does this look like the same world as sample A?
- Is the landmark memorable from the gameplay camera?
- Can player and enemy silhouettes remain readable?
- Do the side alleys create tactical options without becoming mazes?
- Does the saloon sit firmly on the ground plane?
- Does the arena feel handcrafted rather than procedurally scattered?

## 12. Seam follow-up sample C

ID: `sample-connected-road-river-neighborhood`

> Create a seamless-terrain approval concept for Hard Money Heroes. Show one connected 6 by 6 logical-cell isometric neighborhood on a square source canvas using an exact true 2:1 diamond grid. The neighborhood must visibly read as adjacent cells that form one continuous world. A cracked asphalt road enters at the west edge on lane 3, continues at constant width through the neighborhood, crosses a north-to-south mountain river on a grounded stone bridge, turns gently, and exits the east edge on lane 4. The deep teal river enters the north edge on lane 4 and exits the south edge on lane 4 with exactly consistent bank width and flow direction. Dry grass, packed dirt shoulders, wet rock banks, mud, and low reeds transition continuously across every internal cell boundary. Put no mountain peak, building, tree trunk, bridge end, sign, or unique prop on the outer crop boundary. Keep a one-cell outer safety ring containing only continuation-ready ground, water, road, and low edge texture. The bridge deck is a separate grounded structure above uninterrupted water. No actors, text, logos, UI, labels, random clutter, cut-off objects, painterly blur, antialiasing, or perspective drift. [MASTER VISUAL-STYLE LOCK] [RUNTIME GEOMETRY LOCK] [NEGATIVE PROMPT BLOCK]

Approval questions:

- Do road width and shoulder texture remain consistent across the whole patch?
- Does the river enter and exit with matching bank geometry?
- Is the bridge clearly a layer over continuous water?
- Are all outer edges continuation-ready?
- Are any unique props or structures accidentally cropped?

## 13. Seam follow-up sample D

ID: `sample-cliff-path-supertile`

> Create a seamless-elevation approval concept for Hard Money Heroes. Show one connected 6 by 6 logical-cell isometric mountain and dry-forest supertile on a square source canvas using an exact true 2:1 diamond grid. A layered slate cliff band enters from the northwest edge, continues through several connected cells, turns through an authored inner corner, and exits the northeast edge at the same plateau height. A three-cell-wide packed-dirt switchback path climbs through a declared slope opening and continues toward the east edge without changing width. Dry pine forest floor transitions into rocky foothills along irregular but connected Wang-style edges. Keep all complete mountain peaks, cave mouths, large trees, and industrial mining remnants inside the inner 4 by 4 area. The one-cell outer safety ring may contain only continuation-ready ground, low scrub, path connectors, cliff connectors, and low rock texture. Render plateau ground, cliff faces, caps, contact shadows, trees, and overhangs as visually separable layers. No cropped peak, roof, cave mouth, tree canopy, bridge, actor, text, logo, UI, random edge clutter, painterly blur, antialiasing, or perspective drift. [MASTER VISUAL-STYLE LOCK] [RUNTIME GEOMETRY LOCK] [NEGATIVE PROMPT BLOCK]

Approval questions:

- Does the cliff maintain one height and material language across cells?
- Does the switchback path retain its width and grounding?
- Are large trees and peaks contained away from arbitrary slice boundaries?
- Can the cliff and forest continue naturally beyond the left and right edges?
- Does the scene match the terrain and Ghost Saloon samples?

## 14. Image 2.0 iteration protocol

For each approved asset family:

1. Generate one concept sample.
2. Approve palette, projection, material, and pixel scale.
3. Generate a clean source master.
4. Normalize the isometric footprint.
5. Remove fake backgrounds without damaging terrain.
6. Generate only required adjacency variants.
7. Build a contact sheet.
8. Check edge continuity and pixel-scale consistency.
9. Slice into atlas-ready PNGs.
10. Create manifest and provenance records.
11. Integrate one runtime vertical slice.
12. Run visual regression before expanding the batch.

Raw generations stay in the Level 1 vault or approval staging area. Only normalized, manifest-ready assets and contact sheets enter runtime asset folders.
