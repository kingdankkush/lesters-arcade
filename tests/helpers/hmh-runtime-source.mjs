import { readFileSync } from 'node:fs';

// Dataset assertions belong to the opt-in writer after the startup split.
// Rendering, call order and authority checks still inspect main.mjs itself.
export const runtimeTelemetrySource = readFileSync(new URL('../../apps/hmh-reboot/src/runtime-telemetry-writer.mjs', import.meta.url), 'utf8');
