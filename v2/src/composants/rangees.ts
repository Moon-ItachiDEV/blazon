import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Combien d'éléments mettre par rangée pour que les rangées soient de longueurs voisines.
 *
 * Une grille ordinaire remplit chaque rangée et laisse le reste à la dernière : sept éléments sur six
 * colonnes donnent six puis un, et un grand vide. Ici on calcule d'abord le nombre de rangées
 * nécessaires, puis on répartit : sept éléments donnent quatre puis trois.
 * `minimum` : largeur en dessous de laquelle un élément ne doit pas descendre ; `ecart` : espace entre deux.
 */
export function parRangee(nombre: number, largeur: number, minimum: number, ecart: number): number {
  if (nombre <= 0) return 1;
  const rangees = Math.ceil(nombre / colonnesPossibles(largeur, minimum, ecart));
  return Math.ceil(nombre / rangees);
}

/** Le plus grand nombre de colonnes d'au moins `minimum` pixels qui tiennent dans la largeur. Jamais moins d'une. */
export function colonnesPossibles(largeur: number, minimum: number, ecart: number): number {
  return Math.max(1, Math.floor((largeur + ecart) / (minimum + ecart)));
}

/** La place d'un élément dans une bande répartie par `repartirEnRangees`. */
export interface Place {
  /** Largeur finale, en pixels. */
  largeur: number;
  /** Rang dans sa rangée, à partir de 0 : sert à faire entrer une rangée comme une vague. */
  colonne: number;
}

/** Remplit chaque rangée tant que les largeurs minimales tiennent. Renvoie les rangées, en indices. */
function remplir(minimums: readonly number[], largeur: number, ecart: number): number[][] {
  const rangees: number[][] = [];
  let occupe = 0;
  minimums.forEach((minimum, index) => {
    const derniere = rangees.at(-1);
    if (derniere === undefined || occupe + ecart + minimum > largeur) {
      rangees.push([index]);
      occupe = minimum;
    } else {
      derniere.push(index);
      occupe += ecart + minimum;
    }
  });
  return rangees;
}

/**
 * Répartit des éléments, dont chacun a sa largeur minimale, sur des rangées qui occupent toujours toute
 * la largeur, sans changer leur ordre.
 *   1. On compte les rangées nécessaires en remplissant chacune au maximum.
 *   2. On garde ce nombre de rangées mais on les équilibre : au lieu de six éléments puis un seul, quatre
 *      puis trois. Pour cela on cherche la plus petite largeur de coupe qui ne demande pas une rangée de plus.
 *   3. Chaque rangée partage la place qui lui reste entre ses éléments, au prorata de leur largeur minimale.
 * L'écran pose ensuite la largeur trouvée sur chaque élément : il sait donc, avant d'afficher, quelle forme lui donner.
 */
export function repartirEnRangees(minimums: readonly number[], largeur: number, ecart: number): Place[] {
  // Largeur pas encore mesurée : chacun garde son minimum, le premier affichage n'a pas lieu dans cet état.
  if (largeur <= 0) return minimums.map((minimum) => ({ largeur: minimum, colonne: 0 }));
  const voulues = remplir(minimums, largeur, ecart).length;
  // Les seules coupes utiles sont les largeurs d'une suite d'éléments voisins.
  const coupes = new Set<number>();
  minimums.forEach((_, debut) => {
    let somme = -ecart;
    for (let fin = debut; fin < minimums.length; fin += 1) {
      somme += ecart + (minimums[fin] ?? 0);
      if (somme <= largeur) coupes.add(somme);
    }
  });
  const coupe = [...coupes].sort((a, b) => a - b).find((candidate) => remplir(minimums, candidate, ecart).length <= voulues) ?? largeur;
  const places: Place[] = [];
  for (const rangee of remplir(minimums, coupe, ecart)) {
    const somme = rangee.reduce((total, index) => total + (minimums[index] ?? 0), 0);
    const libre = largeur - somme - ecart * (rangee.length - 1);
    rangee.forEach((index, colonne) => {
      const minimum = minimums[index] ?? 0;
      places[index] = { largeur: minimum + (libre * minimum) / somme, colonne };
    });
  }
  return places;
}

/**
 * La largeur d'un élément, tenue à jour quand la fenêtre change. 0 avant la première mesure, qui a lieu
 * avant le premier affichage : l'écran n'est jamais dessiné avec une mauvaise répartition.
 */
export function useLargeur<E extends HTMLElement>(): [RefObject<E | null>, number] {
  const element = useRef<E>(null);
  const [largeur, setLargeur] = useState(0);
  useLayoutEffect(() => {
    const cible = element.current;
    if (cible === null) return;
    setLargeur(cible.clientWidth);
    const observateur = new ResizeObserver(() => setLargeur(cible.clientWidth));
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, []);
  return [element, largeur];
}
