import { describe, expect, it } from 'vitest';
import { adoucir, valeurAuTemps } from './compte';

describe('adoucir', () => {
  it('part de 0 et arrive à 1', () => {
    expect(adoucir(0)).toBe(0);
    expect(adoucir(1)).toBe(1);
  });

  it('avance vite au début', () => {
    expect(adoucir(0.5)).toBeGreaterThan(0.8);
  });

  it('reste entre 0 et 1 hors bornes', () => {
    expect(adoucir(-1)).toBe(0);
    expect(adoucir(3)).toBe(1);
  });
});

describe('valeurAuTemps', () => {
  it('donne un entier en chemin', () => {
    expect(Number.isInteger(valeurAuTemps(0, 1980, 0.37))).toBe(true);
  });

  it('finit exactement sur la valeur', () => {
    expect(valeurAuTemps(0, 150, 1)).toBe(150);
    expect(valeurAuTemps(0, 150, 1.4)).toBe(150);
  });

  it('sait aussi descendre', () => {
    expect(valeurAuTemps(100, 40, 0)).toBe(100);
    expect(valeurAuTemps(100, 40, 1)).toBe(40);
  });
});
