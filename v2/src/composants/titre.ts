/** Place que prend un titre écrit en très grand sur une affiche : au-delà d'un seuil, on le compose plus petit. */
export type GabaritDeTitre = 'court' | 'long' | 'tres_long';

const SEUIL_LONG = 22;
const SEUIL_TRES_LONG = 44;

/**
 * « Hades » tient sur une ligne en très grand ; « Monster Hunter Stories 3: Twisted Reflection » en prendrait
 * quatre et pousserait le bouton Jouer hors de l'affiche. On compte les caractères, pas les mots : en capitales
 * resserrées, la largeur d'un titre suit de près son nombre de lettres.
 */
export function gabaritDeTitre(titre: string): GabaritDeTitre {
  const longueur = [...titre.trim()].length;
  if (longueur > SEUIL_TRES_LONG) return 'tres_long';
  if (longueur > SEUIL_LONG) return 'long';
  return 'court';
}
