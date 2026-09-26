import { readFileSync } from 'node:fs';

// Dataset assertions belong to the opt-in writer after the startup split.
// Rendering, call order and authority checks still inspect main.mjs itself.
export const runtimeTelemetrySource = readFileSync(new URL('../../apps/hmh-reboot/src/runtime-telemetry-writer.mjs', import.meta.url), 'utf8');

// The per-frame enemy body loop (poses, transforms, shadows, elite rings, hit
// reactions, health pips, attack tells) moved out of renderWorld into this lazy
// chunk in the render-alloc perf step; its pins read this source.
export const enemyRenderPassSource = readFileSync(new URL('../../apps/hmh-reboot/src/enemy-render-pass.mjs', import.meta.url), 'utf8');
