/**
 * Logique de l'écran Paramètres, sans React : validation d'un dossier, libellés d'état
 * (clé, analyse, mise à jour), liste des jeux masqués. Les composants n'ont plus qu'à afficher.
 */
import type { Affichage, ErreurApp, EtatCle, EtatScan, JeuResume, MiseAJour, SourceEnLigne } from '../../contrat/types';
import type { ProgressionScan } from '../etat/application';
import type { CleDeTexte } from '../i18n';
import type { NomDIcone } from '../composants/Icone';

// ───────────────────────────── Dossiers à analyser ─────────────────────────────

/**
 * Remet un chemin collé dans une forme unique : sans espaces ni guillemets autour (« Copier en tant
 * que chemin » de l'Explorateur en ajoute), barres obliques à l'endroit, sans barre finale sauf à la
 * racine d'un lecteur (« D:\ »).
 */
export function normaliserDossier(saisie: string): string {
  let chemin = saisie.trim().replace(/^"(.*)"$/, '$1').trim().replace(/\//g, '\\').replace(/\\+$/, '');
  if (/^[A-Za-z]:$/.test(chemin)) chemin += '\\';
  // La lettre du lecteur en capitale : « d:\Jeux » et « D:\Jeux » sont le même dossier.
  return /^[a-z]:/.test(chemin) ? chemin.charAt(0).toUpperCase() + chemin.slice(1) : chemin;
}

/** Caractères que Windows refuse dans un nom de dossier (le « : » du lecteur est traité à part). */
const INTERDITS = /[<>:"|?*]/;

/** Vrai pour « D:\Jeux » ou un partage réseau « \\serveur\partage\Jeux ». */
export function estCheminWindows(chemin: string): boolean {
  const lecteur = /^[A-Za-z]:\\(.*)$/.exec(chemin);
  if (lecteur !== null) return !INTERDITS.test(lecteur[1] ?? '');
  const reseau = /^\\\\([^\\]+)\\([^\\]+)(\\.*)?$/.exec(chemin);
  if (reseau !== null) return !reseau.slice(1).some((morceau) => morceau !== undefined && INTERDITS.test(morceau));
  return false;
}

export type RaisonDeRefus = 'vide' | 'forme' | 'deja_present';

export type VerdictDeDossier = { ok: true; chemin: string } | { ok: false; raison: RaisonDeRefus };

/**
 * Le contrat n'a pas de sélecteur de dossier : le joueur colle un chemin. On vérifie ici ce qui
 * peut l'être sans le cœur. Windows ignore la casse : « d:\jeux » est déjà présent si « D:\Jeux » l'est.
 */
export function validerDossier(saisie: string, existants: readonly string[]): VerdictDeDossier {
  const chemin = normaliserDossier(saisie);
  if (chemin === '') return { ok: false, raison: 'vide' };
  if (!estCheminWindows(chemin)) return { ok: false, raison: 'forme' };
  const cle = chemin.toLowerCase();
  if (existants.some((dossier) => normaliserDossier(dossier).toLowerCase() === cle)) return { ok: false, raison: 'deja_present' };
  return { ok: true, chemin };
}

export const TEXTE_DE_REFUS: Record<RaisonDeRefus, CleDeTexte> = {
  vide: 'parametres.dossiers.erreur.vide',
  forme: 'parametres.dossiers.erreur.forme',
  deja_present: 'parametres.dossiers.erreur.deja_present',
};

// ───────────────────────────── Clé Steam ─────────────────────────────

export type Ton = 'ok' | 'alerte' | 'danger' | 'neutre';

export interface EtatDeCleAffiche {
  icone: NomDIcone;
  ton: Ton;
  titre: CleDeTexte;
  texte: CleDeTexte;
}

/**
 * Ce qu'on dit de la clé. Une clé valide hors ligne reste valide, mais rien n'est mis à jour ;
 * avec un profil privé, elle est valide mais ne donne rien : on ne dit pas « tout est à jour ».
 */
export function etatDeLaCle(cle: EtatCle, en_ligne: boolean, profilPrive = false): EtatDeCleAffiche {
  switch (cle) {
    case 'absente':
      return { icone: 'cle', ton: 'neutre', titre: 'parametres.cle.etat.absente', texte: 'parametres.cle.etat.absente.texte' };
    case 'valide':
      if (!en_ligne) return { icone: 'hors_ligne', ton: 'alerte', titre: 'parametres.cle.etat.valide', texte: 'parametres.cle.etat.valide.hors_ligne' };
      if (profilPrive) return { icone: 'coche', ton: 'ok', titre: 'parametres.cle.etat.valide', texte: 'parametres.cle.etat.valide.profil_prive' };
      return { icone: 'coche', ton: 'ok', titre: 'parametres.cle.etat.valide', texte: 'parametres.cle.etat.valide.texte' };
    case 'refusee':
      return { icone: 'alerte', ton: 'danger', titre: 'parametres.cle.etat.refusee', texte: 'parametres.cle.etat.refusee.texte' };
    case 'non_verifiee':
      return { icone: 'horloge', ton: 'alerte', titre: 'parametres.cle.etat.non_verifiee', texte: 'parametres.cle.etat.non_verifiee.texte' };
  }
}

/**
 * Faut-il expliquer à part pourquoi les jeux possédés manquent ? Pas quand la cause est déjà dite
 * ailleurs : par l'état de la clé (absente, refusée, non vérifiée) ou par le bandeau du haut
 * (hors ligne, partie en cours). Le profil privé a sa propre marche à suivre.
 */
export function explicationDesJeuxPossedes(erreur: ErreurApp | null): 'aucune' | 'profil_prive' | 'autre' {
  if (erreur === null) return 'aucune';
  switch (erreur.code) {
    case 'cle_absente':
    case 'cle_refusee':
    case 'hors_ligne':
    case 'mode_jeu':
      return 'aucune';
    case 'profil_prive':
    case 'amis_prives':
      return 'profil_prive';
    default:
      return 'autre';
  }
}

// ───────────────────────────── Analyse du PC ─────────────────────────────

export interface EtatDeLAnalyse {
  en_cours: boolean;
  jeux_trouves: number;
  dernier: string | null;
}

/**
 * L'état du cœur dit si une analyse tourne ; la progression en direct (événements du scan) donne
 * le compte le plus frais. Les deux peuvent arriver dans un ordre ou l'autre : l'un suffit.
 */
export function etatDeLAnalyse(scan: EtatScan, progression: ProgressionScan | null): EtatDeLAnalyse {
  return {
    en_cours: scan.en_cours || progression !== null,
    jeux_trouves: progression?.jeux_trouves ?? scan.jeux_trouves,
    dernier: scan.dernier,
  };
}

// ───────────────────────────── Affichage ─────────────────────────────

export const TAILLE_MIN = 120;
export const TAILLE_MAX = 260;
export const TAILLE_PAS = 10;

/** Ramène une taille de jaquette dans les bornes du curseur, sur un multiple du pas. */
export function bornerTaille(valeur: number): number {
  if (!Number.isFinite(valeur)) return TAILLE_MIN;
  const arrondie = Math.round((valeur - TAILLE_MIN) / TAILLE_PAS) * TAILLE_PAS + TAILLE_MIN;
  return Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, arrondie));
}

/** Même ordre que le menu de tri de la bibliothèque. */
export const TRIS: Affichage['tri'][] = ['dernier_lancement', 'temps_de_jeu', 'titre', 'ajoute_le', 'date_sortie'];

/** Les jeux masqués, dans l'ordre alphabétique de la bibliothèque. */
export function jeuxMasques(jeux: readonly JeuResume[]): JeuResume[] {
  return jeux.filter((jeu) => jeu.masque).sort((a, b) => a.titre_tri.localeCompare(b.titre_tri));
}

/**
 * Où mettre le focus quand une ligne disparaît : la ligne qui prend sa place, sinon la précédente,
 * sinon rien (-1) et l'appelant se rabat sur le titre de la liste.
 */
export function indiceApresRetrait(indiceRetire: number, nombreRestant: number): number {
  if (nombreRestant <= 0) return -1;
  return Math.min(indiceRetire, nombreRestant - 1);
}

// ───────────────────────────── Données en ligne ─────────────────────────────

/** Ordre d'affichage : de la plus visible (la fiche) à la plus accessoire. */
export const SOURCES_EN_LIGNE: SourceEnLigne[] = ['fiches_magasin', 'visuels_magasin', 'succes_publics', 'actualites', 'joueurs_en_ligne'];

// ───────────────────────────── Mise à jour ─────────────────────────────

/** Progression affichable : un entier entre 0 et 100. Inconnue au tout début du téléchargement : 0. */
export function progressionDeLaMiseAJour(maj: MiseAJour): number {
  const brute = maj.progression_pct ?? 0;
  return Math.min(100, Math.max(0, Math.round(brute)));
}
