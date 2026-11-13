/** Les textes dans la langue choisie par le joueur, pour les composants. */
import { useMemo } from 'react';
import type { ErreurApp, Langue } from '../../contrat/types';
import { useLangue } from '../etat/application';
import { pluriel, texteErreur, traduire, type BasePluriel, type CleDeTexte, type Valeurs } from './index';

export interface Textes {
  langue: Langue;
  /** Texte simple : `t('coque.bibliotheque')`. */
  t: (cle: CleDeTexte, valeurs?: Valeurs) => string;
  /** Texte accordé en nombre : `tp('bibliotheque.jeux', 12)`. */
  tp: (base: BasePluriel, nombre: number, valeurs?: Valeurs) => string;
  /** Phrase d'une erreur du cœur. */
  te: (erreur: ErreurApp) => string;
}

export function useTexte(): Textes {
  const langue = useLangue();
  return useMemo(
    () => ({
      langue,
      t: (cle, valeurs) => traduire(langue, cle, valeurs),
      tp: (base, nombre, valeurs) => pluriel(langue, base, nombre, valeurs),
      te: (erreur) => texteErreur(langue, erreur),
    }),
    [langue],
  );
}
