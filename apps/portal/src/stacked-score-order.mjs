export function compareStackedRows(a, b) {
  return b.score - a.score
    || (b.runStats?.linesCleared ?? 0) - (a.runStats?.linesCleared ?? 0)
    || (b.runStats?.survivalTicks ?? 0) - (a.runStats?.survivalTicks ?? 0)
    || (b.runStats?.quadClears ?? 0) - (a.runStats?.quadClears ?? 0)
    || String(a.recordedAt ?? '').localeCompare(String(b.recordedAt ?? ''));
}
