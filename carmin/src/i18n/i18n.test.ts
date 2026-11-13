import { describe, expect, it } from 'vitest';
import { CODES_ERREUR, erreur } from '../coeur/erreurs';
import { DICTIONNAIRES, texteErreur, traduire } from './index';

describe('textes', () => {
  it('a exactement les mêmes clés en français et en anglais, toutes remplies', () => {
    expect(Object.keys(DICTIONNAIRES.en).sort()).toEqual(Object.keys(DICTIONNAIRES.fr).sort());
    for (const langue of ['fr', 'en'] as const) {
      expect(Object.values(DICTIONNAIRES[langue]).every((texte) => texte.trim() !== '')).toBe(true);
    }
  });

  it('garde les mêmes repères {…} dans les deux langues', () => {
    const reperes = (texte: string) => [...texte.matchAll(/\{(\w+)\}/g)].map((r) => r[1]).sort();
    for (const cle of Object.keys(DICTIONNAIRES.fr) as Array<keyof typeof DICTIONNAIRES.fr>) {
      expect(reperes(DICTIONNAIRES.en[cle]), cle).toEqual(reperes(DICTIONNAIRES.fr[cle]));
    }
  });

  it('a une phrase pour chaque code d\'erreur du contrat', () => {
    for (const code of CODES_ERREUR) {
      expect(Object.keys(DICTIONNAIRES.fr), code).toContain(erreur(code).cle_i18n);
    }
  });

  it('remplace les repères et traduit le nom de la source', () => {
    expect(traduire('fr', 'temps.il_y_a_jours', { jours: 5 })).toBe('Il y a 5 jours');
    expect(texteErreur('fr', erreur('launcher_absent', { source: 'epic' }))).toBe("Epic Games n'est pas installé sur ce PC.");
    expect(texteErreur('en', erreur('launcher_absent', { source: 'steam' }))).toBe('Steam is not installed on this PC.');
  });

  it('n\'affiche jamais une clé brute', () => {
    expect(texteErreur('fr', { code: 'interne', cle_i18n: 'erreurs.inconnue_du_front', details: null })).toBe("Une erreur inattendue s'est produite.");
  });
});
