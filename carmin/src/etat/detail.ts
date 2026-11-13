/** Partie locale de la fiche d'un jeu (image du haut, logo, sources, dernières sessions). */
import { useEffect, useState } from 'react';
import type { ErreurApp, JeuDetail } from '../../contrat/types';
import { coeur } from '../coeur';
import { erreur, estErreurApp } from '../coeur/erreurs';
import { useApplication } from './application';

interface Lu {
  id_jeu: number | null;
  detail: JeuDetail | null;
  erreur: ErreurApp | null;
}

const RIEN: Lu = { id_jeu: null, detail: null, erreur: null };

/**
 * Relit le détail quand le jeu change dans la bibliothèque (favori, fin de session, renommage).
 * `erreur` vaut `introuvable` si le jeu n'existe pas ou n'est plus visible.
 */
export function useDetail(id_jeu: number | null): { detail: JeuDetail | null; erreur: ErreurApp | null } {
  const resume = useApplication((a) => (id_jeu === null ? undefined : a.jeux?.find((jeu) => jeu.id === id_jeu)));
  const [lu, setLu] = useState<Lu>(RIEN);

  useEffect(() => {
    if (id_jeu === null) return;
    let actif = true;
    coeur
      .detail_jeu(id_jeu)
      .then((detail) => {
        if (actif) setLu({ id_jeu, detail, erreur: null });
      })
      .catch((cause: unknown) => {
        if (actif) setLu({ id_jeu, detail: null, erreur: estErreurApp(cause) ? cause : erreur('interne') });
      });
    return () => {
      actif = false;
    };
  }, [id_jeu, resume]);

  // Tant que la réponse affichée concerne un autre jeu, on ne montre rien plutôt qu'une image fausse.
  return lu.id_jeu === id_jeu ? lu : RIEN;
}
