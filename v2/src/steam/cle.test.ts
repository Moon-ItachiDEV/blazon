import { describe, expect, it } from 'vitest';
import { formeDeCleValide } from './FormulaireDeCle';

describe('forme d’une clé Steam', () => {
  it('accepte 32 caractères hexadécimaux, espaces autour compris', () => {
    expect(formeDeCleValide('0123456789ABCDEF0123456789abcdef')).toBe(true);
    expect(formeDeCleValide('  0123456789ABCDEF0123456789abcdef \n')).toBe(true);
  });

  it('refuse une clé trop courte, trop longue ou avec un autre caractère', () => {
    expect(formeDeCleValide('')).toBe(false);
    expect(formeDeCleValide('0123456789ABCDEF0123456789abcde')).toBe(false);
    expect(formeDeCleValide('0123456789ABCDEF0123456789abcdef0')).toBe(false);
    expect(formeDeCleValide('0123456789ABCDEF0123456789abcdeg')).toBe(false);
  });
});
