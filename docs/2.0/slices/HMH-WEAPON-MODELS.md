# HMH — weapon models, hero attachment and power-up world cards

2026-09-30. Weapons lane, branch `claude/200-weapons` (based on `7cac31fa9` plus the cherry-picked HD prop kit `dbfdb7939..e973bbb88`). Presentation only: no simulation, damage, fire-rate, ammo, drop-odds, collision, RNG, save, bridge, version or service-worker change. No paid generation: every model is an owner-supplied GLB already on disk, re-processed in Blender. **Art acceptance is not claimed**; the package is a `native-render-candidate` (`artAccepted: false`).

## 1. Casting table

Owner sources: `C:\Users\just_\Desktop\Projects\LestersArcade-Assets\*.glb` (read-only; every file is hashed before and after each export and the hash is recorded in the manifest). All twenty weapon GLBs were rendered read-only from three orthographic views first (scratch inspection sheet) to read their axes; the casting below is from those renders.

| Weapon | In-game | Owner GLB | Source SHA-256 | Source tris | Textured | Packaged tris | Bytes | Muzzle (grip frame, m) |
| --- | --- | --- | --- | ---: | --- | ---: | ---: | --- |
| coin-blaster | The Settler (Pistol) | `pistol 3d model.glb` | `30688e6c53fe…` | 482,534 | no | 1,899 | 131,408 | [0.180, 0, 0.10] |
| scatter-shotgun | The Block Breaker (Shotgun) | `rugged shotgun 3d model.glb` | `41ece05b0e3e…` | 482,322 | no | 1,900 | 130,996 | [0.735, 0, 0.09] |
| auto-miner | The Hashstorm (Machine Gun) | `military minigun 3d model.glb` | `a9b386542d97…` | 470,880 | no | 1,898 | 142,992 | [0.858, 0, 0.08] |
| hash-rail | Railgun | `hunting rifle 3d model.glb` | `bcb0b1c2b03e…` | 476,666 | yes | 1,500 | 130,308 | [0.828, 0, 0.09] |
| lightning-ledger | The Lightning Ledger (Arc Rifle) | `rifle with scope 3d model.glb` | `571e1f4692da…` | 480,329 | no | 1,899 | 128,232 | [0.792, 0, 0.09] |
| bear-market-burner | Bear Market Burner (Flamethrower) | `assault rifle 3d model.glb` **STAND-IN** | `3dbcbc7d3d10…` | 475,955 | no | 1,899 | 149,444 | [0.646, 0, 0.09] |
| forked-standard | The Forked Standard (War Fork) | `chainsaw 3d model.glb` **STAND-IN** | `0809fb26111f…` | 471,665 | yes | 1,300 | 142,540 | [0.817, 0, 0.06] |
| launcher-rig | Launcher Rig (Grenade Launcher) | `grenade launcher 3d model.glb` | `072f96ce844c…` | 480,174 | no | 1,899 | 139,464 | [0.513, 0, 0.09] |
| litecoin-knife | Litecoin Knife | `rugged hunting knife 3d model.glb` | `3d5e50a2a5e5…` | 488,125 | yes | 1,500 | 140,140 | [0.279, 0, 0.02] |
| satoshi-frag | Satoshi Frag (Hand Grenade) | `hand grenade 3d model.glb` | `38129c4a7e60…` | 490,766 | yes | 1,400 | 135,956 | [0.005, 0, 0] (no bore) |

Full hashes, source byte counts, triangle counts, texture sizes and reload/equip metadata are in `apps/portal/assets/generated/hmh-weapon-models/manifest.json`. Rendered preview: `docs/2.0/receipts/hmh-weapon-models-20260930/hmh-weapon-models-contact-sheet.png` (per weapon: source side view, packaged side / three-quarter / top views, baked texture).

Honest notes:

- **Bear Market Burner has no flamethrower model.** The assault rifle is the closest two-handed body the owner supplied and is flagged `standIn: true` in the manifest and on the sheet. It needs an owner flamethrower model (tank + hose + nozzle) before art acceptance.
- **The Forked Standard is a melee war fork (`kind: 'melee-alternating'`) and no fork model exists.** The textured chainsaw (Weathered Red Chainsaw sheet) is the melee stand-in, flagged `standIn: true`.
- **The `futuristic gun 3d model.glb` is unusable as delivered**: it is an exploded export with two disjoint bodies (parts at x ∈ [−0.49, −0.17] and x ∈ [0, 0.49]). The Arc Rifle therefore takes the scoped rifle; the raygun sheet remains unrealised.
- Sixteen of the twenty owner GLBs carry no texture (position + normal only, one flat material). Those weapons get a per-weapon gunmetal/wood/blued tint with the high-poly ambient occlusion baked in; the four textured sources (hunting rifle, chainsaw, rugged knife, hand grenade) have their diffuse colour baked from the source texture, multiplied by the same occlusion.
- Alternates on disk, not cast: desert eagle (×2, the textured `desert eagle handgun` is the pistol's textured alternate), `hunting rifle (1)`, `chainsaw weapon`, `hunting knife`, `ornate knife`, `grenade`, `glowing grenade`, `spiked grenade`.

## 2. Package

`apps/portal/assets/generated/hmh-weapon-models/` — ten GLBs + `manifest.json` (`hmh-weapon-models/v1`, `runtimeAuthority: projection-only`, `artAccepted: false`). Total 1,371,480 bytes. Every GLB: one mesh, one material, one embedded 512×512 JPEG base-colour texture, float32 positions/normals/UVs, uint16 indices, no extensions, no skins, no animations, ≤ 150 KB, ≤ 3,000 triangles (actual 1,300–1,900; the byte budget, not the triangle budget, binds).

**Grip frame** (shared with the held-weapon atlas pipeline): origin = trigger-hand palm point on the grip, +X forward along the bore to the muzzle, +Y left, +Z up, metres at hero scale (the hero GLBs are 2.1 m tall; the native pistol is 0.29 m long). Blender's Y-up export turns that into GLB axes +X forward, +Y up, +Z right, so `grip = (x, −z, y)` of a GLB vertex. The node extras carry `hmh_grip` (always the origin), `hmh_muzzle` and `hmh_weapon_id`.

**Per-hero socket** (`manifest.heroes`): joint `pistol_prop` (an identity child of `weapon_socket` under `hand.R`, the joint the native pistol is skinned to), its node/joint index in the runtime hero GLB, the hero GLB SHA-256, and `axesInSocket` / `anchorInSocket` copied from the shipped held-weapon calibration (`hmh-held-weapons/<hero>/<hero>-held-weapons.json`, hash recorded). The pack step re-fits the bore axis on the runtime GLB's native pistol (upper 40 % slice, as the held-weapon exporter did) and refuses to pack if it deviates more than 15° from the calibration (measured 7.9°–8.1° for the four heroes). `nativePistolMuzzle` / `nativePistolMuzzleSocket` give the native pistol's muzzle in both frames so the 3D hero has a measured muzzle with the pistol too.

Per weapon: `slot` (`gun` / `knife` / `grenade`), `lengthMetres`, `boreHeight`, `muzzle`, `reload: { dipRadians, ticks }`, `equip: { ticks, twoHanded }` (presentation hints in the shape of the held-page `reloadDip`), material factors, source provenance and the casting note.

### Regeneration

```bash
PY="/c/Users/just_/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
W=/path/to/work   # outside the repo
"$PY" -B -X utf8 scripts/run-hmh-weapon-models.py export --work "$W" --blender D:/Apps/Blender/blender.exe            # GPU bakes: takes the heavy lock
"$PY" -B -X utf8 scripts/run-hmh-weapon-models.py export --work "$W" --blender D:/Apps/Blender/blender.exe --cpu-only # Cycles CPU, no lock (what shipped here)
"$PY" -B -X utf8 scripts/run-hmh-weapon-models.py pack --work "$W" \
  --package apps/portal/assets/generated/hmh-weapon-models --receipts docs/2.0/receipts/hmh-weapon-models-20260930
node --test tests/hmh-weapon-models-package.test.mjs
```

One fresh `--factory-startup --disable-autoexec` Blender 5.1.2 process per weapon (`scripts/hmh-blender/export-hmh-weapon-models.py`): import, join, orient by principal axis with reviewed sign/up hints (slide refit for guns, front-half refit for the long guns, the grenade aligned on its up axis), scale to the cast length, seat the palm at the recorded fraction of the length and the bore at `boreHeight`, decimate to the per-weapon target, smart-unwrap, bake AO (and diffuse for textured sources) selected-to-active from the 480 k-triangle source, save one JPEG, export the GLB with extras, render review frames. Per-weapon casting/orientation/budget specs live in `WEAPONS` at the top of `scripts/run-hmh-weapon-models.py`. The shipped package was baked with `--cpu-only` because another lane held the heavy lock; a GPU run produces the same geometry with slightly different bake noise.

## 3. 3D hero attachment (lazy chunks only)

The four runtime hero GLBs already carry `weapon_socket → pistol_prop / knife_prop / grenade_prop` joints, so **no hero re-export was needed and the committed hero GLBs are byte-identical** (the package test re-hashes them against the manifest; after the rebase onto the hero clip library integration the calibration was re-run against those re-exported heroes: `lit-commando ca6e0350…`, `lilly 65f10bae…`, `lit-valkyrie f083aad5…`, `lester-original df2a0964…`; `pistol_prop` node/joint indices and the 7.9–8.1° bore cross-check were unchanged).

- `apps/hmh-reboot/src/weapon-model.mjs` (new, reached only from the lazy `actor-3d-pixi` chunk): bounded static-GLB reader (`decodeWeaponGlb`), manifest validator, `gripFrameMatrix`, `createWeaponAttachment` (pre-transforms the weapon into the hero mesh's bind space through `bind[pistol_prop] × gripFrame` and binds every vertex 1.0 to that joint so the existing skinned shader and palette move it exactly like the native pistol), `weaponSocketToModel`, `weaponModelToWorldOffset` (the shader's yaw/basis, verified against `projectActor3dPoint`).
- `actor-3d-pixi.mjs`: `prepareWeapon(id)` fetches the manifest once and the weapon GLB on first equip through the existing serial load queue; a failure leaves the sprite hero in charge and is never retried. `seatWeapon` builds the mesh through the proven hero program (probe-drawn before the sprite hero is hidden), hides the native pistol while a model is seated, and records `heroMuzzle()` each frame from the socket joint's evaluated world matrix.
- `actor-3d-controller.mjs`: every gun is a hero candidate (`ACTOR3D_HERO_WEAPON_IDS`); the hero entry is dropped (sprite fallback) until `prepareWeapon` reports the model resident. `heroMuzzleOffset()` exposes the world-unit muzzle offset.
- `actor-3d-projection.mjs`: the frozen projection carries `weaponId`.
- `main.mjs` (+144 minified bytes total with §4): the muzzle-flash event uses `actor3dPilot?.heroMuzzleOffset()` when the 3D hero owns the draw; the sprite paths (held page muzzle, fixed chest offset) are unchanged.

Not wired: knife and grenade models are packaged but the 3D hero keeps its native knife/grenade props (the mechanism supports `knife_prop`/`grenade_prop` slots; wiring them is a follow-up). The seated model does not yet animate reload/equip clips; `reload`/`equip` metadata is recorded for that pass.

## 4. Power-up world cards (lazy chunk)

`apps/hmh-reboot/src/pickup-world-cards.mjs` (new; reached only through the lazy `pickup-indicators` chunk, which imports it dynamically the first time the world hands it the authored prop display). The eight authored pickups (`bonus-life`, `berserk-candle`, `time-dilation`, `nuke-liquidation`, `hash-rail-core`, `lightning-ledger-cache`, `bear-market-burner-cache`, `forked-standard-cache` → kit cards `b1-33…b1-40` on `tripo-props-hd-pickups-00.webp`, `@0.5x` on phones through the profile loader) swap their world sprite texture for the kit card at the same painted width, keep the display's own idle bob, spin as a thinning card (150-tick period, phase offset per placement id, never below 14 % width, still under reduced motion), wear a pulsing glow ring behind the card in the reserved palette (gold `0xf2c56e` for power-ups, cyan `0x72ddeb` for weapon caches) and burst (ring + eight sparks, 36 ticks) on `collectible:collected`. HUD icons, upgrade-panel icons and the four base weapon caches (no kit card) are untouched. Everything is a pure function of the simulation tick and `seededUnit`; a failed page load leaves the existing icons and markers in charge.

## 5. Gates

- `tests/hmh-weapon-models-package.test.mjs` (4): manifest identity/budgets, every GLB exists + hashes + decodes with the recorded triangles/texture/muzzle at the front, provenance and tamper refusal, hero grip frames vs the runtime hero GLBs and the held-weapon calibration.
- `tests/hmh-weapon-attachment.test.mjs` (4): muzzle through a known pose (identity, 90° yaw + translation), world offset vs the actor projection for five headings, every gun seated on lit-commando in the aim pose (grip on the anchor, muzzle along the native bore, palette vs direct transform), weaponId carried through entries and frozen projections.
- `tests/hmh-pickup-world-cards.test.mjs` (5): bindings cover exactly the authored pickups at preserved width, tick determinism with RNG poisoned, display binding (single texture swap, spin keeps height, glow above the pivot, one burst per event, expiry), failed load fallback, indicator drawing.
- `tests/hmh-weapon-presentation-boundary.test.mjs` (2): no simulation module imports the new modules; the new modules and the actor-3d/pickup chunks stay off the HMH initial static graph (esbuild).
- Registered in `scripts/syntax-check.mjs`; `node scripts/syntax-check.mjs` passes (1345 JS modules + 161 Python scripts).

Pre-existing failures in this worktree, unrelated and reproduced on the untouched `main.mjs`: `hmh-pickup-icon-pack` (the P0 icon PNGs are not tracked here), `hmh-reboot-weapon-vfx` "layer order stays a single call", `hmh-reboot-weapon-swap` "a pause closes the wheel first".

## 6. What root must verify in the browser

No build, browser smoke or `visual:reboot` was run in this lane.

1. `?actor3dPilot=1` with each hero: equip the shotgun / machine gun / rail / arc rifle / burner / fork / launcher and confirm the seated model appears in the right hand (after the one-time fetch), points along the aim in all eight directions and the run/aim/pistol-fire clips, is hidden in melee/grenade/death, and that the native pistol returns when the pistol is re-equipped. Check `data-actor3d-*` telemetry stays `ready`.
2. Muzzle flashes with the 3D hero sit on the seated weapon's muzzle (and on the native pistol's) rather than the fixed chest offset; sprite heroes are unchanged.
3. Scale and grip: a shotgun should read ~1.05 m in a 2.1 m hero's hands with the trigger hand on the grip; if any weapon reads too big/small or rotated, adjust `lengthMetres` / `gripAlong` / `boreHeight` / hints in `run-hmh-weapon-models.py` and re-export (10 s per weapon on CPU).
4. World pickups: the eight power-ups show the HD card (sharper than the 256 px card, same width), bob, thin-spin, glow gold/cyan under the card, and burst on collect; reduced motion holds the card still; phones load the `@0.5x` page. Confirm `data-pickup-markers` still counts and no console errors on a 404 of the kit page.
5. Bundle: `npm run build` must report the initial-JS total within the 1,048,576 B cap (this lane measured main.mjs at +144 minified bytes; all new modules are lazy).
