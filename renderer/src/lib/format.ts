/** Human-readable byte counts for progress displays (e.g. update downloads). */
export function formatBytes(bytes: number): string {
  if (!bytes || !isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** "12.4 / 125.8 MB (10%)" — falls back to percent-only when totals unknown. */
export function formatTransfer(transferred: number, total: number, percent: number): string {
  if (total > 0) return `${formatBytes(transferred)} / ${formatBytes(total)} (${percent}%)`;
  return `${percent}%`;
}
