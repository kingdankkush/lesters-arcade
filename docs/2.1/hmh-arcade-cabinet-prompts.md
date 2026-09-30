# Arcade cabinet panel art: ChatGPT prompts for all three games

*Updated 2026-09-30. The cabinets are now **built as 3D models in Blender** (see §5 item 7 of `lesters-arcade-2.1-roadmap-after-visual-overhaul.md`). ChatGPT only makes the **flat artwork** that goes on them: marquee, screen, side panels and control-panel plate. Flat art keeps the characters faithful. The 3D model supplies the shape, the rotation and the real transparent background.*

**Tips:**
- **Upload the character references into the chat first,** then say *"Use these characters exactly."*
  - **HMH:** `Lester-HMH-CharacterReference.png`, `Lilly-HMH-CharacterReference.png`, `LitCommando-HMH-CharacterReference-01.png`, `LitValkyrie-HMH-CharacterReference-01.png` from `Desktop/Projects/LestersArcade-Assets/`, and a banner such as HMH-Extra4 from `HardMoneyHeroes-Banners/`.
  - **Chikun:** the Chikun character sheet.
  - **STACKED:** the STACKED logo and a visualizer screenshot.
- **Aspect ratios:**
  - marquee 4:1 (wide);
  - screen 4:3;
  - side panel 1:2.5 (tall);
  - control-panel plate 3:1.
- **Flat, front-on artwork only:** no perspective, no cabinet, no frame, **no text except the logo named**, full bleed to the edges.
- Save the approved panels to `Desktop/Projects/LestersArcade-Assets/Cabinet-Panels/<game>/`.

---

## Hard Money Heroes (gunmetal, gold, electric blue and purple; gritty frontier)

**Marquee**
> Flat, front-on arcade marquee artwork, wide 4:1, full bleed. The title "HARD MONEY HEROES" in bold gold chrome letters, with "HEROES" in an electric blue-to-purple gradient, over a dark stormy ruined city skyline with a glowing silver Litecoin moon. Back-lit glow feel, premium game-logo quality, no other text.

**Screen**
> Flat 4:3 game-screen artwork, full bleed, painterly-realistic premium action game style. At night in a ruined purple-lit city, the four heroes fight a zombie horde, using the attached references exactly:
> - **Lester:** a cobalt-blue round mascot head with a **solid white Litecoin "Ł" logo on his face**, a white bandana, an olive vest, firing a pistol;
> - **Lilly:** wavy teal hair, round tinted glasses, a long gold-trimmed teal coat;
> - **Lit Commando:** a dark mullet, a red neckerchief, an olive shirt with rolled sleeves;
> - **Lit Valkyrie:** long wavy blonde hair, a red headband, an olive cropped tank.
>
> Muzzle flashes, dramatic lighting, no text, no UI.

**Side panel** (make one; it's mirrored for the other side)
> Flat, tall 1:2.5 arcade side-panel artwork, full bleed. Lester (cobalt-blue round head with a **solid white Litecoin "Ł" logo**, white bandana, olive vest, per the reference) in a heroic low-angle pose aiming a pistol, with a ruined purple city behind him and a large gold Litecoin "Ł" emblem near the bottom. Painterly-realistic, bold and readable, no text.

**Control-panel plate**
> Flat 3:1 control-panel artwork, full bleed. A dark gunmetal plate with subtle scratched metal texture, a small gold "HARD MONEY HEROES" logo in the centre, and faint gold Litecoin "Ł" symbols in the corners. No other text.

---

## Chikun's Escape (farm red, cream, sky blue, sunny gold; playful)

**Marquee**
> Flat, front-on arcade marquee artwork, wide 4:1, full bleed. The title "CHIKUN'S ESCAPE" in a bold, playful cartoon logo (red and gold with a cream outline), with Chikun's crimson mohawk peeking over the letters, over a bright sky with fluffy clouds and a distant farm. No other text.

**Screen**
> Flat 4:3 game-screen artwork, full bleed, using the attached Chikun character sheet exactly: a white chicken with a crimson mohawk, mint-green eyes and a black trench coat with red lining, mid-leap over a pit on a sunny farmland path. There are gold Litecoin coins to collect, a drone and a Shiba Inu obstacle, and a rolling parallax landscape of fields, forest and a distant city. Vibrant, fun, no text, no UI.

**Side panel**
> Flat, tall 1:2.5 arcade side-panel artwork, full bleed. Chikun (per the reference: white chicken, crimson mohawk, mint-green eyes, black trench coat with red lining) in a dynamic "superman" dive pose with his coat flaring, over a vertical scene that runs from farmland at the bottom to clouds at the top. Gold coins trail behind him. No text.

**Control-panel plate**
> Flat 3:1 control-panel artwork, full bleed. A cream-and-red enamel plate with a subtle wood-grain farm feel, a small "CHIKUN'S ESCAPE" logo in the centre, and tiny feather and coin icons in the corners. No other text.

---

## STACKED (deep space navy, neon cyan and magenta, Litecoin silver; sleek holo-tech)

**Marquee**
> Flat, front-on arcade marquee artwork, wide 4:1, full bleed. The title "STACKED" in a sleek neon logo (cyan-to-magenta glow, silver edges) over a deep-space background with a glowing grid horizon and floating translucent blocks. No other text.

**Screen**
> Flat 4:3 game-screen artwork, full bleed. A falling-block puzzle board glowing in the centre, with neon cyan, magenta, gold and silver blocks and a line clearing in a burst of light. Behind it, a music-reactive visualizer: a flight through a star tunnel, with green Matrix-style code rain on one side and a glowing portal ring. No text, no UI numbers.

**Side panel**
> Flat, tall 1:2.5 arcade side-panel artwork, full bleed. A tower of glowing translucent blocks spiralling upward into a nebula, with a silver Litecoin "Ł" constellation, neon grid lines at the bottom and particle sparks. Sleek, premium, no text.

**Control-panel plate**
> Flat 3:1 control-panel artwork, full bleed. A glossy deep-navy plate with thin neon cyan circuit lines, a small "STACKED" logo in the centre, and tiny block icons in the corners. No other text.

---

## After the panels are approved (for the Claude session that builds the cabinets)

1. **Check faithfulness first:** HMH heroes against their references (Lester's "Ł" must be solid white), and Chikun against his sheet.
2. **Build the cabinet kit in Blender** and apply the panels as textures (2048 px). The screens are emissive and the marquees back-lit.
3. **Render** with Film → Transparent: a 16-frame 360° turntable per cabinet at about 384 × 420, plus a poster frame.
4. **Pack and budget:**
   - each turntable into a WebP sprite strip (≤ 350 KB), with a poster of 30 KB or less;
   - export a glTF (≤ 1 MB) for the optional drag-to-spin viewer.
5. **Install** following §5 item 7 of the 2.1 roadmap.
