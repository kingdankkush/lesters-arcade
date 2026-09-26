# Free share: token → page → card — implementation plan of record (2026-09-26)

Branch `fable/free-share` from integration `9f20cda0` (1.8.4 live). Worktree
`C:/Users/just_/lesters-arcade-wt/free-share`. This document is the judged merge of
three lens designs (visual/copy, security/caching, client/budgets) into one plan, and
it is also the amendment to contract §7.4/§7.5/§4.3.9 and guide §5.12 for the
integration owner (§15 below). Every number in it was re-checked against the source
at `9f20cda0`; where a design was wrong about the source, the plan says so.

Owner request (verbatim intent): Free shares must match Ranked sharing — post copy
with stats, emoji and one `@LestersArcade`, plus a custom share image with stats —
because the Free share is "not as polished". The owner thereby overrides the guide's
"Free shares go to the site root".

## 0. Source facts the plan rests on (verified 2026-09-26)

- `apps/portal/src/share-links.mjs` is already a **shared esbuild chunk**
  (`dist/chunks/chunk-NVACPPGS.js`, 6,572 B) imported by `main.js`, `chikun/game.js`
  and `stacked/game.js`; `hmh-reboot/game.js` imports it **0** times. Growth in it, or
  in a new module imported by the same three entries, never lands in the STACKED
  *entry* (27,775 B of the 29,000 B cap) nor in the HMH child; it lands in
  `STACKED_INITIAL_JS_CAP` (607,000 B; measured 574,802 B → 32,198 B headroom).
- Chikun's live runtime (`createChikunRuntime` → `chikun-ground-runtime.mjs`) result
  **does** carry `regionReached` (region id, `'farmland'` before the first pass) and
  `laps = floor((lastPassed+1)/REGION_LOOP_SLOTS)` with `REGION_LOOP_SLOTS = 48`
  (lines 64-65). Design 1's claim that the result lacks them is wrong (it read the v5
  runtime). Chikun `CHIKUN_MAX_RUN_TICKS = CHIKUN_FIXED_STEP_HZ * 60 * 60` (`chikun-cabinet.mjs:15`) → `survivalTime ≤ 3,600` s.
- `STACKED_LEVEL_CAP = 30`, `STACKED_MAX_TICKS = 432,000` (7,200 s; both in `apps/portal/src/stacked-contracts.mjs`);
  `ROGUELIKE_LEVEL_CAP = 80`; HMH heroes `['lit-commando','lit-valkyrie','lester-original','lilly']`
  (`main.js:4541`), `CHARACTER_DISPLAY_NAMES` maps `'lester'` and `'lester-original'` to `Lester`.
- `queryOf(req, allowed)` rejects undeclared or conflicting keys with 400 `invalid-query`;
  `api/share-card.mjs` is the adapter to copy (GET/HEAD, deps factory awaited before
  validation, `card:ip:` bucket 120/h, per-file `new URL(..., import.meta.url)`).
- `render-page.mjs` has private `metaTags`, `documentHtml`, `GENERIC`, `genericPage`;
  `render-card.mjs` exports `cardText` and uses CYAN `#19f7ff`, GOLD `#ffe84d`,
  GREEN `#45ff8a`, AMBER `#ffb347`, INK `#f9f7ff`, MUTED `#b4c4df`; design tokens
  `--fiat-magenta #ff3df2`, `--navy-950 #05070f`.
- `@vercel/og 0.11.1` ships Geist Regular only; Satori here supports `transform`,
  `overflow:hidden`, `textShadow`, gradients and inline `svg` children. `Ł` is not in
  Geist. Portrait atlases are 1920×384 RGBA WebP, frame `768,0,384,384` is the front
  rest frame; Pillow has WebP (Vercel image: CPython 3.12 + Pillow 11.3).
- `tests/vercel-routing.test.mjs` pins compiled rows recorded from vercel CLI
  59.14.0; that CLI is **not** in this checkout's `node_modules` and
  `@vercel/routing-utils` is not importable. The local router
  (`scripts/lib/local-stack.mjs` `compileVercelSource`, path-to-regexp-6 semantics)
  is the offline oracle.
- Old-copy pins that go RED on purpose: `tests/share-links.test.mjs` (lines 21, 97-99,
  130-140, 165, 181-190, 316-319, 366-414), `tests/ranked-results.test.mjs:8, 495-496, 734, 961`,
  `tests/chikun-vfx-presentation.test.mjs:10, 45-55`, `scripts/chikun-ranked-browser-smoke.mjs:395-405`
  (the STACKED smoke's parent-preview pins stay valid: `ranked-results-model.mjs` is untouched).
- The heavy lock (`C:/Users/just_/lesters-arcade-wt/.locks/heavy.lock`) was free when this plan was committed; every browser or `test:release` job still takes it per the protocol, one job per hold.

## 1. Judge's decisions (where the designs disagreed)

| # | Question | Decision | Why |
|---|---|---|---|
| J1 | Token encoding | **Base36 fixed-width fields** (Design 3) with a version char, a game char and a **2-char checksum** (Design 2's probe filter), decoded through **Design 2's result-object API** and made canonical by **re-encode-must-equal** | Fixed-width base36 needs no byte packing, no `btoa`, no BigInt: smallest child code. The checksum rejects 1295/1296 random probes before any render. `encode(normalize(decode(t))) === t` implements exact length, range, enum and cross-field checks with one comparison. |
| J2 | Free copy | **Design 1's family**: game head emoji (`🧟`/`🐔`/`🧱`) + `FREE PLAY`, the Ranked stats line verbatim, one enrichment line, and the game's Ranked CTA + `@LestersArcade` | `🕹` is text-presentation by default (monochrome on Windows/Android). The CTA is the engagement hook; honesty is carried by `FREE PLAY` on line 1, no `⛓ Verified` line, the card ribbon and the page pill. Ranked strings stay byte-identical. |
| J3 | Route param regex | Alternation `(hard-money-heroes|chikun|stacked)` for the slug, `[0-9a-z]{30,40}` for the token | The closed enum is the tighter gate; compiled rows are derivable by analogy (path-to-regexp wraps the custom group as `(?:/(…))`) and verified against the local router. The handler stays the exact gate. |
| J4 | Card design | Design 1's layout (magenta accent, rotated ribbon, gold glyph tiles, 384-px hero portrait bottom-right) with Design 2's content rules; Design 1's pill fallback if the rotation renders badly | Visual lens owns the look; security lens owns what may appear. Portraits at native 384 px (not 256: the card draws them at 442 px). |
| J5 | Page with extra query keys | **302 to the canonical `/f/` URL** when the pair decodes (Design 2 D2); card stays strict 400 | Facebook appends `fbclid`; a 400 would break every human click-through. No render, no cache split. |
| J6 | Deterministic negatives | `public, max-age=0, s-maxage=60` on 400 `invalid-game`/`invalid-token` (Design 2 D3); `no-store` on `invalid-query`, 405, 429, 500 | The answer depends on nothing but the URL; 60 s at the edge absorbs repeated probes of one bad URL. |
| J7 | Native file share | Design 3's lazy `share-file.mjs` + `createNativeShare` with `prepare()` at refresh and a 700 ms race in `share()` | Keeps the fetch out of the initial chunks, pre-fetches during game-over idle time so the tap keeps its user activation, and falls back to text on any failure. |
| J8 | Card URL in the client | `links.card` is a **relative** path `/api/free-card/<slug>/<token>.png`; the page URL is absolute | Same-origin fetch satisfies the children's `connect-src 'self'` on production and on a local dev origin; the share URL must be the public one, as `shareUrlFor` already does. |
| J9 | Chikun `buildChikunShareText` | **Delete** it (and its dead Ranked branch); the child calls `buildFreeShareText('chikun', …)` | −400 B in the child, one template family; `tests/chikun-vfx-presentation.test.mjs` moves in the same commit. |
| J10 | Chikun `shareRunButton` handler | In scope as a flagged 6-line change: it becomes `shareRow.native.share()` | Leaving it would post the old one-liner to the site root, defeating the request. |
| J11 | STACKED `perfectClears` in the token | Dropped | Nothing on the card or page shows it; every token field must be displayed. |
| J12 | HMH hero id | `combat.characterId` with `'lester'` → `'lester-original'`; enum 0 when unknown; never the `hmhRebootHeroId()` default | The default would misattribute a portrait. |
| J13 | Server text tables | One pure module `server/share/free-run.mjs` shared by card and page | The two surfaces can never disagree on a label. |
| J14 | Limiter without Neon | Render anyway, bucket `free-card:ip:` 120/h only when `deps.db` exists (Design 2 D4) | The endpoint must work with no Neon; the CDN absorbs identical URLs; residual risk documented (§8). |

## 2. Files (owner lens in brackets)

New
1. `apps/portal/src/free-share-token.mjs` — import-free encoder/decoder (§3) [3+2]
2. `apps/portal/src/share-file.mjs` — lazy card fetch → `File` (§10.3) [3]
3. `server/share/free-run.mjs` — game table, enum labels, text builders, `decodeFreeRun` (§6.1) [1+2]
4. `server/share/render-free-card.mjs` — Satori tree (§6) [1]
5. `server/share/render-free-page.mjs` — HTML (§7) [1+2]
6. `api/free-card.mjs` (E12), `api/free-share-page.mjs` (E13) (§8) [2]
7. `apps/portal/assets/share-cards/heroes/{lit-commando,lit-valkyrie,lester-original,lilly}.png` — built, committed (§6.5)
8. `tests/free-share-token.test.mjs`, `tests/free-card.test.mjs`, `tests/free-share-page.test.mjs`, `tests/share-file.test.mjs` (§11)
9. `docs/handoffs/free-share-20260926.md` (this file; §12 and §13 get the measured numbers at the end)

Changed
10. `apps/portal/src/share-links.mjs` — `freeIcon`/`freeDetail`/`freeExtra` per template, `buildFreeShareText` body, `buildShareLinks` `card`, `createShareRow` `nativeButton`/`loadShareFile`/`row.links`/`row.native` (§5, §10.2); stays `^import`-free
11. `apps/portal/main.js` — import lines and the share hunk (~2427-2448) only (§10.1)
12. `apps/chikun/src/main.mjs` — import lines, `renderShareRow`, `shareRunButton` handler (§10.1); `apps/chikun/src/presentation.mjs` — remove `buildChikunShareText`
13. `apps/stacked/src/main.mjs` — import line and `renderShareRow` (§10.1)
14. `server/share/render-page.mjs` — export `metaTags`, `documentHtml`, `genericPage`, add `.eyebrow.free`/`.status.free` CSS (pure refactor; pinned outputs unchanged)
15. `scripts/build-share-card-backgrounds.py` — `sync_hero_portraits` (§6.5)
16. `vercel.json` — two `functions` rows, two `rewrites` (§9)
17. `scripts/syntax-check.mjs` — the new `.mjs` files in `NODE_CHECK_FILES`
18. Tests updated deliberately: `share-links`, `ranked-results`, `chikun-vfx-presentation`, `vercel-routing`, `local-chain-rehearsal`, `portal-service-worker-cache`, `api-index-endpoints`, `server-error-log` (if it enumerates `api/*.mjs`), `share-card` (verify only), `server-error-log` (enumerates `api/*.mjs`; no edit expected)
19. `scripts/chikun-ranked-browser-smoke.mjs` — re-pin the Free payload (§11.3)

Nothing else; never `SITE_VERSION`; the HMH child (`apps/hmh-reboot/**`) imports none of this.

## 3. Token grammar (`free-share-token.mjs`, version `a`)

Alphabet `[0-9a-z]` (lowercase base36). Layout: `version(1) game(1) fields… check(2)`.
Every field is fixed-width, zero-padded, big-endian base36; `parseInt(slice, 36)` on
≤ 8 chars stays below 2^53. Checksum: `c = (c*31 + charCode) % 1296` over every
preceding char, written as 2 base36 chars. The header comment states: self-reported,
no integrity, the checksum is a probe filter, layouts are versioned, the module ships
in the children's shared chunk so it stays small.

| Game (code, slug, length) | Field | Width | Range | Source of the bound |
|---|---|---|---|---|
| `lester-blaster` (`h`, `hard-money-heroes`, **30**) | `hero` | 1 | 0..4 (`0` none, then `FREE_SHARE_HEROES` index+1) | `HMH_REBOOT_HERO_IDS` |
| | `score` | 8 | 0..999,999,999,999 | templates' score cap (< 36^8) |
| | `kills` | 5 | 0..9,999,999 | templates' `count` cap |
| | `maxCombo` | 5 | 0..9,999,999 | |
| | `survivalSeconds` | 4 | 0..359,999 | `shareClock` cap (Free HMH has no run ceiling) |
| | `level` | 2 | 1..80 | `ROGUELIKE_LEVEL_CAP` |
| | `flags` | 1 | 0..1 (bit0 `bossDefeated`) | |
| `chikun` (`c`, `chikun`, **40**) | `region` | 1 | 0..6 (`FREE_SHARE_REGIONS` index) | `CHIKUN_REGIONS` order (drift-tested) |
| | `score` | 8 | 0..999,999,999,999 | |
| | `forksPassed`, `nearMisses`, `coinsCollected`, `bestCombo` | 5 each | 0..9,999,999 | |
| | `survivalSeconds` | 4 | 0..3,600 | `CHIKUN_MAX_RUN_TICKS / 60` |
| | `laps` | 2 | 0..99 and `laps*48 ≤ forksPassed` | `laps = floor((lastPassed+1)/48)`, obstacles pass in order |
| | `flags` | 1 | 0..1 (bit0 `daily`) | |
| `stacked` (`s`, `stacked`, **34**) | `flags` | 1 | 0..1 (bit0 `assisted`) | |
| | `score` | 8 | 0..999,999,999,999 | |
| | `lines` | 5 | 0..9,999,999 | |
| | `level` | 2 | 1..30 | `STACKED_LEVEL_CAP` |
| | `quadClears` | 5 | 0..9,999,999 and `quadClears*4 ≤ lines` | a Halving clears four lines (verify in `stacked-sim.mjs` before pinning; drop the rule, not the test, if unprovable) |
| | `maxCombo` | 5 | 0..9,999,999 | |
| | `survivalSeconds` | 4 | 0..7,200 | `STACKED_MAX_TICKS / 60` |

Exports
- `FREE_SHARE_TOKEN_VERSION = 'a'`, `FREE_SHARE_HEROES`, `FREE_SHARE_REGIONS`,
  `FREE_SHARE_GAMES = Object.freeze({ 'lester-blaster': { code:'h', slug:'hard-money-heroes', length:30 }, chikun: { code:'c', slug:'chikun', length:40 }, stacked: { code:'s', slug:'stacked', length:34 } })`,
  `FREE_TOKEN_FIELDS[gameId]` = `[key, width, max, min]` rows.
- `normalizeFreeShareValues(gameId, values) → frozen values`: numbers rounded, clamped
  into range; `true/false` → flags; unknown hero id → `''`, unknown region id →
  `'farmland'`; the cross-field rules applied; idempotent. Values objects use ids and
  booleans (`hero: 'lit-valkyrie'`, `region: 'coast'`, `bossDefeated`, `daily`,
  `assisted`), never enum integers. Throws `TypeError('no free share token for …')`
  for an unknown gameId (own-key lookup; `__proto__`/`toString` throw).
- `encodeFreeShareToken(gameId, values) → string` = pack(normalize(values)) + check.
  Client-side clamping is deliberate: a results panel never throws, and a token it
  builds always decodes.
- `decodeFreeShareToken(slug, token) → { ok:true, gameId, slug, version:'a', values } | { ok:false, error:'invalid-game'|'invalid-token' }`.
  Order: slug → gameId (`Object.hasOwn`), else `invalid-game`; `typeof token === 'string'`,
  exact `length`, `/^[0-9a-z]+$/`, `token[0] === 'a'`, `token[1] === code`, checksum;
  unpack; then **`encodeFreeShareToken(gameId, values) === token`** else `invalid-token`
  (this single check enforces ranges, enums, cross-field rules and canonical form).
  Never throws.
- `freeSharePageUrl(gameId, token, origin = 'https://lestersarcade.io') → '<origin>/f/<slug>/<token>'`,
  `freeShareCardPath(gameId, token) → '/api/free-card/<slug>/<token>.png'`.

Bumping the layout = version `b` (new lengths → a deliberate rewrite edit); old
versions are never reused. No `cardRev`: the URL fully keys the CDN.

## 4. Data at the three call sites → values

- HMH (`main.js`): `heroId = combat.characterId === 'lester' ? 'lester-original' : combat.characterId`;
  `{ hero: heroId, score: combat.score, kills: combat.kills, maxCombo: combat.maxCombo ?? 0, survivalSeconds: combat.elapsedGameSeconds ?? 0, level: (hmhRebootActive ? combat.runLevel : combat.roguelikeRun?.level) ?? 1, bossDefeated: Boolean(combat.bossDefeated) }`;
  text stats add `heroName: CHARACTER_DISPLAY_NAMES[combat.characterId] ?? ''`. `killedBy` leaves the share text (the recap still shows it).
- Chikun (`main.mjs`, `result = runtime.result()`): `{ region: result.regionReached, laps: result.laps, score, forksPassed, nearMisses, coinsCollected, bestCombo, survivalSeconds: result.survivalTime, daily: Boolean(dailyChallenge) }`;
  text stats add `dailyLabel: dailyChallenge?.label ?? ''` and `regionName: result.regionReached`.
- STACKED (`main.mjs`, `s = run.snapshot`): `{ assisted: run.assisted, score: s.score, lines: s.lines, level: s.level, quadClears: s.quadClears, maxCombo: s.maxCombo, survivalSeconds: s.tick / 60 }`.

## 5. Free copy (exact; `share-links.mjs`)

Family rule mirroring Ranked: line 1 = `freeIcon FREE PLAY · title`; line 2 = points +
Ranked `detail` + `freeDetail`; line 3 = the Ranked `stats` line **verbatim**; optional
`freeExtra` line; last line = `call @LestersArcade`. `TEMPLATES[game]` gains
`freeIcon`, `freeDetail(s)`, `freeExtra(s)`; `detail`, `stats`, `call` are untouched
so every Ranked string stays byte-identical.

```
buildFreeShareText(gameId, { score = 0, stats = {} } = {}) → [
  `${t.freeIcon} FREE PLAY · ${t.title}`,
  `${count(score, 999_999_999_999)} pts${t.detail(s)}${t.freeDetail(s)}`,
  t.stats(s),
  ...(t.freeExtra(s) ? [t.freeExtra(s)] : []),
  `${t.call} ${X_MENTION}`,
].join('\n')
```

Hard Money Heroes (`freeIcon '🧟'`; `🏆` stays Ranked-only)
```
🧟 FREE PLAY · Hard Money Heroes
48,210 pts · Lit Commando · Lv 9
☠ 312 kills · 🔥 ×42 combo · ⏱ 12:04
💀 Liquidator liquidated
Can you beat it? @LestersArcade
```
`freeDetail`: ` · ${safeShareFragment(s.heroName, 16)}` when non-empty, then ` · Lv ${count(level)}` when `number(s.level) ≥ 1`. `freeExtra`: `💀 Liquidator liquidated` when `s.bossDefeated === true || number(s.bossKills) ≥ 1`. Weights: typical 161 (+24 = 185); worst (score cap, 16-char hero, Lv 9,999,999, counters 9,999,999, ⏱ 5999:59, boss) **197 (+24 = 221)**.

Chikun's Escape (`freeIcon '🐔'`)
```
🐔 FREE PLAY · Chikun's Escape
19,475 pts · Lap 2 · Farmland · Daily 2026-09-26
🌾 52 forks · ⚡ 18 near-misses · 🪙 41 coins
⏱ 3:00 flight · 🔥 ×9 combo
Beat my flight @LestersArcade
```
`detail` (existing) gives ` · Lap N · Region`; `freeDetail`: ` · ${safeShareFragment(s.dailyLabel, 16)}` when non-empty. `freeExtra`: `⏱ ${shareClock(s.survivalSeconds)} flight · 🔥 ×${count(s.bestCombo)} combo` when `number(s.survivalSeconds) > 0`. Worst (Lap 10,000,000, `Industrial`, 16-char daily label, all counters 9,999,999, 5999:59) **236 (+24 = 260)**.

STACKED (`freeIcon '🧱'`)
```
🧱 FREE PLAY · STACKED
412,900 pts · ⏱ 25:00 · 🔥 ×7 combo
📈 186 lines · Lv 14 · 5 Halvings
Stack higher @LestersArcade
```
`freeDetail`: ` · ⏱ ${shareClock(s.survivalSeconds)}` when `> 0`, ` · 🔥 ×${count(s.maxCombo)} combo` when `number(s.maxCombo) > 1`, ` · Assisted` when `s.assisted === true`. No `freeExtra`. The pinned case `{score:4200, stats:{lines:40, level:5, quadClears:1}}` → `🧱 FREE PLAY · STACKED\n4,200 pts\n📈 40 lines · Lv 5 · 1 Halving\nStack higher @LestersArcade`. Worst **171 (+24 = 195)**.

All worst cases are ≤ 256, so `fitWeight` never clips a Free template
(`buildShareLinks({text}).text === text`, tested like Ranked). Invariants unchanged:
one `@LestersArcade`, no `#`, no wallet, no `session-`, never `Verified`, never
`RANKED`. `buildHmhShareText` and `buildStackedShareText` stay exported (tests and
contract §7.4 name them) but no call site uses them. `ranked-results-model.mjs`
preview/practice shares get the richer text for free and still point at the site root
(follow-up, §16).

## 6. Card (1200×630, `render-free-card.mjs`)

### 6.1 `server/share/free-run.mjs` (pure; shared by card and page)
`FREE_GAMES = { 'lester-blaster': { title:'Hard Money Heroes', slug:'hard-money-heroes' }, chikun: { title:"Chikun's Escape", slug:'chikun' }, stacked: { title:'STACKED', slug:'stacked' } }`,
`HERO_LABELS = { '': 'Survivor', 'lit-commando':'Lit Commando', 'lit-valkyrie':'Lit Valkyrie', 'lester-original':'Lester', lilly:'Lilly' }`,
`REGION_LABELS` (Farmland … Coast), `decodeFreeRun(slug, token)` (wraps the shared
decoder; returns `{ ok, run: { gameId, slug, title, token, values } }`), `identityText(run)`,
`chipText(run)`, `tiles(run)` (3 × `{ glyph, label, value }`), `summaryText(run)`,
`pageTitle(run)`, `pageDescription(run)`, `imageAlt(run)`. Output is ASCII/Latin-1
(`×`, `·`, `'`); no emoji; every value is a number or a table label.

### 6.2 Colour and type (one difference per role from the Ranked card)
| Role | Ranked | Free |
|---|---|---|
| Frame border 4px | green .55 / cyan .35 | `rgba(255,61,242,0.55)` MAGENTA |
| Eyebrow 22 / ls 6 | `LESTER'S ARCADE · RANKED` cyan | `LESTER'S ARCADE · FREE PLAY` magenta |
| Status | green pill `VERIFIED ON LITVM` | corner **ribbon** `FREE PLAY · SELF-REPORTED` magenta fill, ink `#14021a` |
| Score glow | cyan | `textShadow 0 0 24px rgba(255,61,242,0.7)`; `PTS` magenta |
| Identity row | LA circle + handle | LA circle + `identityText` cyan 32 (no handle: nothing personal exists) |
| Tiles | cyan border, no glyph | `rgba(255,232,77,0.4)` GOLD border, gold 28-px SVG glyph before the label |
| Chips | gold champion chip | gold `LIQUIDATOR LIQUIDATED` / amber `ASSISTED` / cyan `DAILY COURSE` |
| Badges bottom-right | up to 4 | none; HMH draws the hero portrait |
| Footer | `lestersarcade.io` muted bottom-right | `lestersarcade.io · play free` gold 22 / ls 2 under the title |
GREEN `#45ff8a` and the strings `VERIFIED`, `LITVM`, `RANKED`, `PUBLISH` never appear on a Free card (tested).
Geist Regular only: eyebrow 22/ls 6 uppercase · title 44 · domain 22/ls 2 · chip 22/ls 2 uppercase pill (`padding 6px 16px`, `border 3px`, `borderRadius 999`) · score by ladder / lineHeight 1 · `PTS` 40/ls 6 · identity 32 · tile glyph 28, label 18/ls 3 uppercase MUTED, value 40 (36 when ≥ 8 chars) · ribbon 26/ls 3.

### 6.3 Layers (root `display:flex`, `overflow:hidden`; every multi-child node flex; every image a data URI)
1. Background `img` 1200×630 absolute (existing `share-cards/<gameId>.png`).
2. HMH only, optional glow: absolute `left 760 top 470 width 420 height 160 borderRadius 999 backgroundImage radial-gradient(rgba(255,61,242,0.32), rgba(255,61,242,0) 70%)` (drop if Satori misrenders; decorative).
3. HMH only, portrait `img` `left 738 top 188 width 442 height 442` (384 × 1.15, bottom-anchored so the thigh cut is off-card), only when `values.hero !== ''` and the PNG resolved.
4. Text layer: absolute full, column, `justifyContent space-between`, `padding 44px 56px 40px`, `border 4px solid rgba(255,61,242,0.55)`:
   - top-left column: eyebrow → title (`marginTop 6`) → domain line (`marginTop 8`) → chip (`marginTop 12`, `alignSelf flex-start`) when any; the right of this row stays empty (the ribbon owns the corner);
   - middle: score row (`alignItems flex-end`; `PTS marginLeft 18 marginBottom 20`), identity row (`marginTop 10`): 52-px LA circle (`linear-gradient(135deg, #19f7ff, #ff3df2)`, `LA` 22 in `#05070f`) + identity text `marginLeft 16`;
   - bottom: three tiles (`marginLeft 14` between; tile = column, `minWidth 190`, `padding 12px 20px`, `borderRadius 14`, `bg rgba(5,7,18,0.78)`; row 1 glyph `svg 28×28` + label `marginLeft 10`; row 2 value).
   Vertical budget (HMH worst): 174 + 202 + 106 = 482 ≤ 546 → 64 px slack.
5. Ribbon (last): `position absolute, left 750, top 142, width 560, height 56, transform rotate(45deg), transformOrigin center, backgroundColor #ff3df2, color #14021a, fontSize 26, letterSpacing 3, alignItems center, justifyContent center, boxShadow 0 0 24px rgba(255,61,242,0.6)`, text `FREE PLAY · SELF-REPORTED`. Its centre line runs (860,0)→(1200,340): clears the title, the score row and every hero head (highest hair pixel ≈ y 231 at x ≈ 956). **Fallback** if the render test shows artefacts: the same text as a magenta-outlined pill in the Ranked status slot (top-right).

Score ladder `scoreFontSize(text, maxWidth)`: `em = digits×0.663 + separators×0.201`;
largest rung of `[148,140,120,104,88,72,60]` with `em×size + 118 ≤ maxWidth`;
`maxWidth = 724` with the portrait (56 + 724 + 24 gap = 804 = the leftmost silhouette
pixel), else `1088`. `48,210` → 148; `999,999` → 140; `9,999,999` → 120;
`999,999,999` → 88; `999,999,999,999` → 60 (104 without portrait). Tiles worst case
with portrait: `23:59:59` at 36 px ≈ 230 → 718 < 748.

### 6.4 Per-game rows
| gameId | Identity text | Chip | Tiles (glyph · label · value) |
|---|---|---|---|
| lester-blaster | `${HERO_LABELS[hero]} · Level ${level}` | `LIQUIDATOR LIQUIDATED` gold when boss | skull · KILLS · `count(kills)`; clock · TIME · `clock(seconds)`; flame · COMBO · `×${count(maxCombo)}` |
| chikun | `Lap ${laps+1} · ${REGION_LABELS[region]}` | `DAILY COURSE` cyan when daily | fork · FORKS; bolt · NEAR-MISSES; coin · COINS |
| stacked | `${clock(seconds)} played · ×${count(maxCombo)} best combo` | `ASSISTED` amber when assisted | chart · LINES; arrow · LEVEL; half-coin · HALVINGS |
`clock` = the Ranked card's (`h:mm:ss` past an hour). Labels and order match the Ranked card.

Glyphs: inline SVG nodes `{ type:'svg', props:{ width:28, height:28, viewBox:'0 0 24 24', children:[{ type:'path', props:{ d, fill:'none', stroke:'#ffe84d', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' } }, …] } }`:
skull `M12 3a7 7 0 0 0-7 7c0 2.6 1.4 4.6 3 5.7V19h8v-3.3c1.6-1.1 3-3.1 3-5.7a7 7 0 0 0-7-7z` + eyes `M9.5 11h.01M14.5 11h.01` (strokeWidth 3) + teeth `M10 19v2m4-2v2`;
clock `M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z` + `M12 7v5l3.5 2`;
flame `M13 2c2 5-2 6 1 9 1-2 3-3 4-3 2 5 1 12-6 13-6 0-9-7-5-11 1 2 2 3 3 3-1-4 1-7 3-11z`;
fork `M12 21v-8M12 13L6 6M12 13l6-7M6 6h4M6 6v4M18 6h-4M18 6v4`; bolt `M13 2L5 13h6l-1 9 9-12h-6l1-8z`;
coin = clock circle + `M10 7v10h5M8.5 13.5l4-2.5` (a drawn Ł: Geist has no `Ł`);
chart `M4 19h16M5 15l4-4 4 3 5-6 2 2`; arrow-up `M12 4l7 7h-4v9H9v-9H5l7-7z`;
half-coin = circle + `M12 4v16` + `M12 4a8 8 0 0 0 0 16z` filled `#ffe84d`.

Exports: `buildFreeCardElement({ run, background, heroPortrait })`, `FREE_CARD_RIBBON`, `FREE_CARD_ACCENT = '#ff3df2'`, `scoreFontSize`, `GLYPHS`, `PORTRAIT_BOX = { left:738, top:188, size:442 }`, `RIBBON_BOX = { left:750, top:142, width:560, height:56 }`. Text goes through `cardText` imported from `render-card.mjs` (never fork the glyph filter).

### 6.5 Assets and build script
`scripts/build-share-card-backgrounds.py` gains `HERO_PORTRAITS` (the four
`apps/portal/assets/generated/hmh-hero-portraits/<id>.webp`), `PORTRAIT_FRAME = (768, 0, 1152, 384)`
(the `south` rest frame per `portraits.json` `atlas.directions[0]`), `PORTRAIT_MAX_BYTES = 80_000`.
`sync_hero_portraits(write)`: open → crop → `convert('RGBA')` → `quantize(colors=255, method=Image.Quantize.FASTOCTREE)`
(deterministic, keeps alpha) → `save(PNG, optimize=True)` to `apps/portal/assets/share-cards/heroes/<id>.png`
(384×384, ≈ 35 KB each). `--check` verifies existence, size, dimensions, PNG format
and byte identity with a re-derived image. Docstring gains the heroes paragraph; no
raw sources are committed (`*.png` is `binary` in `.gitattributes`; no LFS rule
touches `apps/portal/assets/**`). `api/free-card.mjs` resolves each portrait from a
frozen table `new URL('../apps/portal/assets/share-cards/heroes/<id>.png', import.meta.url)`
keyed by hero id (never a directory URL, never cwd); `includeFiles apps/portal/assets/share-cards/**` already covers it.
`tests/share-card.test.mjs`'s badge-directory equality recurses `share-cards/badges/` only; `heroes/` is outside it (verify, leave unchanged).

## 7. Page (`/f/<slug>/<token>`, `render-free-page.mjs`)

`renderFreeSharePage({ run, status = 200 }) → { status, headers, html }`; reuse
`escapeHtml`, `metaTags`, `documentHtml`, `genericPage` exported from `render-page.mjs`.
- `<title>` = `og:title` = `twitter:title` = `${count(score)} pts in ${title} · Free Play` → `48,210 pts in Hard Money Heroes · Free Play`.
- description = `Free Play · self-reported · ${identityText} · ${summaryText}. Can you beat it? Play free or Ranked at Lester's Arcade.` with `summaryText` = `312 kills · 12:04 survived · ×42 combo` / `52 forks · 18 near-misses · 41 coins` / `186 lines · level 14 · 5 Halvings`, and the boss/assisted/daily label appended to `identityText` (`Lit Commando · Level 9 · Liquidator liquidated`).
- `og:url` = `<link rel=canonical>` = `https://lestersarcade.io/f/<slug>/<token>`; `og:image` = `twitter:image` = `https://lestersarcade.io/api/free-card/<slug>/<token>.png`, `og:image:width 1200`, `og:image:height 630`, `og:image:alt` = `${title} Free Play score card: ${count(score)} points (self-reported)`; `twitter:card summary_large_image`; `twitter:site @LestersArcade`; `<meta name="robots" content="noindex">`.
- Body: `<p class="eyebrow free">Free Play · ${title}</p>`, `<img class="shot" src="/api/free-card/<slug>/<token>.png" width="1200" height="630" alt="…">`, `<h1>` score, `<p class="status free">Free Play · self-reported</p>`, note `This score was reported by the player's browser and is not verified. Free runs never touch the Ranked boards or LitVM. Play Ranked to put a verified score on chain.` (the only place "Ranked"/"LitVM" appear, in the negative), `Run stats` `<dl>` (HMH: Hero, Level, Kills, Time, Best combo, Boss `Defeated`/`Not defeated`; Chikun: Region, Laps, Forks, Near-misses, Coins, Best combo, Time, `Course · Daily` when daily; STACKED: Lines, Level, Halvings, Best combo, Time, `Assisted · Yes` when assisted), buttons `Play ${title}` → `/play/${slug}` and `All arcade games` → `/`. No `<script>`. CSS additions in `render-page.mjs` STYLE: `--magenta:#ff3df2; .eyebrow.free{color:var(--magenta)} .status.free{border:2px solid var(--magenta);color:var(--magenta);background:rgba(44,4,40,.8)}`.
- Generic pages: 400 heading `That is not a run link`, copy `Free share links look like lestersarcade.io/f/<game>/<code>.`; 405 (400-styled, `Allow: GET, HEAD`); 500 (503-styled, `no-store`). Every interpolation is escaped even though every value is a number or a table label.

## 8. Endpoints (E12 card, E13 page)

Common: GET/HEAD only (405 `Allow: GET, HEAD`); `queryOf(req, ['game','token'])`; `deps = await depsFactory()` **before** decoding (the `tests/server-error-log.test.mjs` contract: a throwing factory → one `logInternalError(label, error)` → 500); `X-Content-Type-Options: nosniff`; `X-Robots-Tag: noindex`; the handler, not the router, is the gate (`/api/free-card?game=pinball&token=…` → 400). Files resolve per file from `import.meta.url`; Satori gets data URIs only; `cardText` filters every string; a test blocks `fetch` during render. No Neon required.

`api/free-card.mjs`
- `FREE_CARD_QUERY = ['game','token']`; `FREE_CARD_CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'` (200 and HEAD; not `immutable`, so a renderer fix propagates within a day); `FREE_CARD_INVALID_CACHE = 'public, max-age=0, s-maxage=60'` on 400 `invalid-game`/`invalid-token`; `no-store` on 400 `invalid-query`, 405, 429, 500.
- `FREE_CARD_RENDER_LIMITS = { ip: 120, windowSeconds: 3600 }`, bucket `free-card:ip:${ipBucket(ip, secret)}` (separate from `card:ip:` so Free probing cannot starve Ranked renders), secret = `deps.config.session.secret()` when configured else E11's unkeyed salt; applied **only when `deps.db`**; HEAD never renders or counts.
- `freeCardRequest({ method, query, ip }, deps)` (pure): decode → 400; HEAD → 200 no body; limiter; `renderFreeCardPng(run)` (background + portrait data URIs memoised; a missing file reads as `null` and the card omits it) → 200 PNG with `Content-Length`. `createHandler(depsFactory)` mirrors E11's adapter; label `free-card`. `export default createHandler(() => buildDeps())` where `buildDeps(env, { db })` tolerates `db: null`.

`api/free-share-page.mjs`
- `FREE_PAGE_QUERY = ['game','token']`; 200 HTML with the card's cache string; extra or conflicting keys **when the pair decodes** → `302 Location: /f/<slug>/<token>` (built only from the validated slug and the re-encoded token), `Cache-Control: public, s-maxage=3600`, empty body; otherwise the 400 generic page with `public, max-age=0, s-maxage=60`; 405; 500 `no-store`; HEAD headers only; label `free-share-page`.

Residual risk (documented, accepted): without Neon there is no per-IP limiter; identical URLs are absorbed by the CDN, distinct forged URLs are not; the contract §13 optional WAF rule (`/api/*` 600 req/min/IP) is the backstop. `maxDuration 20`, `memory 1024` bound each render.

## 9. Routing (`vercel.json`: functions + rewrites only)

```
"api/free-share-page.mjs": { "maxDuration": 10 },
"api/free-card.mjs": { "maxDuration": 20, "memory": 1024, "includeFiles": "apps/portal/assets/share-cards/**" }
```
Rewrites, inserted directly after the `/api/share-card/...` rule (both before `/games/:path*`); params are named after the destination keys so `vercelAppendedParams` stays `[]`:
```
{ "source": "/f/:game(hard-money-heroes|chikun|stacked)/:token([0-9a-z]{30,40})", "destination": "/api/free-share-page?game=:game&token=:token" },
{ "source": "/api/free-card/:game(hard-money-heroes|chikun|stacked)/:token([0-9a-z]{30,40}).png", "destination": "/api/free-card?game=:game&token=:token" }
```
Predicted `VERCEL_COMPILED` rows (by analogy with the recorded rows; confirm with `npx --no-install vercel` if a CLI is reachable, else verify with `compileVercelSource` and record "derived, CLI unavailable" in the test comment):
```
{ source: '/f/:game(hard-money-heroes|chikun|stacked)/:token([0-9a-z]{30,40})', destination: '/api/free-share-page?game=:game&token=:token', src: '^/f(?:/(hard-money-heroes|chikun|stacked))(?:/([0-9a-z]{30,40}))$', dest: '/api/free-share-page?game=$1&token=$2' },
{ source: '/api/free-card/:game(hard-money-heroes|chikun|stacked)/:token([0-9a-z]{30,40}).png', destination: '/api/free-card?game=:game&token=:token', src: '^/api/free-card(?:/(hard-money-heroes|chikun|stacked))(?:/([0-9a-z]{30,40}))\\.png$', dest: '/api/free-card?game=$1&token=$2' }
```
The route regex is the coarse gate (alphabet, 30-40 chars, three slugs); the decoder is the exact gate (30/40/34). The existing portal CSP rule covers `/f/`; the service worker already bypasses `/api/` (`sw.js:106`). A vercel.json `X-Robots-Tag` header rule for `/f/(.*)` is a follow-up (the handlers set the header themselves).

## 10. Client wiring

### 10.1 The three hunks
HMH `apps/portal/main.js` (import lines + ~2427-2448):
```js
import { buildFreeShareText, buildShareLinks, createShareRow } from './src/share-links.mjs';
import { encodeFreeShareToken, freeShareCardPath, freeSharePageUrl } from './src/free-share-token.mjs';
…
if (!win && (currentSession?.mode ?? officialSelectedMode ?? 'free') === 'free') {
  const heroId = combat.characterId === 'lester' ? 'lester-original' : combat.characterId;
  const values = { hero: heroId, score: combat.score, kills: combat.kills, maxCombo: combat.maxCombo ?? 0, survivalSeconds: combat.elapsedGameSeconds ?? 0, level: (hmhRebootActive ? combat.runLevel : combat.roguelikeRun?.level) ?? 1, bossDefeated: Boolean(combat.bossDefeated) };
  const token = encodeFreeShareToken('lester-blaster', values);
  const shareLabel = el('span', { className: 'share-row-label', textContent: 'Share this run' });
  const shareRow = createShareRow({
    title: 'Hard Money Heroes',
    links: buildShareLinks({
      text: buildFreeShareText('lester-blaster', { score: combat.score, stats: { ...values, heroName: CHARACTER_DISPLAY_NAMES[combat.characterId] ?? '' } }),
      url: freeSharePageUrl('lester-blaster', token),
      card: freeShareCardPath('lester-blaster', token),
    }),
    className: 'share-row game-over-share-row',
    buttonClassName: 'combat-menu-action share-button',
    onStatus: (message) => { shareLabel.textContent = message; },
  });
  shareRow.prepend(shareLabel);
  dom.combatGameOverSummary.append(shareRow);
}
```
(`shareUrlFor` and `buildHmhShareText` have no other users in `main.js`; the real `navigator` gives the parent the native button and the lazy file path.)

Chikun `apps/chikun/src/main.mjs` (imports at 23 and 25; `renderShareRow` 889-909; `shareRunButton` handler 910-925 — flagged, J10). Test anchors `'let shareRow = null;\nfunction renderShareRow(result) {'` and `"\nshareRunButton.addEventListener('click'"` are preserved:
```js
import { buildChikunReplayTimeline, buildChikunModeTease, buildChikunJackpotTease } from './presentation.mjs';
import { buildFreeShareText, buildShareLinks, createShareRow } from '../../portal/src/share-links.mjs';
import { encodeFreeShareToken, freeShareCardPath, freeSharePageUrl } from '../../portal/src/free-share-token.mjs';
…
let shareRow = null;
function renderShareRow(result) {
  const mount = document.querySelector('#shareRow');
  if (!mount) return;
  mount.hidden = shareRunButton.hidden = mode === 'ranked';
  if (mode === 'ranked') return;
  const values = { region: result.regionReached, laps: result.laps, score: result.score, forksPassed: result.forksPassed, nearMisses: result.nearMisses, coinsCollected: result.coinsCollected, bestCombo: result.bestCombo, survivalSeconds: result.survivalTime, daily: Boolean(dailyChallenge) };
  const token = encodeFreeShareToken('chikun', values);
  const links = buildShareLinks({
    text: buildFreeShareText('chikun', { score: result.score, stats: { ...values, regionName: result.regionReached, dailyLabel: dailyChallenge?.label ?? '' } }),
    url: freeSharePageUrl('chikun', token),
    card: freeShareCardPath('chikun', token),
  });
  if (shareRow) { shareRow.refresh(links); return; }
  shareRow = createShareRow({ documentRef: document, navigatorRef: navigator, nativeButton: false, title: "Chikun's Escape", links, className: 'share-row', buttonClassName: 'secondary-button share-button', onStatus: setLive });
  mount.replaceChildren(shareRow);
}
shareRunButton.addEventListener('click', async () => {
  if (!shareRow?.links) return;                         // Ranked: hidden and inert
  try {
    if (navigator.share) await shareRow.native.share();
    else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareRow.links.discord);
    else throw new Error('Sharing is unavailable');
    …unchanged 'Shared'/'Copied' UI…
```
`apps/chikun/src/presentation.mjs`: delete `buildChikunShareText` (J9).

STACKED `apps/stacked/src/main.mjs` (import line 7; `renderShareRow` 108-120; anchors `'let shareRow = null;\nfunction renderShareRow(s) {'` / `'\nasync function finish()'` preserved):
```js
import { buildFreeShareText, buildShareLinks, createShareRow } from '../../portal/src/share-links.mjs';
import { encodeFreeShareToken, freeShareCardPath, freeSharePageUrl } from '../../portal/src/free-share-token.mjs';
…
function renderShareRow(s) {
  const mount = $('shareRow');
  if (!mount) return;
  if ((mount.hidden = init.mode === 'ranked')) return;
  const values = { assisted: run.assisted, score: s.score, lines: s.lines, level: s.level, quadClears: s.quadClears, maxCombo: s.maxCombo, survivalSeconds: s.tick / 60 };
  const token = encodeFreeShareToken('stacked', values);
  const links = buildShareLinks({ text: buildFreeShareText('stacked', { score: s.score, stats: values }), url: freeSharePageUrl('stacked', token), card: freeShareCardPath('stacked', token) });
  if (shareRow) { shareRow.refresh(links); return; }
  shareRow = createShareRow({ documentRef: document, title: 'STACKED', links, className: 'share-row', buttonClassName: 'share-button', onStatus: (message) => { $('overlayCopy').textContent = message; } });
  mount.replaceChildren(shareRow); mount.hidden = false;
}
```

### 10.2 `share-links.mjs` additions (no static import; the lazy path is a dynamic `import()` behind an injectable loader)
- `buildShareLinks({ text, url = SHARE_ORIGIN, card = null })` → frozen result gains `card` (string | null). Ranked callers pass none.
- `createShareRow` options `nativeButton = true`, `loadShareFile = () => import('./share-file.mjs')`; `row.links` (current links); `row.native = createNativeShare(...)` (also exported):
  ```
  prepare(): prepared = (links.card && typeof navigatorRef?.canShare === 'function' && typeof File === 'function')
               ? loadShareFile().then((m) => (m.canShareFiles(navigatorRef) ? m.fetchShareCardFile(links.card) : null)).catch(() => null) : null;
  share():   payload = { title, text: links.text, url: links.url };
             file = prepared ? await Promise.race([prepared, delay(700)]).catch(() => null) : null;   // keeps transient activation
             if (file && navigatorRef.canShare?.({ files: [file] })) { try { await navigatorRef.share({ ...payload, files: [file] }); return 'card'; } catch (e) { if (e?.name === 'AbortError') throw e; } }
             await navigatorRef.share(payload); return 'text';
  ```
  `prepare()` runs at creation and in `refresh()`; the native button's click handler becomes `await row.native.share()` with the existing status strings. Row DOM and order are unchanged (`['x','more','menu']`, menu `['discord','facebook','native'?]`), so the Escape/disclosure tests keep passing. Discord copy = text + newline + the `/f/` URL (unfurls the card through the page); Facebook = `?u=<page URL>`; X intent = text + url + `related=LestersArcade`.

### 10.3 `apps/portal/src/share-file.mjs` (lazy chunk, ≈ 0.6 KB)
`fetchShareCardFile(cardPath, { fetchImpl = fetch, timeoutMs = 4000, name = 'lesters-arcade-free-run.png' }) → File | null`: same-origin `fetch(cardPath, { signal, credentials: 'omit' })`, requires `ok`, `blob.type === 'image/png'`, `size ≤ 2,000,000`; every failure → null. `canShareFiles(navigatorRef)` probes `canShare({ files: [1-byte PNG File] })` in try/catch. On a foreign dev origin the fetch fails and the share falls back to text + URL. Both hosts already set `allow="… web-share; clipboard-write"`; children's CSP `connect-src 'self'`/`img-src 'self'` allow the same-origin fetch.

## 11. Tests (RED first)

### 11.1 New
`tests/free-share-token.test.mjs`: exact lengths 30/40/34 and `/^[0-9a-z]+$/`; round trips for typical and maximal fixtures; clamping, rounding, `true`→flag, unknown hero → `''`, unknown region → `'farmland'`; rejections each `{ ok:false, error }` never throwing: unknown slug / `toString` / `__proto__` (`invalid-game`), length ±1, uppercase, `=`/`+`/`/`/`-`/`_`/unicode, version `b`, wrong game char, flipped checksum, every field at `max+1`, HMH `level 0`/`hero 5`/`flags 2`, Chikun `region 7`/`laps 2 with forksPassed 95`, STACKED `level 31`/`quadClears 47 with lines 186`; canonicality `encode(decode(t).values) === t` over 500 seeded random tuples; `normalize` idempotent; pins `FREE_SHARE_HEROES` deep-equals `HMH_REBOOT_HERO_IDS` (regex from `main.js`), `FREE_SHARE_REGIONS` deep-equals `CHIKUN_REGIONS.map(r => r.id)`, level maxima equal `ROGUELIKE_LEVEL_CAP`/`STACKED_LEVEL_CAP`, `Object.keys(FREE_SHARE_GAMES)` equals the cabinet ids and slugs; `doesNotMatch(source, /^import /m)`; minified size via `esbuild.transform` ≤ 2,400 B.

`tests/free-card.test.mjs` (mount `createHandler(() => buildDeps(env, { db, nowMs }))` like `share-card.test.mjs`): valid HMH token (hero `lit-valkyrie`, boss) → 200 `image/png`, IHDR 1200×630, `Content-Length`, `cache-control` exactly `FREE_CARD_CACHE`, `x-robots-tag: noindex`, no `immutable`, `withoutNetwork` attempts empty, `free-card:ip:%` hits `[1]`, `card:ip:%` count 0; **`db: null` → still 200**; HEAD → 200 no body no bucket row; 429 after 120 renders, another IP renders; `&cb=1`, `&width=2000`, duplicate conflicting `token` → 400 `invalid-query` `no-store`; bad slug → 400 `invalid-game`, wrong length / bad checksum / version `b` / out of range → 400 `invalid-token`, all `public, max-age=0, s-maxage=60` and no rate-limit row; POST → 405 `Allow`; a throwing factory → one error log line and 500. Tree (`buildFreeCardElement`): every multi-child node flex; images `data:image/` only; root `overflow: 'hidden'`; ribbon text exactly once; `doesNotMatch(/VERIF|LITVM|RANKED|PUBLISH/i)`; no style value contains `#45ff8a`/`69, 255, 138`; border contains `255, 61, 242`; three `svg` glyph nodes per game; hero `img` only for `hero !== ''` with a data URI, absent for `''` and when the file is missing; chips per flag; identity strings per game (Chikun `region 'coast', laps 2` → `Lap 3 · Coast`; STACKED assisted → `ASSISTED`); Geist-safe scan; `scoreFontSize` table (§6.3); `heroes/*.png` are exactly the four ids, 384×384 PNG < 80 KB; `python scripts/build-share-card-backgrounds.py --check` passes (spawned); `heroPortraitUrl('')`, `('pinball')`, `('../x')` are `null`.

`tests/free-share-page.test.mjs`: for each game, 200 `<!doctype html>` with every tag of §7 (exact `og:title`, `og:description`, `og:url`, `og:image`, width/height/alt, `twitter:card`, `twitter:site`), canonical link, `<meta name="robots" content="noindex">`, `x-robots-tag`, `cache-control` = the card string, `<img class="shot" src="/api/free-card/hard-money-heroes/<token>.png"`, buttons `/play/<slug>` and `/`, `<dt>Hero</dt><dd>Lit Valkyrie</dd>`, no `<script`, `doesNotMatch(/Verified on LitVM|Publishing to LitVM/)`, no wallet/`session-`; `&fbclid=abc` and `&utm_source=x` on a valid pair → 302 `location: /f/chikun/<token>`, `public, s-maxage=3600`, empty body; a bad token with `&fbclid` → 400 page; missing/invalid pair → 400 generic page (site logo `og:image`, `twitter:site`), `public, max-age=0, s-maxage=60`; 405 with `Allow`; HEAD 200 empty; throwing deps → 500 `no-store`; `db: null` → 200; hostile `token`/`values` strings fed straight to `renderFreeSharePage` never appear unescaped.

`tests/share-file.test.mjs`: fake fetch (ok / 404 / wrong type / oversize / abort / throws) → `File` | null; `canShareFiles` true / false / throwing.

### 11.2 Deliberate pin updates
- `tests/share-links.test.mjs`: exact typical strings of §5 for the three Free templates; worst-case weights 197/236/171 (≤ 256, `buildShareLinks({text}).text === text`); `FREE PLAY` on line 1; `doesNotMatch /Verified|RANKED/`; boss line only with `bossDefeated`; hero fragment scrubbed and cut at 16 (hostile `heroName`/`dailyLabel` in the invariants loop); Chikun line 4 only with time, daily label only when set; STACKED `Assisted`; `{stats:null}` valid; every Ranked exact string unchanged; line 190 narrows to `/buildRankedShareText/`; lines 316-319 become `buildFreeShareText\('lester-blaster'`, `buildFreeShareText\('stacked'`, `buildFreeShareText\('chikun'`; the vm child-row tests inject `buildFreeShareText`, `encodeFreeShareToken`, `freeSharePageUrl`, `freeShareCardPath`, `navigator` and assert the X `url` matches `^https://lestersarcade\.io/f/chikun/ac[0-9a-z]{38}$` / `/f/stacked/as[0-9a-z]{32}$`, text `^🐔 FREE PLAY` / ends `Beat my flight @LestersArcade` / `Stack higher @LestersArcade`, the token decodes to the input stats, Ranked still hides; `links.card` null by default / string when passed; native path with `navigatorRef { share, canShare: () => true }` and an injected `loadShareFile` → payload has `files: [file]`; fallbacks (canShare false → no files; fetch null → text; `NotAllowedError` with files → retried without; AbortError → no status); `refresh` re-prepares and updates `row.links`; `nativeButton: false` removes the button but keeps `row.native`. Remove the `buildChikunShareText` import and cases (lines 21, 138-139).
- `tests/ranked-results.test.mjs`: `:496` — the results model's preview/practice text is `buildFreeShareText` too, so re-pin to `/Can you beat it\? @LestersArcade$/` (HMH) and keep `url === 'https://lestersarcade.io'` (model untouched); `:734` vm globals gain `buildFreeShareText`, `encodeFreeShareToken`, `freeSharePageUrl`, `freeShareCardPath`, `CHARACTER_DISPLAY_NAMES`; `:961` asserts `url` = `/f/hard-money-heroes/ah…` (30 chars) and `links.card` = `/api/free-card/hard-money-heroes/ah….png`, decoded score 48,210.
- `tests/chikun-vfx-presentation.test.mjs`: drop the `buildChikunShareText` cases.
- `tests/vercel-routing.test.mjs`: two `VERCEL_COMPILED` rows (§9); routed cases `/f/chikun/<40>`, `/api/free-card/stacked/<34>.png?x=1` (query carried); non-matches `/f/pinball/…`, `/f/chikun/<29>`, `/f/chikun/<41>`, `/f/chikun/<40 with '.'>`, `/api/free-card/stacked/<34>.jpg`, `/api/free-card/stacked/<34>xpng`, `/f/chikun/<40>/`; ordering before `/games/:path*`; the `functions` deepEqual gains the two rows; the `.mjs exists` loop passes.
- `tests/local-chain-rehearsal.test.mjs:114`: the routed cases and non-matches above.
- `tests/portal-service-worker-cache.test.mjs`: `/api/free-card/stacked/<34>.png` `{ destination: 'image' }` in the bypass list.
- `tests/api-index-endpoints.test.mjs`: a positive "works with no env" pair for both modules (200), the fails-closed list unchanged.
- `tests/server-error-log.test.mjs`: it enumerates `api/*.mjs` (`apiModules`, line 76), so both new modules must satisfy the one-line `logInternalError` contract (deps factory awaited before validation; a throwing factory → exactly one log line → 500).
- `scripts/syntax-check.mjs`: add `apps/portal/src/free-share-token.mjs`, `apps/portal/src/share-file.mjs`, `server/share/free-run.mjs`, `server/share/render-free-card.mjs`, `server/share/render-free-page.mjs`, `api/free-card.mjs`, `api/free-share-page.mjs` and the four test files.

### 11.3 Smoke pin updates (same commit as the call sites)
`scripts/chikun-ranked-browser-smoke.mjs:395` — the hidden Ranked button now produces **no payload** (assert `__chikunSharedPayload` stays undefined, or drop the wait); `:405-408` — Free: `title === "Chikun's Escape"`, `url` matches `^https://lestersarcade\.io/f/chikun/ac[0-9a-z]{38}$`, text matches `^🐔 FREE PLAY · Chikun's Escape` and `Beat my flight @LestersArcade$`, still no `/0x[a-f0-9]{40}|session-/i`, score present as `pts`. The STACKED smoke's parent-preview pins (`url === 'https://lestersarcade.io'`, row hidden for Ranked) stay valid.

## 12. Byte budget plan (record measured values in the commit body)

| Surface | Baseline (`9f20cda0` dist) | Cap | Expected | Proof |
|---|---|---|---|---|
| STACKED entry `stacked/game.js` | 27,775 B | 29,000 | ≈ 27,930 (+≈150) | `npm run build` gate + `stat` |
| STACKED initial (entry + vendor 496,615 + static chunks 50,412) | 574,802 B | 607,000 | ≈ 578,000 (+≈2.0 KB token, +≈0.7 KB share-links, +≈0.4 KB native helper) | `build.mjs` printout |
| Chikun entry `chikun/game.js` | 44,054 B | none (logged) | −130…+50 | `stat` |
| HMH child `hmh-reboot/game.js` + its static chunks | 360,980 B entry | 480,000 / 1,048,576 | **unchanged** | `grep -c` of the share-links/token chunk names in `dist/hmh-reboot/game.js` = 0; `node build.mjs --metafile` + `sumStaticChunkBytes` before/after identical |
| `share-file.mjs` | — | — | ≈ 0.6 KB own lazy chunk | not in any initial budget |
| `free-share-token.mjs` minified | — | test gate 2,400 B | ≈ 2.0 KB | `esbuild.transform` in the test |
| Function bundle `includeFiles` | 3 backgrounds + badges | — | + 4 portraits ≤ 320 KB | `--check` sizes |

## 13. Smoke plan (heavy lock per job; one browser process at a time; port 8931-8939, serve `apps/portal`, never `dist`)

Serve with a scratchpad `free-share-dev-server.mjs`: static `apps/portal` plus two routes mounted on the real handlers — `^/f/(hard-money-heroes|chikun|stacked)/([0-9a-z]{30,40})$` → `api/free-share-page.mjs`, `^/api/free-card/(…)/(…)\.png$` → `api/free-card.mjs`, both via `createHandler(() => buildDeps({ VERCEL_ENV: 'development' }, { db: null }))` (proves the no-Neon path end to end). `PLAYWRIGHT_PACKAGE_PATH=C:/Users/just_/lesters-arcade-wt/free-share/benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs`; Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` as the existing smokes do. Evidence to `.tmp/free-share/` (gitignored).

- **Job A — HMH**: ad-hoc Playwright script mirroring `enterGuestFreeRun` (`scripts/hmh-reboot-portal-e2e.mjs:366-381`, `?evidenceSafe=1&terminalPilot=1`, `allowTerminal`). At game over read `#combatGameOverSummary .game-over-share-row a[data-share="x"]`: intent keys `text,url,related`; text `^🧟 FREE PLAY · Hard Money Heroes` … `Can you beat it\? @LestersArcade$`, one mention, no `#`; url `^https://lestersarcade\.io/f/hard-money-heroes/ah[0-9a-z]{28}$`; decode the token and compare score/kills/hero with the summary. Open the local `/f/hard-money-heroes/<token>`: assert `og:image`, `twitter:card`, `twitter:site`, noindex; `<img class="shot">` answers 200 `image/png` 1200×630 with `FREE_CARD_CACHE`. Full-page screenshots at 1280×720 and 390×844 of panel, page and card. Phone file share: `newContext({ viewport: {390,844}, isMobile: true, hasTouch: true })` + `addInitScript` stubbing `navigator.canShare = () => true` and `navigator.share = async (d) => { window.__shared = { …, files: [...(d.files||[])].map(f => ({ name: f.name, type: f.type, size: f.size })) } }` → "More sharing" → "Share…" → `__shared.files[0].type === 'image/png' && size > 1000` (exercises the lazy chunk and the card route). Release the lock.
- **Job B — Chikun**: `CHIKUN_PORTAL_ORIGIN=http://127.0.0.1:8931 CHIKUN_MODE=free node scripts/chikun-ranked-browser-smoke.mjs` (after §11.3), then `CHIKUN_MODE=ranked` (row and button hidden, no payload). Release.
- **Job C — STACKED**: `STACKED_ORIGIN=http://127.0.0.1:8931 node scripts/stacked-playable-browser-smoke.mjs` (Ranked preview unchanged) plus the ad-hoc Free variant (hard-drop until `#restartButton`, read `#shareRow a[data-share="x"]`, decode `as…`, phone stub as in A). Release.
- **Job D — gates**: `npm run build` (record §12), `node build.mjs --metafile` + scratch `sumStaticChunkBytes` proving `hmh-reboot/game.js` reaches no chunk containing `free-share`/`LestersArcade`; then `npm run test:release` under the lock. Kill the 8931 server.

Inspect the card PNGs at full resolution (ribbon clear of title/score/hero heads, tiles inside the frame, portrait bottom-anchored, worst-case score `999,999,999,999` with portrait) before accepting; switch to the pill fallback if the rotation renders wrong.

## 14. Commit sequence (each ends `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; no push until Verify; then `git push --force-with-lease origin fable/free-share` only; never deploy)

1. `docs(share): plan of record for Free share token, page and card` (this file).
2. `test(share): RED coverage for Free share token, copy, card, page and routes` — the new test files and the deliberate pin updates (§11).
3. `feat(share): free-share token, lazy card file and Free copy templates` — `free-share-token.mjs`, `share-file.mjs`, `share-links.mjs` additions.
4. `feat(share): Free share rows link to /f/ with the card` — the three call sites, `presentation.mjs`, `syntax-check`, smoke pins; body records "STACKED entry 27,775 → N B (cap 29,000); STACKED initial 574,802 → N B (cap 607,000); Chikun entry 44,054 → N B (no cap); HMH initial unchanged".
5. `feat(share): Free share card and page functions` — `free-run.mjs`, `render-free-card.mjs`, `render-free-page.mjs`, `render-page.mjs` exports, `api/free-card.mjs`, `api/free-share-page.mjs`, portraits + build script, `vercel.json`.
6. `docs(share): record Free share budgets and smoke evidence` — §12/§13 numbers and evidence paths appended here.

## 15. Amendment of record (contract §7.4, §7.5, §4.3.9; guide §5.12)

- **§7.4 `share-links.mjs`.** `buildFreeShareText(gameId, { score, stats })` now returns the §5 family: `<freeIcon> FREE PLAY · <title>`, points + detail + Free detail, the Ranked stats line, an optional Free line, and `<call> @LestersArcade`. It no longer ends "Practising on @LestersArcade". Stats keys per game: HMH `heroName, level, kills, maxCombo, survivalSeconds, bossDefeated|bossKills`; Chikun `laps, regionName|regionReached, forksPassed, nearMisses, coinsCollected, survivalSeconds, bestCombo, dailyLabel`; STACKED `lines, level, quadClears, survivalSeconds, maxCombo, assisted`. `buildShareLinks({ text, url, card })` adds `card` (relative card path | null). `createShareRow` adds `nativeButton`, `loadShareFile`, `row.links`, `row.native.share()`. The children now call `buildFreeShareText` (the "children never call them" sentence is withdrawn for the Free template only; `buildRankedShareText` stays parent-only). `buildHmhShareText`/`buildStackedShareText` remain exported, unused. Invariants unchanged and extended: never `Verified`, never `RANKED` in Free text.
- **§7.4 addendum `free-share-token.mjs`.** The §3 grammar is the contract of record; version `a`; canonical by re-encode; no personal data (no wallet, handle, session id, seed or timestamp).
- **§4.3.9 E12 `GET /api/free-card/<slug>/<token>.png` → `/api/free-card?game=&token=`** and **E13 `GET /f/<slug>/<token>` → `/api/free-share-page?game=&token=`**: declared params `game`, `token` only; statuses, cache strings, bucket `free-card:ip:` 120/h (Neon only), robots and no-Neon behaviour as in §8; compiled route rows as in §9.
- **§7.5 Free card and page.** `render-free-card.mjs` `buildFreeCardElement({ run, background, heroPortrait })`: no handle, no badges, magenta frame, ribbon `FREE PLAY · SELF-REPORTED`, never green, never `LitVM`; hero portrait for HMH from `share-cards/heroes/<id>.png`. `render-free-page.mjs` `renderFreeSharePage({ run, status })`: tags of §7, `noindex`, no JS.
- **Guide §5.12.** The sentence "Free runs use a lighter template ending 'Practising on @LestersArcade'" and the rule "Free shares go to the site root" are superseded: Free shares post the §5 templates and link to `/f/<slug>/<token>`, whose OG card is E12.

## 16. Invariants, scope notes and follow-ups for the integration owner

Invariants (tested): Free Mode writes no parent persistence, leaderboard or Ranked state; page and card claim no verification and never show green/`LitVM`/`Verified`; no personal data in Free URLs; Ranked sharing untouched (parent results screen owns it; children hide their rows); children's byte caps hold; the HMH child bundle is unchanged.

Scope notes: (a) the Chikun `shareRunButton` handler is outside `renderShareRow` but is the cabinet's native share (J10, 6 lines); (b) `scripts/chikun-ranked-browser-smoke.mjs` pins move in the call-site commit; (c) other branches edit `apps/chikun/src/main.mjs` and `apps/stacked/src/main.mjs` elsewhere — the hunks above keep their anchors so they rebase cleanly.

Follow-ups (not this slice): a vercel.json `X-Robots-Tag` header rule for `/f/(.*)`; `/s/` should adopt the D2 canonical redirect for `fbclid`; `ranked-results-model.mjs` preview/practice Free shares still link to the site root and could build a token in the parent results screen; `robots.txt` is sitemap-only today; a future card redesign that must invalidate edge copies within a day bumps the token version.
