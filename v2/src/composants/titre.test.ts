import { describe, expect, it } from 'vitest';
import { gabaritDeTitre } from './titre';

describe('gabaritDeTitre', () => {
  it('garde la grande taille pour un titre court', () => {
    expect(gabaritDeTitre('Hades')).toBe('court');
    expect(gabaritDeTitre('Monster Hunter Wilds')).toBe('court');
  });

  it('réduit un titre long', () => {
    expect(gabaritDeTitre('Ashes of the Singularity II')).toBe('long');
  });

  it('réduit davantage un titre très long', () => {
    expect(gabaritDeTitre('Valiant Hearts: The Great War™ / Soldats Inconnus : Mémoires de la Grande Guerre™')).toBe('tres_long');
  });

  it('ne compte pas les espaces autour', () => {
    expect(gabaritDeTitre('   Hades   ')).toBe('court');
  });

  it('compte un caractère hors du plan de base pour un seul', () => {
    expect(gabaritDeTitre('𝔸'.repeat(22))).toBe('court');
  });
});
