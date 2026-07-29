# Hard Money Heroes reference-derived character model brief

Status: active continuation art direction
Reference basis: user-supplied Lester and Lilly illustrated sheets plus pixel/action sprites
Runtime authority: projection-only unless a later cycle explicitly changes deterministic gameplay data

## Reference reconciliation rule

The source sets intentionally show two levels of design:

1. Illustrated sheets own facial identity, head treatment, hair, age, body type, surface finish and premium material language.
2. Pixel/action sheets own combat clothing, gear placement, silhouette, weapon handling and what must survive at gameplay scale.

When they conflict, the playable combat model uses the illustrated identity inside the pixel sheet's practical combat outfit. Civilian suits, hoodies, linen shirts, formal coats and heels are identity/style references, not the default run-and-gun loadout.

The user-supplied binary references remain outside Git. Their distilled contract is repository-owned in:

- `apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json`
- this document

## Lester

### Immutable identity

- A large spherical cobalt-blue mascot head, not a human helmet and not a generic blue sphere.
- A white italic Litecoin/Lester `L` construction across the face: long stem plus readable horizontal crossbar.
- Two large, round expressive eyes with dark pupils and brows.
- A friendly asymmetric cartoon smile.
- Blue scarf/bandana around the neck with two visible rear tails.
- Stocky athletic adult body with broad shoulders and muscular exposed forearms.

### Combat outfit

- Royal-blue short sleeves under an olive tactical vest.
- Olive shoulder webbing and side panels.
- Dark cross-body bandolier strap with individually readable brass rounds.
- Utility belt, bright metal buckle and four pouches.
- Tan cargo trousers with olive thigh pockets.
- Dark knee protection, blue wrist wraps, fingerless gloves and heavy black combat boots.

### Blender construction

- Target height: approximately `2.08` Blender units; mascot head diameter approximately `0.57`.
- Keep the mascot shell, logo, eyes, brows and mouth as separate meshes for future expression animation.
- Bind the body and equipment to the existing `HMH_ProductionHeroRig` and `weapon_socket`.
- Current scarf tails may remain chest-bound to preserve clip determinism; a later projection-only animation cycle may add secondary scarf motion.
- Use rounded bevels and medium-high contrast PBR rather than unlit blocks or photoreal skin.

### Animation/weapon requirements

- Canonical dominant hand: right for grenade, knife and one-handed weapons.
- Preserve two-hand IK compatibility for machine gun, shotgun and long guns even where source sprites simplify to one-hand holds.
- Keep weapon geometry independent in the `weapon` atlas layer.
- Preserve the existing nine clips and fixed frame/tick contracts: idle, run, aim, pistol fire, hurt, dash, melee, grenade and death.

## Lilly

### Immutable identity

- Young adult human woman with a slim athletic build.
- Oval/heart-shaped face, teal-green eyes, arched dark brows, small straight nose and softly full lips.
- Round gold/teal glasses with lightly tinted teal lenses.
- Long layered, wavy teal hair from crown to mid-back/waist. Five rectangular blocks are not sufficient.
- Teal, charcoal and gold palette with an `L` identification mark.

### Combat interpretation

Use the illustrated face, hair and premium teal/gold material finish with the pixel sheet's practical outfit:

- cropped black/teal tactical jacket or armored top with gold piping;
- teal cargo trousers and thigh pouches;
- gold/black utility belt with `L` buckle;
- knee pads, fingerless gloves and black/gold lace-up combat boots;
- shoulder `L` patch;
- no high heels during combat;
- no full-length formal coat during combat, though short split coat tails are acceptable projection-only accents if they do not obscure legs or weapons.

### Blender construction

- Target height: approximately `2.02` Blender units.
- Build a recognizable face rather than the current blank oval.
- Hair requires at least nine layered crown, side and back lock groups. Use curved/tapered meshes or beveled curves with deliberate gaps so the silhouette reads at 160×160.
- Divide hair into crown, side-lock and back-lock groups with clearance for shoulders and weapon stocks.
- Retain the existing rig and atlas composition; add secondary hair motion only in a later projection-only animation cycle.

## Lit Commando

Lit Commando must be distinct from Lester rather than a different-colored armored mannequin.

### Derived identity

- Human male, muscular athletic body, square jaw and visible face.
- Dark hair with a red combat headband and two short rear tails.
- Rambo/army commando silhouette: olive sleeveless combat shirt, bare muscular arms, cross-body webbing/ammunition, utility belt and dark cargo trousers.
- Fingerless gloves, knife sheath, heavy combat boots and practical pouches.
- No mascot sphere, glasses, teal hair, sealed helmet, robot head or mech armor.
- He should read as the conventional heavy military survivor at the same playable scale as Lester.

### Blender target

- Target height: approximately `2.10` Blender units.
- Broader shoulders than Lester's body but a normal human head ratio.
- Use layered fabric/webbing/skin materials rather than chrome pauldrons.
- Preserve the current weapon socket and deterministic clip set.

## Lit Valkyrie

Lit Valkyrie must be a female commando, not a short-haired armored mannequin and not a recolored Lilly.

### Derived identity

- Human woman with an athletic feminine silhouette and visible face.
- Long platinum-blonde braid plus high ponytail reaching the lower shoulder blades; small mint/cyan identification accents.
- Olive fitted sleeveless tactical top, cross harness, fingerless gloves, thigh holster, charcoal cargo trousers, knee pads and combat boots.
- Stronger melee/field-survivor silhouette than Lilly.
- No glasses; no loose teal hair; no sealed helmet, robot head or mech body.

### Blender target

- Target height: approximately `2.04` Blender units.
- Use at least seven separated hair/braid groups with weapon-stock and back-webbing clearance.
- Keep the ponytail/braid attached deterministically for the initial model cycle; add secondary motion later.

## Shared scale and model-quality standard

- Hero runtime atlas scale remains `0.58` unless a separately reviewed projection-scale cycle changes it.
- Enemy runtime atlas scale is currently `0.50` after Cycle 027.
- Source models should use comparable human world heights around `2.0–2.1` Blender units. Enemies may vary by role, but ordinary human/zombie enemies must not look like miniature characters next to heroes.
- Bosses may be larger when the size truthfully matches their canonical gameplay body.
- Human survivors and zombies remain the only active actor anatomy. Do not introduce animal, vehicle, robot, mech or abstract proxies.
- At 160×160, prioritize silhouette-separated gear, face/head identity, hair mass, hands/boots, weapon shape and value contrast over invisible micro-surface noise.

## Enemy model standard

Future enemy model cycles should match playable-character construction quality:

- recognizable human/zombie head and face treatment;
- layered clothing rather than one torso block;
- hands, boots, belts, straps, pouches and role-specific weapon/equipment geometry;
- comparable ordinary-human height to heroes;
- readable front, side and three-quarter silhouettes;
- damage/phase details only when they truthfully reflect deterministic state.

Cycle 027's role kits are a start, not the final target.

## Hitbox plan

Current regular-enemy projectile hurt capsules use:

- radius: `max(8, enemy.radius × 0.72)`;
- axis endpoints: `y = -8` to `y = +8`.

The requested easier-to-hit target should be tested in a separate deterministic gameplay cycle:

- proposed radius: `max(10, enemy.radius × 0.90)`;
- proposed axis endpoints: `y = -10` to `y = +10`;
- physical collision body unchanged;
- movement, crowd spacing, AI and route clearance unchanged;
- projectile hit acceptance becomes more forgiving around the rendered torso/limbs;
- prove same-seed 60/30/20 schedule equivalence and replay stability;
- measure hit-rate change through seeded combat simulations and live desktop/mobile playtests before acceptance.

Do not hide hitbox changes inside a model or projection commit.

## Bounded implementation sequence

1. Cycle 028: reference manifest plus Lester combat-model rebuild.
2. Cycle 029: Lilly face, long wavy hair and teal/gold combat-outfit rebuild.
3. Next model cycle: Lit Commando Rambo/army rebuild.
4. Next model cycle: Lit Valkyrie female commando and long-hair rebuild.
5. Separate gameplay cycle: enemy hurt-capsule generosity with seeded measurements.
6. Subsequent enemy cycles: rebuild two enemy families at a time to hero-quality human/zombie standards.
7. Separate animation cycles: recoil/recovery, cloth/scarf/hair secondary motion, hit reactions and boss phase poses.

Each cycle must run the relevant pinned Blender reproducibility pipeline, desktop/mobile browser evidence, full release/security/performance/repository battery and exact-index review before continuation-branch push.
