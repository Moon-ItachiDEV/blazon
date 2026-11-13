/**
 * Un magasin : une valeur partagée entre les écrans, que React relit quand elle change.
 * Trente lignes suffisent, grâce à `useSyncExternalStore` (fourni par React) : pas besoin de
 * Redux ni de Zustand pour une application dont tout l'état vient d'un seul objet, le cœur.
 */
import { useSyncExternalStore } from 'react';

export interface Magasin<T> {
  lire(): T;
  ecrire(suivant: T | ((actuel: T) => T)): void;
  abonner(rappel: () => void): () => void;
}

export function creerMagasin<T>(initial: T): Magasin<T> {
  let valeur = initial;
  const abonnes = new Set<() => void>();
  return {
    lire: () => valeur,
    ecrire(suivant) {
      const nouvelle = typeof suivant === 'function' ? (suivant as (actuel: T) => T)(valeur) : suivant;
      if (Object.is(nouvelle, valeur)) return;
      valeur = nouvelle;
      for (const rappel of abonnes) rappel();
    },
    abonner(rappel) {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },
  };
}

/**
 * Lit une partie du magasin. Le composant n'est redessiné que si cette partie change.
 * `choisir` doit renvoyer une valeur déjà présente dans le magasin (ou un nombre, un texte) :
 * fabriquer un nouvel objet à chaque appel ferait redessiner le composant en boucle.
 */
export function useMagasin<T, S>(magasin: Magasin<T>, choisir: (etat: T) => S): S {
  return useSyncExternalStore(magasin.abonner, () => choisir(magasin.lire()));
}
