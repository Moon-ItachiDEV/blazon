import { describe, expect, it } from 'vitest';
import type { Succes } from '../../contrat/types';
import { dernierDebloque, verdictDAvis } from './logique';

describe('verdictDAvis', () => {
  it('suit la règle de Steam', () => {
    expect(verdictDAvis(97, 237_473)).toBe('extremement_positives');
    expect(verdictDAvis(97, 200)).toBe('tres_positives');
    expect(verdictDAvis(85, 30)).toBe('positives');
    expect(verdictDAvis(75, 1000)).toBe('plutot_positives');
    expect(verdictDAvis(50, 1000)).toBe('moyennes');
    expect(verdictDAvis(30, 1000)).toBe('plutot_negatives');
    expect(verdictDAvis(10, 20)).toBe('negatives');
    expect(verdictDAvis(10, 100)).toBe('tres_negatives');
    expect(verdictDAvis(10, 1000)).toBe('extremement_negatives');
  });
  it("ne juge pas avec moins de 10 avis", () => {
    expect(verdictDAvis(100, 9)).toBeNull();
  });
});

describe('dernierDebloque', () => {
  const succes = (api_name: string, debloque: boolean | null, debloque_le: string | null): Succes => ({
    api_name,
    nom: api_name,
    description: null,
    secret: false,
    icone: '',
    icone_grise: '',
    pct_mondial: null,
    debloque,
    debloque_le,
  });
  it('prend la date la plus récente', () => {
    const liste = [succes('a', true, '2026-10-01T10:00:00Z'), succes('b', true, '2026-11-02T10:00:00Z'), succes('c', false, null)];
    expect(dernierDebloque(liste)?.api_name).toBe('b');
  });
  it('rend null sans succès débloqué', () => {
    expect(dernierDebloque([succes('c', false, null), succes('d', null, null)])).toBeNull();
  });
});
