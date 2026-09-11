import { describe, expect, it } from 'vitest';
import { formatBytes, formatTransfer } from './format';

describe('formatBytes', () => {
  it('renders MB with one decimal', () => {
    expect(formatBytes(3719168)).toBe('3.5 MB');
  });

  it('never emits Infinity/NaN/empty for bad input', () => {
    for (const v of [0, NaN, Infinity, -5, null as unknown as number, undefined as unknown as number]) {
      const out = formatBytes(v);
      expect(out).not.toMatch(/Infinity|NaN/);
      expect(out.length).toBeGreaterThan(0);
    }
  });
});

describe('formatTransfer', () => {
  it('shows transferred/total/percent when totals known', () => {
    expect(formatTransfer(10485760, 104857600, 10)).toBe('10.0 MB / 100.0 MB (10%)');
  });

  it('falls back to percent-only without totals', () => {
    expect(formatTransfer(0, 0, 0)).toBe('0%');
  });
});
