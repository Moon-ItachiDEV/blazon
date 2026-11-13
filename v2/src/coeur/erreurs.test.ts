import { describe, expect, it } from 'vitest';
import { CODES_ERREUR, erreur, estTransitoire, vautUnNouvelEssai } from './erreurs';

describe('vautUnNouvelEssai', () => {
  it('propose de réessayer pour ce qui peut passer dans la minute', () => {
    const codes = CODES_ERREUR.filter((code) => vautUnNouvelEssai(erreur(code)));
    expect([...codes].sort()).toEqual(['hors_ligne', 'interne', 'mode_jeu', 'source_coupee']);
  });

  it('ne propose rien pour le quota du jour, qui reste pourtant une erreur transitoire', () => {
    expect(estTransitoire(erreur('quota_atteint'))).toBe(true);
    expect(vautUnNouvelEssai(erreur('quota_atteint'))).toBe(false);
  });

  it('ne propose rien quand le joueur doit agir lui-même', () => {
    for (const code of ['cle_absente', 'cle_refusee', 'profil_prive', 'amis_prives', 'source_desactivee'] as const) {
      expect(vautUnNouvelEssai(erreur(code))).toBe(false);
    }
  });
});
