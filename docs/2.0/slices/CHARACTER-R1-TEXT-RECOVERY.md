# Native mission text after graphics restoration

2026-09-29. Separate presentation follow-up to character pilot commit `f000523e` and owned-state proof `fea9c9dd`.

## Observed failure

The stronger R1 proof restored original hero/enemy sprites after a real WebGL context loss, but the objective-guidance pill visibly lost its text. The prior authority receipt and full-resolution failed restoration screenshots remain unchanged. That proof passed actor fallback and resumed simulation; it did not pass complete UI recovery.

The owning text is the tracker in `world-design-life.mjs`. Its logical content is retained when the mission and distance stay unchanged. Installed Pixi 8.19's `getPo2TextureFromSource` assigns the temporary canvas directly to the texture source; the WebGL text system returns it to the pool after upload, and `CanvasPool.returnCanvasAndContext` explicitly clears its pixels. The text pipe does not register a context-change invalidation. Actual RED corroborates this source path: the retained 256×16 canvas has zero alpha pixels, while its uploaded text initially remains visible; restoration redraw loses the letters without changing logical text, style key or bounds.

## Prepared witness

`scripts/hmh-text-context-browser.mjs` builds a private local entry only. It reads the actual tracker content and screen bounds, captures the compositor image, performs real context loss/restoration and redraws presentation without stepping simulation. It requires at least 90% of the original ivory-pixel count and spatial mask overlap, and requires captured entry-owned state to remain byte-identical. Native sprite mode runs first, followed by the optional pilot, at desktop and phone-sized viewports. `--red` preserves a separate failed receipt/images. The mask includes any cursor within the text bounds; the original failure's residual cursor cannot pass the 90% count/shape threshold. This is a glyph recovery check, not a performance or physical-phone gate.

`tests/hmh-world-text-context.test.mjs` prepares three boundaries: reclaim local text GPU resources while retaining semantic content/layout, bound restoration/disposal listener ownership, and preserve headless fixture compatibility.

## RED, change and GREEN

All three new resource/lifecycle boundaries failed before implementation. Actual desktop native-mode RED lost its mask from **873 to 51** ivory pixels, with **5.84% overlap**. Logical content, style key, screen bounds and captured owned state were unchanged; GL error was zero and there were no page/console errors. The separate failure receipt and screenshots were frozen before changing runtime code.

The small fix uses public Pixi `Text.unload()` for the four local tracker/prompt/needs/boss-note views on `webglcontextrestored`. It releases their managed GPU views and marks them for regeneration from unchanged text/style on the next draw. It retains no backing canvases, changes no global pool/library internals, and does not touch simulation, RNG, input or evidence. `main.mjs` passes the real canvas and calls the owner's idempotent `dispose()` during portal disposal; disposal removes the single listener. No new dependency, paid tool or asset generation was used.

Focused GREEN passed **50/50, zero failures/skips**: the three recovery boundaries, seven mission-guidance cases and 40 existing character/authority cases. Five changed JS files parse. Actual real-context recovery passes all four cases:

| Case | Before / restored ivory pixels | Spatial overlap | Captured state |
|---|---:|---:|---|
| Desktop native sprites | 873 / 873 | 100% | identical |
| Desktop optional 3D pilot | 873 / 873 | 100% | identical |
| Mobile viewport native sprites | 474 / 474 | 100% | identical |
| Mobile viewport optional 3D pilot | 474 / 474 | 100% | identical |

Every case keeps the label's logical content and has GL error 0 and zero page/console errors. Original-resolution compositor images were inspected. The final build passes: entry 316,120 B + Pixi 470,858 B + static shared 258,843 B = **1,045,821 B**, with **2,755 B headroom** under 1,048,576 B. The fix adds 29 initial bytes; the entry-plus-vendor subtotal 786,978 B omits shared chunks and is not the authoritative cap result. The required `visual:reboot` gate passes **12/12 unchanged scenes**, including desktop/mobile enemy crops and reduced-motion evidence, without accepting baselines.

Machine receipts: `docs/2.0/receipts/actor-3d-r1-text-context-red.json` and `actor-3d-r1-text-context-green.json`. Original screenshots, injected source and compiled diagnostic files remain under `.tmp/hmh-actor-3d-pilot/text-context/red/` and `green/`. Exact diagnostic file hashes/vendor binding were verified after capture and marked explicitly. The final receipt binds the world-text source, original/injected main, diagnostic entry and unchanged regular shipped entry. This does not imply another browser run after adding those metadata fields.

The shared heavy marker was explicitly released to W0b after the tests/build/browser/visual batch. No server/job remains. This slice changes no versions or deployment.

## Scope and remaining checks

The proof covers the tracked guidance glyphs and resource/lifecycle ownership for the four local world texts. It does **not** certify every Pixi text, inaccessible imported closure state, longer/full Ranked runs, device performance or complete graphics/UI recovery. In the isolated paused renderer redraw, an original enemy sprite remains clipped at the screen origin; this harness does not recheck a normal resumed frame after restoration. The earlier R1 actor proof did inspect resumed frames at its prior source, but that is not a fresh final-source certification of this separate limitation.

The previous authority proof, its measured text failure and its original screenshots remain unchanged. Phone acceptance, crowds/bosses/streaming/soak, final character art/readability and the owner's visual sign-off remain open.

Reproduce under the shared heavy lock: `node --test tests/hmh-world-text-context.test.mjs tests/hmh-mission-guidance.test.mjs tests/hmh-actor-3d-authority-witness.test.mjs tests/hmh-actor-3d-controller.test.mjs tests/hmh-actor-3d-model.test.mjs tests/hmh-actor-3d-projection.test.mjs`, `node build.mjs --metafile`, `node scripts/hmh-text-context-browser.mjs`, and `npm run visual:reboot`. The new tests/harness do not depend on Git.
