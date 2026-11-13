/** Logique pure de la fiche d'un jeu (V2), testée sans React. */
import type { Succes } from '../../contrat/types';

export type VerdictDAvis =
  | 'extremement_positives'
  | 'tres_positives'
  | 'positives'
  | 'plutot_positives'
  | 'moyennes'
  | 'plutot_negatives'
  | 'negatives'
  | 'tres_negatives'
  | 'extremement_negatives';

/**
 * Le verdict des évaluations, selon la règle publique de Steam (part d'avis positifs et nombre d'avis).
 * Moins de 10 avis : pas de verdict.
 */
export function verdictDAvis(pct_positifs: number, nombre: number): VerdictDAvis | null {
  if (nombre < 10) return null;
  if (pct_positifs >= 80) {
    if (pct_positifs >= 95 && nombre >= 500) return 'extremement_positives';
    return nombre >= 50 ? 'tres_positives' : 'positives';
  }
  if (pct_positifs >= 70) return 'plutot_positives';
  if (pct_positifs >= 40) return 'moyennes';
  if (pct_positifs >= 20) return 'plutot_negatives';
  if (nombre >= 500) return 'extremement_negatives';
  return nombre >= 50 ? 'tres_negatives' : 'negatives';
}

/** Le dernier succès débloqué (la date la plus récente), ou null. */
export function dernierDebloque(liste: readonly Succes[]): Succes | null {
  let dernier: Succes | null = null;
  for (const s of liste) {
    if (s.debloque !== true || s.debloque_le === null) continue;
    if (dernier === null || (dernier.debloque_le ?? '') < s.debloque_le) dernier = s;
  }
  return dernier;
}
