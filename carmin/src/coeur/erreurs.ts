import type { CodeErreur, ErreurApp } from '../../contrat/types';

/**
 * Liste de tous les codes d'erreur du contrat, utilisable à l'exécution (tests, textes).
 * La ligne `_tousLesCodes` casse la compilation si un code du contrat manque ici.
 */
export const CODES_ERREUR = [
  'hors_ligne',
  'mode_jeu',
  'cle_absente',
  'cle_refusee',
  'profil_prive',
  'amis_prives',
  'jeu_sans_succes',
  'jeu_non_steam',
  'quota_atteint',
  'source_coupee',
  'source_desactivee',
  'introuvable',
  'deja_present',
  'launcher_absent',
  'lancement_echoue',
  'exe_introuvable',
  'chemin_invalide',
  'interne',
] as const satisfies readonly CodeErreur[];

type CodeOublie = Exclude<CodeErreur, (typeof CODES_ERREUR)[number]>;
const _tousLesCodes: CodeOublie extends never ? true : never = true;
void _tousLesCodes;

/** Fabrique la seule forme d'erreur du contrat. La clé de texte se déduit toujours du code. */
export function erreur(code: CodeErreur, details: ErreurApp['details'] = null): ErreurApp {
  return { code, cle_i18n: `erreurs.${code}`, details };
}

/** Pour les blocs `catch` : une action du cœur rejette avec une `ErreurApp`, pas avec une `Error`. */
export function estErreurApp(valeur: unknown): valeur is ErreurApp {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const candidat = valeur as Record<string, unknown>;
  return (
    typeof candidat.code === 'string' &&
    (CODES_ERREUR as readonly string[]).includes(candidat.code) &&
    typeof candidat.cle_i18n === 'string'
  );
}

/**
 * Erreurs qui peuvent disparaître toutes seules : l'écran propose « Réessayer ».
 * Les autres demandent une action du joueur (saisir une clé, réactiver une source) ou sont définitives.
 */
const TRANSITOIRES: ReadonlySet<CodeErreur> = new Set(['hors_ligne', 'mode_jeu', 'quota_atteint', 'source_coupee']);

export function estTransitoire(e: ErreurApp): boolean {
  return TRANSITOIRES.has(e.code);
}

/**
 * Vrai quand un bouton « Réessayer » a un sens tout de suite. Le quota du jour est transitoire, mais
 * il ne repart que le lendemain : réessayer dans la minute redonnerait la même réponse, donc pas de bouton.
 */
export function vautUnNouvelEssai(e: ErreurApp): boolean {
  return e.code === 'interne' || (TRANSITOIRES.has(e.code) && e.code !== 'quota_atteint');
}
