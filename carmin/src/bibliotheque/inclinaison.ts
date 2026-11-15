/** Inclinaison maximale d'une jaquette sous le pointeur, en degrés. Assez pour sentir le relief, pas pour gêner la lecture. */
export const INCLINAISON_MAX = 9;

export interface Inclinaison {
  /** Rotation autour de l'axe horizontal : positive quand le pointeur est en haut (le haut recule). */
  rx: number;
  /** Rotation autour de l'axe vertical : positive quand le pointeur est à droite (la droite recule). */
  ry: number;
  /** Place du reflet, en pourcentage de la carte. */
  gx: number;
  gy: number;
}

/**
 * La carte penche vers le pointeur, comme une carte tenue entre deux doigts.
 * `x` et `y` : position du pointeur dans la carte, de 0 (gauche, haut) à 1 (droite, bas).
 */
export function inclinaison(x: number, y: number, max = INCLINAISON_MAX): Inclinaison {
  const bx = Math.min(1, Math.max(0, x));
  const by = Math.min(1, Math.max(0, y));
  const arrondir = (valeur: number) => Math.round(valeur * 100) / 100;
  return { rx: arrondir((0.5 - by) * 2 * max), ry: arrondir((bx - 0.5) * 2 * max), gx: Math.round(bx * 100), gy: Math.round(by * 100) };
}
