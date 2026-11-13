/** Courbe d'un chiffre qui compte : départ vif, arrivée douce (cubique). `t` va de 0 à 1. */
export function adoucir(t: number): number {
  const borne = Math.min(1, Math.max(0, t));
  return 1 - (1 - borne) ** 3;
}

/**
 * Valeur affichée à l'instant `t` (de 0 à 1) entre `debut` et `fin`. Toujours un entier, et exactement
 * `fin` à la fin : un compteur qui s'arrêterait sur 149 pour 150 mentirait.
 */
export function valeurAuTemps(debut: number, fin: number, t: number): number {
  if (t >= 1) return fin;
  return Math.round(debut + (fin - debut) * adoucir(t));
}
