// Evidence diagnostics are optional; normal play never requests this chunk.
export async function loadRuntimeTelemetry({debugGridEnabled=false,releaseTelemetryEnabled=false},load=()=>import('./runtime-telemetry-writer.mjs')){
  return debugGridEnabled||releaseTelemetryEnabled?(await load()).writeRuntimeTelemetry:null;
}
