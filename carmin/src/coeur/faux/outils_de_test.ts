import type { Evenement } from '../../../contrat/types';
import { creerFauxCoeur, MAINTENANT_FACTICE, type FauxCoeur, type OptionsFauxCoeur } from './faux_coeur';

/** Un faux cœur sans aucun délai et à l'horloge figée, pour des tests rapides et reproductibles. */
export function coeurDeTest(options: Partial<OptionsFauxCoeur> = {}): FauxCoeur {
  return creerFauxCoeur({
    latence_ms: 0,
    reseau_ms: 0,
    session_ms: 0,
    scan_ms: 0,
    maintenant: () => new Date(MAINTENANT_FACTICE),
    ...options,
  });
}

type EvenementDeType<T extends Evenement['type']> = Extract<Evenement, { type: T }>;

/** Attend le prochain événement du type donné (et qui passe le filtre, s'il y en a un). */
export function attendre<T extends Evenement['type']>(
  coeur: FauxCoeur,
  type: T,
  filtre: (evenement: EvenementDeType<T>) => boolean = () => true,
): Promise<EvenementDeType<T>> {
  return new Promise((resoudre) => {
    const arreter = coeur.ecouter((evenement) => {
      if (evenement.type !== type) return;
      const attendu = evenement as EvenementDeType<T>;
      if (!filtre(attendu)) return;
      arreter();
      resoudre(attendu);
    });
  });
}

/** Capture la valeur avec laquelle une promesse rejette, ou échoue si elle réussit. */
export async function rejet(promesse: Promise<unknown>): Promise<unknown> {
  try {
    await promesse;
  } catch (raison) {
    return raison;
  }
  throw new Error('La promesse aurait dû rejeter.');
}
