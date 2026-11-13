/**
 * Le vrai cœur, quand l'application tourne dans l'exécutable Windows (Electron).
 * Il vit dans le processus principal (coeur/coeur.js de la coquille) ; ici on ne fait que passer
 * les commandes et recevoir les événements. La page ne voit jamais la clé API ni le disque.
 */
import type { Coeur, ErreurApp, Evenement } from '../../contrat/types';

type Resultat = { ok: true; valeur: unknown } | { ok: false; erreur: ErreurApp };

interface Pont {
  appeler(nom: string, args: unknown[]): Promise<Resultat>;
  ecouter(rappel: (evenement: Evenement) => void): () => void;
  cheminDuFichier(fichier: File): string;
}

export function pontElectron(): Pont | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { blazonCoeur?: Pont }).blazonCoeur ?? null;
}

/** Chemin complet d'un fichier déposé, quand l'exécutable le connaît. */
export function cheminDuFichier(fichier: File): string | null {
  return pontElectron()?.cheminDuFichier(fichier) || null;
}

export function creerCoeurElectron(pont: Pont): Coeur {
  return new Proxy({} as Coeur, {
    get(_cible, nom) {
      if (typeof nom !== 'string' || nom === 'then') return undefined;
      if (nom === 'ecouter') return (rappel: (evenement: Evenement) => void) => pont.ecouter(rappel);
      return async (...args: unknown[]) => {
        const r = await pont.appeler(nom, args);
        if (r.ok) return r.valeur;
        throw r.erreur;
      };
    },
  });
}
