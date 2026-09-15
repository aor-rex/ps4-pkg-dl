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

/** "12.4 MB/s" — tolerates string/null/NaN from mixed backend payloads. */
export function formatSpeed(bps: number | string | null | undefined): string {
  const n = typeof bps === 'number' ? bps : Number(bps);
  if (!n || !isFinite(n)) return '';
  return `${(n / 1048576).toFixed(1)} MB/s`;
}

/** "45s" / "3 min" / "2h 5m" — tolerates string/null/NaN/Inf. */
export function formatEta(s: number | string | null | undefined): string {
  if (s == null || s === '') return '';
  const n = typeof s === 'number' ? s : Number(s);
  if (!isFinite(n)) return '';
  const r = Math.round(n);
  if (r < 60) return `${r}s`;
  const m = Math.floor(r / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
