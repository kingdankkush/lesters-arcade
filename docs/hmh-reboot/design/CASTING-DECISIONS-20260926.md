# HMH casting decisions, 2026-09-26 (art wave 1)

**Status:** final casting for the wave-1 Tripo spend. The owner delegated every pick to the workflow on 2026-09-26; this document is the single authority the modelling steps read. No credits were spent producing it.

**Branch:** `fable/hmh-art-wave1` (asset, manifest and projection only). Nothing here changes collision, hurtboxes, damage, AI, spawning, RNG, progression, evidence or results.

**Inputs judged**

- Three independent art-director castings (lenses: silhouette and readability at gameplay zoom; style coherence with the shipped heroes; modelability and pipeline risk).
- `docs/hmh-reboot/design/LEVEL-1-DESIGN-PACKAGE-20260925.md` sections 3.5, 4.1–4.6, 5.1–5.10, 6, 7.12, 9.3 and Appendix A.
- The twenty concept images under `C:/Users/just_/lesters-arcade-vault/wip-20260925/design/concepts/` (Tripo `text_to_image`, 5 credits each, per the run logs) and the casting board `review/hmh-casting.html`, whose only recorded flag is the Liquidator face.
- Where the three castings disagreed (Rug Puller, Lockkeeper) the concept pairs were re-opened at full 2048 px; the Liquidator pair was re-opened to confirm the body-merge claims. Unanimous subjects were not re-opened.

## 1. Final casting

| Subject | Pick | Wave | Decided by | One-line reason |
|---|---|---|---|---|
| The Liquidator | **redo** (body merge A+B, new head) | 1 | unanimous | Both heads carry the flagged feature stack; body merges A's flat epaulettes and stature with B's crown band, chest plate and button rows |
| Rug Pull Baron | **B** | 1 | unanimous | Diagonal rug = "disc on a diagonal bar"; oxblood waistcoat; A steals the Puller's yoke and the Bloater's magenta |
| Rug Puller | **A** | 1 | 2 of 3, re-opened | Cream rug outer = light top plane the design requires; bootlace tie on spec; rug separable on a harness |
| Pump-and-Dump Bloater | **B** | 1 | unanimous | The gourd: as wide as tall, boils on the shoulder top plane, reads zombie |
| Tollkeeper | **B** | 1 | unanimous | No shoulder armour (A wears the Whale's reserved gold pauldron), gorget, strobe on the cap crown, best prop sheet |
| HODL Revenant | **A** | 1 | unanimous | Sleeved dark coat between two pale ore fists = the dumbbell; B is sleeveless with a skull face |
| 51% Foreman | **A** (B = phase-3 reference) | later | unanimous | A is the base; B is the phase-3 dressing and has the drill bit pointing backward |
| The Lockkeeper | **A** | later | 2 of 3, re-opened | Coat worn with sleeves (riggable); B's cape drape is cloth and webs to the arms in image-to-3D |
| Money Printer | **B** | later | unanimous | Eyeshade on spec, paper arc over the head, press bigger than the head; A has goggles (a prompt negative) |
| Oracle Marksman | **B** | later | unanimous | Full sleeves keep the needle; curled tape reads as paper; A's shingles read as scale armour |

All ten read as human survivors or zombies. No animal, vehicle, robot, mech or abstract proxy.

## 2. Per-subject decisions

### 2.1 The Liquidator: redo

**Face.** Both A and B show slicked-back silver-white hair, grey stubble on a square jaw, and gold-rimmed tinted glasses (A aviators, B rectangular) on a greatcoat body. That stack is the resemblance the casting board flagged. Neither image may be a Tripo input. The head is regenerated per section 3 before any model spend.

**Body merge (what the redo keeps from each).**

| Keep | From | Why |
|---|---|---|
| Thin flat gold epaulette plates flush on the coat, 2.4 m stature, clean A-pose, no floor shadow | A | 4.3: plate under a tailored coat, no powered frame. B's domed pauldrons read as power armour and collide with the Whale's reserved gold shoulder plates |
| Crown band as a thin strip of crimson LED dots, no glyphs | B | A's band is a magenta neon Greek-key strip: reads as Bloater `#ff3df2` at 90 px and printed glyphs on the rejected variant |
| Riveted gunmetal chest plate between the lapels | B | A's plate is a belt-buckle-sized disc on the waistcoat |
| Two visible button rows (double-breasted) | B | 4.3 |
| Matte wool lapels and lining | neither | B's are satin; A's are matte but the wrong cut |
| Narrow gold cuff bands | both | Deliberate small deviation from 4.3: black gloves on a charcoal coat vanish at 35 degrees and the cuffs give the gavel swing a bright ring to track |

**Pipeline.** One text-to-image full-body run per head variant (section 3), then one image-to-model pass on the passing image. The gavel is a separate prop generation from the Appendix A prop text. Margin Call and Total Liquidation are accessory swaps in Blender on the one rig; no extra generations.

**Survives 256 px:** crown ring, red lapels, gold cuffs, coat length, boots, the gavel once added. **Does not:** stubble, glasses shape, tie bar, pinstripes. Faces matter in close-ups and selector renders; the silhouette and the top plane are the gameplay identity.

### 2.2 Rug Pull Baron: B

- B carries the rolled carpet diagonally on a strap, the 4.2 top-plane token "a disc on a diagonal bar". A lays it horizontally behind both shoulders, which is the Rug Puller's yoke token: boss and add would read alike from the 35 degree camera.
- B's waistcoat is oxblood-and-black brocade with thin magenta piping; A's is a large magenta block that hands the Bloater's accent to a boss that must have no glow (A.3).
- B has the short sleeved cutaway jacket, pear body on thinner legs, worn materials in the heroes' register.
- **Model-time fixes:** retint the hat band and piping magenta to oxblood; matte the floor shadow before input; rebuild the thin brim as a clean disc parented to the head bone (image-to-3D thins large flat discs); cut the carpet off the back and cap the coat so phase 2 (rug gone) and phase 3 (torn jacket, dented brim) are accessory swaps; straighten the slight lean at rig import; keep head proportions inside the stylised-realistic band rather than sculpting toward the concept's cartoon nose. The spread-arm showman pose is fine for image-to-3D; auto-weight the arms with care.
- **Props:** money sack (Tripo). Coin is a VFX sprite. Arena carpet is Blender.
- **Survives 256 px:** hat disc, rug bar, striped trousers, white spats, cream belly. **Does not:** moustache, gold tooth, chain.

### 2.3 Rug Puller: A (dispute resolved)

Measured on the 2048 px images: A's rug spans about 1,730 px against an 1,830 px figure (about 1.65 m on a 1.75 m man; spec is 1.2 m). B's rug spans about 1,020 px (about 1.0–1.1 m; on spec). A's outer wrap is cream with crimson-and-saffron ends; B's outer wrap is crimson with only thin cream bands. A's hook tips are long silver talons; B's are shorter brass hooks. A wears the bootlace tie; B a mustard neckerchief. A's rug hangs on a leather harness; B's is roped round rug and shoulders. B's right-hand panel is the flat top-down rug.

Decision: **A**, because the two faults in A (rug size, talon length) are transforms in Blender, while B's fault (crimson outer wrap) is a texture repaint of the one surface that carries the enemy's gameplay read. 5.3 states the read outright: the cap and "the cream in the rolled rug" are the light top plane that separates him from red rock (V .56) and road (V .27). At 52 px desktop and 31 px phone a crimson roll disappears into the Ravine floor. A also keeps the spec outfit (bootlace tie, paisley, garters, rope belt, carabiner), its figure fills about 70% of the frame with a frontal readable face, and its harness makes the rug the easy cut it must be (the rug is a rigid prop bone hidden on release).

- **Pre-input hygiene:** crop the two swatch insets off the right side (they would mesh as floating slabs); no shadow to matte.
- **Model-time fixes:** scale the rug prop bone to 1.2 m (about 0.72x) so it overhangs about 0.6 body-widths per side and stays inside the 5.10 frame budget; shorten the hook tips to small brass stubs (nothing may read as claws); trim the curled moustache ends to a straight pencil line in texture (the waxed handlebar is the Baron's token).
- **Decal:** use B's flat rug panel (crimson field, cream medallion, saffron border) as the free reference for the rug-lane ground decal. No spend.
- **Survives 256 px:** cap, cream roll, tassel ends, cropped jacket line. **Does not:** pencil moustache, gold tooth, hooks.

### 2.4 Pump-and-Dump Bloater: B

- B is the gourd: belly low and forward, sloping shoulders, sunken head, knees apart, nearly as wide as tall. A is a tall man with a belly whose bowed head hides the face (a poor skull for image-to-3D).
- B's boils sit on the shoulder top plane the 35 degree camera sees; the belly glow on both is underside and hidden from above.
- **Model-time fixes:** mirror the boil crust across both shoulders and the upper back so the top-plane crust is symmetric for 8 directions; dim the white eye glow to clouded, non-emissive; raise some `#ff3df2` toward the belly top so it shows from above during the fuse-swell tell; plain faded candlestick print (no glowing candle); boils as matte skin with subsurface glow, not glass marbles; chain back at the neck; matte the faint floor shadow. The baked forward lean is acceptable: every Bloater clip is hunched.
- **Survives 256 px:** gourd mass, beanie, pink boils, pale belly. **Does not:** chart print, chain, slippers.

### 2.5 Tollkeeper: B

- A wears a gold pauldron and a riveted breastplate: the Whale Enforcer's reserved "gold shoulder plates" and the subject's own Appendix A negative; its scar is a drawn X on the cheek. B has the riveted gorget with no shoulder armour, double brass rows, gauntlets, coin pouch, key ring, steel-toe boots, a caged white strobe standing on the cap crown (the tallest point, a clean white spike at 33 px phone) and a thin scar through the left eyebrow.
- B's vault door is the best prop in the set (spoked brass wheel, rim bolts, dial with the strobe lamp, chevrons, dents). The striped boom arm is a Blender primitive; do not spend on it.
- **Model-time fixes:** add the red reflector disc at the boom tip (missing on both); paint the chevrons round the full rim; build the forearm strap on the door back; keep the door face light steel (V about .55) so the disc reads on the V .27 road; trim B's full beard toward a thick grey moustache with stubble so the bushy beard stays the Lockkeeper's token; strobe `#f4f7ff` only.
- **Survives 256 px:** cap lamp, door disc, coat length, gauntlets. **Does not:** scar, buttons, keys.

### 2.6 HODL Revenant: A

- A: sleeved torn wool coat, padlocked chains crossed over the chest, strongbox at the belt, shin wraps, and two head-sized cloudy ore chunks visibly lashed to the wrists with wire and chain (gear, not growth): a solid dark body between two bright blobs, the dumbbell. B: sleeveless vest over bare skeletal arms, a fanged skull face (drifts toward the creature negative), glassy faceted gem, hot-magenta cores that collide with the Bloater on the shared Hashwood and Mining floors.
- **Model-time fixes:** cores to ruby `#e0115f` (A rendered pure red); helmet lamp dark and cracked (A rendered it lit, which steals the Foreman's lamp-dot read in the same district); eyes faint; matte the cast shadow. Chains will fuse into the coat, which is invisible at 54 px.
- **Survives 256 px:** two ore fists, helmet dome, coat. **Does not:** chains, padlock, strongbox, face.

### 2.7 51% Foreman: A (later wave, no spend now)

A and B are phase states, not alternatives. A is the Market-phase base (dented yellow hard hat, one amber lamp, goggles on the brim, upright brass tank with gauge, hose to a right-forearm drill gauntlet with the bit projecting forward past the fist, one-strap overalls, apron, key ring). B is the phase-3 dressing (cracked hat, red lamp, ruptured venting tank) and its drill bit points backward past the elbow, so it cannot be the base mesh. Phase 3 is an accessory swap on A's rig.

Fixes for its wave: remove the goatee (spec is moustache only; beards are the Lockkeeper's token); dead clouded eyes; rebuild the hose as a Blender curve and the gauge and bit as primitives (thin parts break in image-to-3D); matte the cast shadow; if the hunched pose fails the rig check, re-run prompt-a2 with an upright A-pose and a short bit. Accent `#f0ae4c` in lamp and veins only.

### 2.8 The Lockkeeper: A (later wave, no spend now; dispute resolved)

Re-opened. A wears the black oilskin as a coat, sleeves rolled over the cream cable-knit, chest waders, chain coil, six padlocks on the bandolier, rubber boots: every 4.6 item. Its faults are magenta-pink lamps, a cast shadow, cream visible only as a chest patch, and a taller build than 4.6's barrel. B has the better top plane (cream shoulders under a black cap), red-orange lamps, the squatter barrel and the bushier beard, but drapes the coat as a cape with empty sleeves hanging behind spread arms. 5.10 allows rigid props only, no cloth; image-to-3D webs a hanging cape to outstretched arms; and a cape would need cloth or bone flaps through stomp, sweep and the back-to-camera sluice haul.

Decision: **A**, with B's virtues taken at model time rather than by adopting its construction:

- lamps retinted to `#ff476f` (danger-ring pips stay white-hot in a dark bezel);
- coat hanging open with the lapels folded back so the cream sweater fills the chest and covers the shoulder tops, plus the wet-oilskin specular the shared light rig gives a glossy black shoulder: this is the light top plane B showed;
- thigh and shin shortened about 10% at import toward B's barrel proportion against the 2.3 m targetHeight;
- shadow matted before input; beard kept bushy with mutton chops.
- **Condition:** the 35 degree re-render must pass the edge-contrast gate on the Crossing's water and wet bank (V .31). If it does not, the fallback is a 5-credit text-to-image re-run of `prompt-a.txt` with "coat hanging open, lapels folded back, cream sweater visible across the chest and shoulder tops" added, not B's drape.
- The L-key is a Blender primitive build; the padlock charge is a Tripo prop in its wave.

### 2.9 Money Printer: B (later wave, no spend now)

B has the eyeshade (spec) where A has goggles on a flat cap (goggles are an explicit negative and the Foreman's brim cue). B's press is bigger than the head with the spool on top, and the paper ribbon arcs over the head into a brass chute at the shoulder: "a square with a wheel and a paper arc" from the hero camera. B's bald head plus white paper is the light top plane 5.7 asks for. Fixes for its wave: model the eyeshade as a flat black celluloid brim; trim the press 20–25% but keep the spool; paper ribbon as a curved strip on a rigid prop bone; crank wheel on its own bone; thicken both so they survive 128 px; chute glow `#ffe23a` blank (the rejected v1 printed a hex code on it).

### 2.10 Oracle Marksman: B (later wave, no spend now)

B has full sleeves, so the silhouette stays one dark needle (A's bare pale arms become two flesh lines at zoom); a taller segmented mast; curled shredded tape that reads as paper (A's rectangular shingles read as scale armour at 128 px); pointed hood, pouches, buckled boots. Fixes for its wave: round the hood tip so it does not echo the Validator Cultist; extend the tape over the hood crown toward A's density so the pale top plane holds at 33 px; paint out the laser beam and beacon bloom before input (VFX, not geometry). Rifle is a separate prop generation.

## 3. The Liquidator: prompts and originality gate

### 3.1 Redo body prompt (one slot for the head)

Assemble each face variant as `STYLE + BODY(with HEAD block inserted) + AVOID`. If the CLI rejects the length, shorten the AVOID list first; never the HEAD block. Every prompt keeps "no readable characters" because Tripo prints glyphs on emissive surfaces (the rejected Liquidator A, Printer v1 and Foreman B all did).

```
STYLE: Stylised-realistic AAA 3D game character asset render for image-to-3D modelling. Single character, full body from head to boots, both boots fully in frame, neutral three-quarter front view, relaxed A-pose with arms held slightly away from the body, hands open and empty. Plain light-to-mid grey background, flat neutral studio lighting, no cast shadows, no floor shadow. Worn PBR materials. Mostly dark, desaturated colours with a lighter top plane on the head and shoulders; one accent colour under 8% of the figure. Compact, readable silhouette with clearly separable limbs; grounded human anatomy with slightly heroic chunkiness in the hands and boots. No text, no logo.

BODY: The Liquidator: a towering HUMAN corporate executive-auctioneer about 2.4 m tall with very broad squared shoulders, a chin-up boardroom posture, big black leather-gloved hands and heavy polished black boots. HEAD: {HEAD}. A gold spiked market-crown circlet sits on the head; its band is a thin strip of tiny glowing crimson LED dots and dashes in abstract bars, no readable characters, the only glowing element on him. Knee-length charcoal pinstripe DOUBLE-BREASTED wool greatcoat with two rows of gunmetal buttons, matte blood-red wool lapels and lining, no cape, no satin; thin flat tarnished-gold epaulette plates lying flush on top of the shoulders, as wide as the shoulders (flat plates, not pauldrons, no shoulder armour); black waistcoat; crisp pale shirt collar; long blood-red silk tie with a gold tie bar; a riveted gunmetal chest plate visible between the open lapels under the coat; narrow tarnished-gold cuff bands at the wrists above the gloves. Scuffed wool, brushed gunmetal, tarnished gold, grime at cuffs and hem. Palette charcoal, black, gunmetal and brushed gold; the crown band is the only accent, #ff496c. The crown ring and the flat epaulettes read clearly from directly above.

AVOID: zombie, weapon, shoulder cannons, pauldrons, shoulder armour, power armour, exosuit, robot, mech, drone, animal, creature, vehicle, pixel art, anime, low-poly, flat cel shading, photograph, text, letters, numbers, logo, watermark, motion blur, cropped feet, cast shadow, busy background, neon sign, Greek-key pattern, satin, cape, slicked-back or swept-back silver, white or grey hair, beard, goatee, stubble, moustache, aviator sunglasses, eyepatch, monocle, gold tooth, long hair, ponytail, long teal hair, teal coat, blue sphere head, red neckerchief with black mullet, blonde hair with red headband.
```

### 3.2 Three head variants (text-to-image, about 5 credits each; run all three)

All three are clean-shaven, because every other adult male in the roster already carries a facial-hair token (Baron handlebar, Puller pencil, Tollkeeper and Foreman thick moustache, Lockkeeper beard, Printer sideburns, Marksman unshaven). Each variant carries at most one of the trigger features {swept-back silver/white hair, grey stubble, tinted aviator/rectangular glasses, cleft square action-hero jaw}.

**Head 1, "the Receiver"** (default: the bald dome is the light top plane inside the crown ring at 90 px; trigger count 1, the tinted square glasses, which are 4.3's own spec item).

```
a man in his early sixties with a heavy jowled face; a wide flat nose broken and set crooked; deep folds from nose to jaw; thick straight iron-grey eyebrows; hooded pale eyes behind small SQUARE gold-rimmed amber-tinted spectacles; clean-shaven with only a blue-grey shadow along the jaw; a bald crown with a short cropped horseshoe of iron-grey hair above the ears, so the bare dome carries the crown; a thick creased neck; small ears with a single gold auction-tag stud in the left earlobe; pale liverish skin with a flush across the nose; an expression of bored contempt
```
Extra AVOID for head 1: full head of hair, slicked-back hair, completely shaved skull, stubble beard, aviators, scar.

**Head 2, "the Chairman"** (trigger count 0).

```
a gaunt man in his late fifties with a long hawkish face and a high forehead; hair black turning steel-grey only at the temples, cut very short and combed flat from a severe left side part like a banker's, the crown circlet sitting above the part; a narrow hooked nose; thin bloodless lips turned down at the corners; hollow cheeks under high cheekbones; a long narrow chin with no cleft; deep-set dark eyes fully visible behind small ROUND thin gold-rimmed CLEAR spectacles worn low on the nose; clean-shaven; a small notch missing from the top of the right ear; sallow skin; the thin appraising smile of an auctioneer
```
Extra AVOID for head 2: silver or white hair, tinted or dark lenses, bald head, cleft chin, beard.

**Head 3, "the Butcher"** (trigger count 0).

```
a heavy fleshy wide face on a thick neck that swallows the shirt collar; close-cropped hair dyed an unnaturally flat dark brown with grey roots showing at the temples, an obvious vanity dye job with scalp visible through the crop; thick dark eyebrows; small close-set dark eyes; a broken nose with a thick pale horizontal scar across the bridge, nowhere near the eyes or eyebrows; a heavy rounded chin and jowls; clean-shaven; a permanent sneer with the left corner of the mouth pulled up; flushed skin with broken capillaries; no eyewear on the face; thin gold half-moon reading spectacles hanging on a fine chain against the black waistcoat; about 58 years old; the look of a butcher weighing meat
```
Extra AVOID for head 3: silver, grey or white hair, bald head, beard, eyewear on the face, scar through the eyebrow or across the eye.

### 3.3 Originality gate (before the 40-credit model spend)

Applies to whichever variants are generated, and again to the final Tripo render (Tripo drifts faces).

1. **Crops.** Crop the head at 512 px; also downscale to 64 px and 20 px (the head's size in a 256 px and 128 px frame). If the head in the 2048 full-body render is under about 200 px and the read is inconclusive, spend 5 more on a head-and-shoulders portrait of the same HEAD block before judging.
2. **Feature ledger** in `docs/hmh-reboot/TRIPO-SPEND-LEDGER.md` beside the task id: hairline and hair colour/style, brow, nose, facial hair, eyewear, jaw and chin, marks, apparent age, skin.
3. **Archetype check (features, never names).** Fail if three or more features of any one archetype match: white/silver slicked-back hair + grey stubble + square jaw + brow scar + cat-like yellow eyes; grey mullet + full beard + eyepatch + bandana; long straight white hair + black leather coat + green eyes; bald + goatee + small round dark glasses + long black coat; pompadour + facial scar + eyepatch + white suit; silver hair + aviator sunglasses + military greatcoat; **fully bald + massive frame + tailored suit + crime lord (white suit, cane)**. The last line is why head 1 keeps a horseshoe of hair and no variant is a fully shaved giant in a suit.
4. **Roster uniqueness.** He must be the only clean-shaven adult male in the ten picks; his head value must differ from the dark caps of the Tollkeeper and Lockkeeper; the crown ring stays the sole emissive; no hero token (black mullet + red neckerchief, blonde + red headband, long teal hair, blue sphere head).
5. **Blind read.** Show only the 512 px head crop to two sessions with no prompt context and ask whether it resembles anyone they can name. Any confident naming fails the variant; regenerate with the matched features added to AVOID.
6. **Reverse-image search** on the head crop alone (no crown, no coat) if a tool is available; log the result; no match to a character portrait is required.
7. **Gameplay read.** A 90 px, 35 degree mock of the head must still read as a pale dome (head 1) or a dark flat cap (heads 2, 3) inside the crown ring.
8. Only after a pass is the full-body image the image-to-model input. If more than one head passes, prefer head 1 for its top plane unless step 5 raised any doubt.

## 4. Production order for this wave

Sequenced so each step proves the path the next depends on. The enemy 5.10 gate is proven on an ordinary human body before any boss opens the boss-schema path; the face gate runs in parallel from day 1 because it costs almost nothing and gates the long pole.

| # | Item | Pick | Credits | Proves or delivers |
|---|---|---|---|---|
| 0a | Liquidator heads, day 1 | 3 text-to-image | 15 (+5 portrait re-check, +5 if the body drifts) | Originality gate (3.3) |
| 0b | Prisoner concepts, day 1 | 8 text-to-image (two per subject from the A.2 blocks) | 40 | Cast in-workflow; they have no concepts yet |
| 1 | Rug Puller | A | 40 | First body through the whole path: Tripo adoption (`scripts/hmh_tripo_adoption.py`), 14-bone auto-weight and procedural poser, first rigid prop bone (rug, hidden on release) and ground decal, 35 degree camera with `hmh-light-rig.json` and the edge-contrast gate, 128 px mobile tier, decoded-memory gate, Bagholder body-only height and foot-pivot parity, reproducibility (two cold byte-identical runs) |
| 2 | Pump-and-Dump Bloater | B | 40 | Widest frame in the roster against the frame budget; extra states (fuse-swell, burst death); emissive mask path (`#ff3df2`); zombie read |
| 3 | Rug Pull Baron + money sack | B | 40 + 40 | First boss: own full rig (4.1), roster-schema extension for boss clip subsets, single-resident boss atlas, hat disc and diagonal rug as prop bones, phase accessory swaps, south-only intro/transition/death. Coin is a VFX sprite |
| 4 | The Liquidator + gavel | passing head | 40 + 40 | Largest clip budget (about 1,100–1,200 frames: intro, Dark Pool seated, two transitions, three phase dressings). Its generation may be fired as soon as a head passes and inspected during 1–3; its Blender work follows the Baron |
| 5 | Tollkeeper + vault door | B | 40 + 40 | Two props on one rig (door on the left forearm, boom arm in the right hand as a Blender primitive), Broken-phase clip subset |
| 6 | HODL Revenant | A | 40 | Ore fists inside the body mesh; downed/rise/emerge clips; ruby emissive |
| 7 | Prisoners (Field Medic, Quartermaster, Pawnbroker, OG Miner) | cast from 0b | 4 x 40 | South-only 192 px projection actors, three short clips each; cheapest per credit, pull earlier as filler whenever a heavier item stalls in Blender |

**Credit envelope.** First pass about 575 (15 + 40 + 240 characters + 120 props + 160 prisoners), about 625 with the face and boom contingencies. One stated-reason second candidate per subject adds at most about 440. Worst case about 1,065 against the 2,000 cap. Balance before the first spend must be read from `tripo` and written to the ledger with every task id, input checksum, settings and charge; balance after, likewise.

**Rules carried from the task.** Never spend on a subject before its concept passed casting (this document is that pass). Inspect every concept and every model render with the Read tool before the next spend. One image-to-model candidate per subject first; a second only on a stated review failure. Blender renders and Tripo calls need no heavy lock; every browser or `test:release` run takes it.

**Later waves, picks recorded for continuity, no spend now:** Foreman A (B as the phase-3 reference; hose and bit rebuilt in Blender), Lockkeeper A (L-key as a Blender primitive, padlock charge as Tripo), Money Printer B, Oracle Marksman B (rifle as Tripo).

## 5. Accent table (A.3 applied to the picks)

| Actor | Accent | Where it may appear | Concept-to-model correction |
|---|---|---|---|
| Liquidator | `#ff496c` (phase 2 `#ffc857`, phase 3 `#e26dff`) | crown LED band only, abstract dots, no glyphs | A's magenta neon band rejected; nothing else glows; cuffs and epaulettes are tarnished gold material |
| Rug Pull Baron | none | oxblood and gold as material | hat band and waistcoat piping retinted magenta to oxblood; nothing emissive |
| Rug Puller | `#ffb000` | rug border and tassels, pattern not glow, under 8% | outer wrap stays cream; decal border saffron |
| Bloater | `#ff3df2` | belly underside and the mirrored shoulder boils; matches its pools | eyes clouded and non-emissive; candle print unlit |
| Tollkeeper | `#f4f7ff` | cap strobe and the door dial lamp only | boom-tip reflector is a small red material disc, not emissive |
| HODL Revenant | `#e0115f` | ore cores only | A's pure red retuned to ruby; helmet lamp dark and cracked; eyes faint |
| 51% Foreman | `#f0ae4c`; phase 3 `#ff476f` | headlamp and mineral veins | B's red lamp and ruptured tank are the phase-3 swap only |
| Lockkeeper | `#ff476f` | six padlock lamps | A's pink retinted; danger-ring pips white-hot in a dark bezel on the red fill |
| Money Printer | `#ffe23a` | chute mouth only, blank | no characters on the chute (v1 rejected for a printed hex code) |
| Oracle Marksman | `#ff1f1f` | monocle lens and mast beacon | the beam is VFX, painted out of every input |
| Field Medic | `#45ff8a` | satchel cross patch | – |
| Quartermaster | `#19f7ff` | crate stencil stripe | – |
| Pawnbroker | `#6f9bff` | glass beads on the trinket strings | – |
| OG Miner | `#ffe84d` | coin pendant | – |
| Boss triggers | bone `#f2ead8` on `#241a33` | world props, never red | not part of any actor |

## 6. Pre-Tripo input hygiene (no credits)

- **Crop prop sheets and swatches into separate inputs:** Rug Puller A (swatch panel, bottom right); Tollkeeper B (door and boom arm cropped separately; only the door is a spend); Rug Puller B flat rug panel is a decal reference only.
- **Matte out floor shadows:** Baron B, Bloater B, Revenant A, Lockkeeper A, Foreman A.
- **Paint out VFX:** Marksman laser and beacon bloom, Foreman B steam, Printer chute rays.
- **Never feed an image with legible text** (the three rejected variants).
- Keep the figure at least 60% of frame height after the crop, re-centred; record the SHA-256 of the exact input file in the ledger.
- Size props from the spec, not from the sheets (door about 1 m, boom about 1.3 m, gavel as long as a leg, rifle man-height); Tollkeeper and Marksman sheets embed props at the wrong relative scale.

## 7. Pipeline facts every manifest entry carries

- The enemy roster manifest renders at `cameraPitchDegrees` 55 with a 160 px `frameSize` (Bagholder 208). 5.10 and section 6 require new enemies at the hero pitch (35 degrees) with the shared light rig, so each new entry carries its own render pitch and `lookDev`; the core-six re-render at 35 degrees is a separate slice. Without this, new detail is lost exactly as the shipped Liquidator (Bagholder body, tiny crown) is lost today.
- `targetHeight` from the design, not from image proportions: Rug Puller 1.75 m, Bloater 1.7 m, Tollkeeper 1.85 m, Revenant 1.85 m, Baron 2.1 m, Liquidator 2.4 m, Foreman 2.6 m, Lockkeeper 2.3 m, Printer 1.75 m, Marksman 1.9 m, prisoners 1.7–1.75 m. Bloater B, Printer B and Lockkeeper A are drawn squat or tall and would otherwise scale wrong.
- Scale parity: measure body-only height and foot pivot against the shipped Bagholder for every ordinary enemy; only the Baron (about 85 world px), Lockkeeper (about 88) and Liquidator (about 90–95) exceed ordinary human scale, and only because their gameplay bodies do.
- Rigging: bosses get their own full rig (4.1). Ordinary enemies are auto-weighted onto the HMH 14-bone armature and driven by the procedural poser unless a Tripo rig yields one armature, one skinned mesh and one action per state. Mixamo is unavailable.
- Props are rigid prop bones, never cloth (the reason Lockkeeper A beats B and the Puller's rug hides into a decal).
- Frames: 56 or fewer per direction, the 7.12 template (idle, run, strafe, tell, attack, hit, death, stagger); bosses add their 4.3/4.4 clips; prisoners are south-only.
- Storage: each GLB well under 40 MB with packed textures at 2048 or less, the first-commit LFS ritual, `npm run assets:hmh:models:lfs-check`, lossless WebP exact atlases, two cold byte-identical Blender runs per atlas, `npm run repo:health:strict` inside its 350 MiB budget counting smudged LFS bytes.
- Runtime prerequisites owned elsewhere: the residency-by-band-and-district loader is a gameplay slice. This branch delivers the 128 px tier and the decoded-memory numbers; no new enemy ships live until residency exists (the enemy wire cap is at 15.16 of 16 MiB).

## 8. Risks and open items

- Any fully bald 2.4 m executive in a suit risks the "bald + massive + tailored suit + crime lord" archetype; head 1 keeps a horseshoe of hair and no variant is fully shaved. Heads 2 and 3 are the fallbacks if the blind read still names anyone.
- Baron B's spread pose and lean need careful auto-weighting and straightening at import.
- Foreman A's hunched pose may need an A-pose re-run before its wave.
- Lockkeeper A must pass the 35 degree edge-contrast gate on water; the fallback is a 5-credit prompt-a re-run with an open coat, not B's drape.
- Tripo prints glyphs on emissive surfaces; every prompt ends with the no-characters clause and glow surfaces are baked blank.
- The three castings' sheets and cutouts live in session scratchpads; this document, the concept folder and the ledger are the persistent record.
