import { describe, expect, it } from 'vitest';
import { entryToGame, variantsToGame, applyMetadata } from './catalog';
import type { CatalogEntry } from './backend';

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: 'e1',
  titleId: 'CUSA00001',
  title: 'Test Game',
  region: 'USA',
  version: '01.00',
  size: '1.0 GB',
  sizeBytes: 1073741824,
  pkgUrl: 'https://x/test.pkg',
  downloadUrl: 'https://x/test.pkg',
  filename: 'test.pkg',
  cover: '',
  coverUrl: '',
  ...over,
});

describe('entryToGame', () => {
  it('maps fields and always provides render-safe arrays', () => {
    const g = entryToGame(entry());
    expect(g.slug).toBe('CUSA00001');
    expect(g.genres).toEqual([]);
    expect(g.gallery).toEqual([]);
    expect(g.videos).toEqual([]);
    expect(g.downloads).toHaveLength(1);
  });
});

describe('variantsToGame', () => {
  it('never throws on empty variants (blank-screen guard)', () => {
    const g = variantsToGame('CUSA00002', [], null);
    expect(g.slug).toBe('CUSA00002');
    expect(g.downloads).toEqual([]);
    expect(g.genres).toEqual([]);
  });

  it('merges variants into per-variant download groups', () => {
    const g = variantsToGame('CUSA00003', [entry(), entry({ region: 'EUR' })], null);
    expect(g.downloads).toHaveLength(2);
  });
});

describe('applyMetadata', () => {
  it('returns the game unchanged when meta is null', () => {
    const g = entryToGame(entry());
    expect(applyMetadata(g, null)).toBe(g);
  });
});
