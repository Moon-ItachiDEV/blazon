import type { CSSProperties } from 'react';

/**
 * À étaler sur l'élément qui prend la couleur d'un jeu : `<div {...couleurDeJeu(jeu.couleur_dominante)}>`.
 * L'attribut `data-couleur-jeu` fait recalculer les teintes dérivées (voir jetons.css).
 */
export function couleurDeJeu(couleur: string | null): { 'data-couleur-jeu': ''; style: CSSProperties } {
  return { 'data-couleur-jeu': '', style: (couleur === null ? {} : { '--couleur-jeu': couleur }) as CSSProperties };
}
