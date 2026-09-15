import { describe, it, expect } from 'vitest';
import { genreIcon, timeOf } from './genres';
import {
  Folder01Icon,
  Sword01Icon,
  AdventureIcon,
  Shield01Icon,
  Target01Icon,
  PuzzleIcon,
  Car01Icon,
  Rocket01Icon,
  GameboyIcon,
  Music01Icon,
} from '@hugeicons/core-free-icons';

describe('genreIcon', () => {
  it('maps keywords case-insensitively', () => {
    expect(genreIcon('Action')).toBe(Sword01Icon);
    expect(genreIcon('ACTION-ADVENTURE')).toBe(Sword01Icon);
    expect(genreIcon('Adventure')).toBe(AdventureIcon);
    expect(genreIcon('RPG')).toBe(Shield01Icon);
    expect(genreIcon('Role-Playing')).toBe(Shield01Icon);
    expect(genreIcon('First-Person Shooter')).toBe(Target01Icon);
    expect(genreIcon('Puzzle')).toBe(PuzzleIcon);
    expect(genreIcon('Racing')).toBe(Car01Icon);
    expect(genreIcon('Driving Sim')).toBe(Car01Icon);
    expect(genreIcon('Simulation')).toBe(Rocket01Icon);
    expect(genreIcon('Arcade')).toBe(GameboyIcon);
    expect(genreIcon('Music')).toBe(Music01Icon);
  });

  it('falls back to Folder01Icon for unknown genres', () => {
    expect(genreIcon('')).toBe(Folder01Icon);
    expect(genreIcon('Something Obscure')).toBe(Folder01Icon);
  });
});

describe('timeOf', () => {
  it('parses dates to epoch ms', () => {
    expect(timeOf('2024-01-15')).toBe(new Date('2024-01-15').getTime());
  });

  it('returns 0 for garbage input', () => {
    expect(timeOf('')).toBe(0);
    expect(timeOf(null)).toBe(0);
    expect(timeOf(undefined)).toBe(0);
    expect(timeOf('not a date')).toBe(0);
  });
});
