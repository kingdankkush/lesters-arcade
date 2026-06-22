# Lester's Arcade — Platform Audit Backlog (ingested 2026-06-20)

Source: `Lesters_Arcade_Platform_Audit_and_Architecture.pdf` (author pass: Claude Opus 4.8).
Scope: live-site + game audit focused on UI, mobile/controls/fullscreen, parent-app + child-game
architecture, third-party onboarding, and privacy/perf polish.

This file merges the audit's prioritized backlog (P0/P1/P2) into our tracked work and records the
**honest current status** of each item against the actual repo, since the auditor could not read
private source and marked code-level claims `VERIFY`.

> Verification note: All 284 unit tests pass as of ingestion (`npm test`). The player-facing runtime
> flow (splash → arcade floor → mode select → character select → **Level 1: The Crypto Wasteland**,
> isometric WASD + mouse auto-fire) is already on the accepted isometric-roguelite canon. The
> side-scroller drift the audit caught is confined to **non-player-facing served markup** (news ticker,
> the `hidden` developer-backstage codex, art captions) plus **legacy data structures** in
> `arcade-core.mjs` that are intentionally retained as historical model + are load-bearing for tests.

---

## Status legend

- ✅ DONE — shipped / verified in repo
- 🟡 PARTIAL — foundation exists, gaps remain
- ⬜ TODO — not started
- 🔒 GATED — needs Justin approval / external verification (funds, deploy, branding, legal)

---

## P0 — must do first

| Status | Task | Audit acceptance | Repo reality / notes |
|---|---|---|---|
| 🟡 PARTIAL | **Reconcile public-site canon** (iso roguelite + Crypto Wasteland) | No side-scroll language/art remains; copy matches current design | Player flow already says "Level 1: The Crypto Wasteland", isometric, auto-fire. News ticker now says "ISOMETRIC ROGUELITE SURVIVAL" + "TWIN-STICK AUTO-AIM" (no more PARALLAX SIDE SCROLLING). Art captions say "Crypto Wasteland isometric environment draft". Remaining: legacy art JPGs still need an isometric Crypto Wasteland re-shoot (asset task, not code). |
| 🟡 PARTIAL | **App shell + routed views; guest-first** | Arcade/Game/Profile/Leaderboards routes; guest plays Free pre-connect; persisted IDs intact | URL routing layer (P1/P2/P3 in `remaining-work-plan-routing.md`) is ✅ DONE: `/`, `/games`, `/games/hard-money-heroes`, `/games/hard-money-heroes/game-session-NNNNNNNNN`, deterministic session IDs, per-session stat record + global rollup, all deployed & live-verified 0 JS errors. **Gap vs audit:** it is still one document with an `officialAppStep` state machine, not separate `/profile` + `/leaderboards` top-level routed views with persistent nav. Guest-first browse-before-connect is NOT yet implemented (splash gates on connect). |
| 🟡 PARTIAL | **Mobile controls + aspect + menu/fullscreen** | Right stick gone; 9:16 & 16:9 full-bleed; top-right menu pauses + windowed/fullscreen; safe areas; no tap-through | Auto-aim/auto-fire model already live (no aim stick in the iso build — desktop mouse-aim, mobile drag-to-move + heading fire). `viewport-fit=cover`, `user-scalable=no`, `maximum-scale=1` confirmed present. Fullscreen button exists (`combatViewportButton`). **Gaps:** verify single pause-gate freezes timer+input+audio+sim together; verify modals capture input (no tap-through); confirm top-right safe-area menu icon (current controls are a bottom control bar, not the spec'd top-right menu overlay); confirm 9:16 + 16:9 full-bleed re-layout on `orientationchange`/`fullscreenchange`. Needs the §3 playtest pass on real iOS + Android. |
| 🟡 PARTIAL | **Game SDK contract v1 + sandbox + HMH dogfoods it** | HMH runs as a sandboxed cabinet via the SDK; parent mediates all wallet ops; contract tests green | **SDK contract v1 DONE** (`arcade-sdk.mjs`, 16 tests). **SDK wired to live gameplay DONE** (`game-adapter.mjs` + `main.js`): gameAdapter emits arcade.ready/sessionStart/statUpdate/pause/resume/gameOver from actual HMH gameplay. **Onboarding docs DONE** (`docs/THIRD_PARTY_GAME_ONBOARDING.md`). **Chikun manifest DONE** (`games/chikun/game.manifest.json`). **Remaining:** move HMH into sandboxed iframe cabinet (`allow-scripts`, no wallet/provider, CSP-pinned). The contract + adapter + validators are ready for that integration. |

## P1 — high value, after P0

| Status | Task | Audit acceptance | Repo reality / notes |
|---|---|---|---|
| 🟡 PARTIAL | **Profile/Leaderboards hardening** | Name uniqueness/validation; avatar sanitize; cadence boards; practice/official separation; address normalization | Practice vs official separation ✅. Cadence boards ✅. Display-name uniqueness + profanity + length validation ✅ (`validateUsername`/`isUsernameAvailable`, case-insensitive). **Address normalization ✅** — confirmed `normalizeWallet`/`connectPlayerAccount`/`ensureProfile` key all profiles by lowercased address, and `connectWallet` lowercases on connect, so mixed-case can't fork a profile. **Avatar sanitize ✅** — uploads now run through a canvas re-encode (`sanitizeAvatarImage` + `validateAvatarFile`/`computeAvatarResize`/`AVATAR_RULES`): type+size policy enforced pre-read, downscaled to a 256px box, re-emitted as JPEG (strips EXIF/GPS + caps stored bytes), rejects non-images. Remaining: server-side validation is N/A until real backend. |
| ✅ DONE | **Game registry + manifest + coming-soon cards** | Add-a-game = register a manifest; locked games render as roadmap | `game-manifest.mjs` (pure, 16 tests) is the single source of truth: `validateGameManifest` (id/semver/SDK-major/aspect/control/capability/ranked rules), `manifestChecksum` (FNV-1a for drift + future on-chain anchor), `createGameRegistry` (rejects invalid/duplicate, never silently registers). `registry.cabinets()` emits coming-soon as `locked` roadmap cards + hides `disabled`. Real `games/hard-money-heroes/game.manifest.json` dogfoods the schema. **Next:** wire the runtime cabinet grid to read from the registry instead of the static `LESTERS_ARCADE_V2_APP_SHELL.cabinets` list (cosmetic migration; both express the same data). |
| 🟡 PARTIAL | **Perf pass** (lazy media, WebP/AVIF, code-split, SW caching) | Mobile load + Lighthouse targets met; game bundle loads only on cabinet open | Images already `loading="lazy" decoding="async"`; critical CSS inlined; stylesheets preloaded. **SW + PWA DONE:** `manifest.webmanifest` (installable, standalone, theme/bg colors, icon) linked from `index.html`; `sw.js` registered with a deploy-safe strategy — network-first for HTML/JS/CSS (a new deploy always wins, no stale-cache trap) + cache-first only for images/fonts/audio/video (the repeat-visit speedup), versioned cache dropped on activate, same-origin GET only (wallet RPC/CDNs pass through). **Gaps remaining:** large generated JPGs not yet WebP/AVIF; splash video loads inline (not deferred); no per-route code-split of the game bundle. |
| 🔒 GATED | **Brand tokens + privacy polish** (role email, neutral credit) | Shared design tokens; no personal contact exposed publicly | Brand system exists; codify as shared CSS variables/tokens for shell + HMH HUD. **Privacy:** audit flags personal Gmail + "KingDankKush" in ad blocks + footer. NOTE: `kingdankkush420@gmail.com` is the **intentional** Lester's Arcade ad-banner contact per Justin; switching to a role address (e.g. `ads@lestersarcade.io`) + neutral studio credit is a Justin decision (see open questions), not an auto-change. |

## P2 — platform expansion

| Status | Task | Audit acceptance | Repo reality / notes |
|---|---|---|---|
| ⬜ TODO | **Third-party onboarding: public docs + reference adapter + test harness** | External dev can validate against a mock parent | **Onboarding docs DONE** (`docs/THIRD_PARTY_GAME_ONBOARDING.md`): comprehensive SDK guide covering event schema, manifest, security rules, step-by-step onboarding, Chikun reference. **Reference adapter DONE** (`game-adapter.mjs`). **Remaining:** test harness for external devs to validate against a mock parent. |
| ⬜ TODO | **Third-party integration pipeline + security review gate** | §5.2 workflow operational; sandbox + wallet-isolation verified per game | Static-scan gate (no wallet-touching code, no eval/remote code, no undeclared endpoints, no drainer patterns) + sandbox test. Non-negotiable before any external game. |
| 🔒 GATED | **On-chain GameRegistry + economy settings** | testnet only; approvals/legal | `SETTLEMENT_LIVE=false`. Real-funds/deploy gated to Justin + legal sign-off. |

---

## §2 detailed audit findings → tracked items

### 2.1 Canon & content drift (this pass addresses served copy)
- Replace side-scroll verbs ("PARALLAX SIDE SCROLLING", "run-and-gun", "Jump / Double Jump") with
  isometric roguelite + twin-stick/auto-aim framing. **Done in served public copy this pass.**
- "Underchain District Level 1" / Slums imagery → Crypto Wasteland (Level 1), city on horizon as
  Level 2. Copy done; **art re-shoot is an open asset task.**
- Move design-doc/codex content (Difficulty Curve, Boss Rotation, Game Design Codex) out of the
  served document into internal docs. Currently gated behind the `hidden` dev-backstage toggle but
  still ships in HTML — **follow-up: strip from production build or move to `/docs`.**
- Replace "Complete Prototype Run + Sync Parent System" button + sandbox copy with the real
  run → result → submit flow (lives in dev-backstage; tied to backstage cleanup).

### 2.3 Mobile/controls/aspect/fullscreen (CORE ASK — see P0 table)
- Right thumbstick already dropped in iso build. Confirm action cluster (dash/throwable) ergonomics.
- 9:16 + 16:9 full-bleed via `100dvw/100dvh`, re-layout on `orientationchange`/`resize`.
- Top-right safe-area menu icon → pause overlay: Resume · Settings · Windowed⇄Fullscreen · Restart ·
  Exit to Arcade. Single pause gate (timer+input+audio+sim). Touch targets ≥44px; controls hide under
  open modals (no tap-through).

### 2.4 Wallet/profile/session (parent-owned)
- Parent owns durable account: normalized address (key), unique display name, sanitized avatar,
  stats, achievements, receipts. Games request profile, never store wallet identity.
- Chain guard at run-start AND submit; ranked submit explicit + idempotent + verifier-signed; mock
  wallet can never reach official boards (already accepted in v2.1).

### 2.8 Accessibility
- Surface reduce-motion / reduce-shake / reduce-flash; colorblind-safe enemy/elite tagging (icon +
  shape, not color alone); auto-aim/auto-fire toggle (default on mobile, off desktop). Gore toggle
  locked pre-run; settings discoverable from pause menu + game-detail.
- Current build has Shake/Gore toggles in the gameplay control bar — extend into a full accessibility
  panel reachable from the pause menu. **DONE:** pause-menu Settings now renders an Accessibility grid
  (Reduce Motion, Screen Shake, Reduce Flash, Color Tags, Auto Aim) via
  `buildCombatAccessibilitySettingsModel`; toggles persist to `hmh-settings`, drive `documentElement`
  data-attrs, gate screen-shake/muzzle-flash intensity, and surface colorblind tone tags on stat chips
  + upgrade cards. Auto-aim assist is now player-toggleable (default on).

---

## §3 Playtest & bug-test protocol (run on desktop + 1 iOS + 1 Android, screenshot each step)
Onboarding · Routing/flow · Mobile layout · Controls · Menu/fullscreen · Free vs Ranked ·
Profile/Leaderboards · Perf · Audio. (Full step list in the audit PDF §3.) Track as a recurring QA
checklist; each platform slice ships with a §3 pass.

### §3 pass — 2026-06-20 (desktop browser + code-level mobile verification)
- **Desktop full flow ✅** — splash → guest "Enter Arcade" → cabinet-select → mode-select →
  character-select → Level 1 intro → live combat verified end-to-end in a real browser. Combat loop
  confirmed live (canvas pixel-checksum changes frame-to-frame; SURVIVE timer, Score, Kills all
  advance; auto-aim/auto-fire kills enemies with no manual input). Zero JS console errors at every
  step.
- **Pause + accessibility ✅** — Esc pauses (single gate freezes sim/timer); pause menu Settings
  renders the Accessibility grid; toggling Color Tags flips `data-colorblind-tags=true` live and
  injects 11 tone tags onto stat chips (e.g. HP→TONE RED). Reduce Motion/Flash/Shake/Auto-Aim present.
- **Free vs Ranked gating ✅** — Free is guest-open; Ranked card shows "WALLET REQUIRED" and
  `startOfficialMode('ranked')` forces `connectWallet()` then a ranked-entry + chain-guard approval
  before play. Guests cannot reach ranked.
- **Mobile (portrait 9:16 + landscape 16:9) ✅ via code** — browser viewport emulation was
  unavailable this pass, so verified through `device-model.mjs` unit tests (mobile/tablet/desktop
  classify + orientation + joystick mapping), responsive CSS audit (viewport-fit=cover,
  user-scalable=no, 44px tap targets, top-right safe-area `#combatMenuIconButton`, portrait canvas
  capped at `min(62vh,520px)`, fullscreen `object-fit:contain`), and the `resize`/`orientationchange`/
  `fullscreenchange` relayout handlers (debounced `applyDeviceProfile` + `scheduleCombatViewportRelayout`).
- **Bugs found & fixed this pass:**
  1. **Overlapping mobile action buttons** — touch cluster builds `.touch-grenade` + `.touch-powerup`,
     but CSS only positioned `.touch-powerup` (top:84px) and a dead `.touch-melee` rule; `.touch-grenade`
     had no offset so both buttons stacked at the same spot. Fixed: `.touch-grenade { top:0 }`, removed
     dead melee rule.
  2. **Canon drift on the live cabinet card** — HMH cabinet description still read "tactical
     run-and-gun score survival"; updated to "isometric roguelite score survival".
  3. **AGENTS.md local-serve instruction was wrong** — `<base href="/">` means you must serve
     `apps/portal` AS the web root, not the repo root + `/apps/portal/` (which 404s every asset with no
     console error). Corrected the doc so future agents don't lose time on a phantom "app is dead" bug.
- Remaining: a real on-device iOS + Android touch playtest still owed (synthetic + code verification
  only here). Minor UX note: the pause Settings panel does a full `replaceChildren` re-render per
  toggle (focus/ref churn) — functional, low priority.

## §4 Target architecture (keystone)
- 4.1 Shell owns identity + rails; games never touch wallet or write official state directly.
- 4.2 Game SDK contract: `init(ctx)` (no keys/signing) · `start/pause/resume/end/teardown/resize`;
  game→parent events `arcade.ready/sessionStart/statUpdate/achievement/scoreSubmit/gameOver/requestWalletAction`.
  Game emits intent; parent verifies (re-sim/anti-cheat), enforces free/ranked boundary, chain-guards,
  signs, records.
- 4.3 Sandboxed iframe (separate origin), `allow-scripts`, no wallet/provider access; strict origin
  checks + schema validation + rate limiting on postMessage; CSP pins endpoints; least privilege.
- 4.4 `game.manifest.json` per cabinet (id, version, sdkVersion, aspectSupport, controlScheme,
  capabilities, rankedEligible, endpoints, checksum). On-chain GameRegistry records cabinets +
  manifest hash.

## §5 Third-party onboarding
- 5.1 Public dev docs: implement SDK, ship manifest (must support 9:16 + 16:9), meet platform
  requirements, safety/licensing, reference adapter + test harness.
- 5.2 Internal workflow: Intake → **mandatory security review** → contract compliance → sandbox test →
  ranked bar (optional) → adapter shim if needed → register & QA (§3) → publish & monitor (re-review
  on version bump).

---

## Sequencing (audit §6, "How to instruct Hermes")
1. Reconcile canon on the public site first (cheap, high-trust). ← **started this pass**
2. App shell + routing (Arcade/Game/Profile/Leaderboards), guest-first, parent-owned identity,
   without breaking persisted IDs.
3. Game SDK contract + manifest + sandbox; migrate HMH to be the first cabinet that consumes its own
   SDK (dogfood). Land contract tests.
4. Mobile rework — right stick gone, 9:16/16:9 full-bleed, top-right menu + windowed/fullscreen, safe
   areas, pause gate.
5. Game registry + coming-soon entries; then third-party onboarding pipeline (docs + §5.2) with the
   security gate.
6. Every slice ships with tests + a §3 playtest pass. Keep all real-funds / deploy / branding actions
   gated to Justin; treat third-party code as untrusted by default.
