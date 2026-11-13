/**
 * Logique de l'ajout manuel d'un jeu (F-07) : nettoyage du chemin saisi, extension acceptée,
 * et l'enchaînement des états de l'écran. Des fonctions pures, sans React ni appel au cœur.
 */
import type { AnalyseChemin, ErreurApp } from '../../contrat/types';

export const EXTENSIONS = ['exe', 'lnk', 'url'] as const;

/**
 * Le chemin tel que le cœur l'attend. « Copier en tant que chemin d'accès » dans l'Explorateur
 * met le chemin entre guillemets ; un copier-coller ramène souvent des espaces ou un retour à la ligne.
 */
export function nettoyerChemin(saisie: string): string {
  let propre = saisie.trim();
  // Guillemets droits ou typographiques, éventuellement plusieurs fois (« "C:\…" » collé deux fois).
  while (propre.length >= 2 && /^["'“«]/.test(propre) && /["'”»]$/.test(propre)) {
    propre = propre.slice(1, -1).trim();
  }
  return propre;
}

/** Extension en minuscules, sans le point ; null s'il n'y en a pas. */
export function extensionDe(chemin: string): string | null {
  const nom = nomDuFichier(chemin);
  const point = nom.lastIndexOf('.');
  return point <= 0 || point === nom.length - 1 ? null : nom.slice(point + 1).toLowerCase();
}

export function extensionAcceptee(chemin: string): boolean {
  const extension = extensionDe(chemin);
  return extension !== null && (EXTENSIONS as readonly string[]).includes(extension);
}

/** Dernier morceau du chemin, que les séparateurs soient ceux de Windows ou non. */
export function nomDuFichier(chemin: string): string {
  return chemin.slice(Math.max(chemin.lastIndexOf('\\'), chemin.lastIndexOf('/')) + 1);
}

/** Le titre envoyé au cœur : celui du joueur, ou le titre proposé s'il a tout effacé. */
export function titreAEnvoyer(titre: string, analyse: AnalyseChemin): string {
  const propre = titre.trim();
  return propre === '' ? analyse.titre_propose : propre;
}

/** `deja_present` peut désigner le jeu existant dans ses détails : on en fait un lien vers sa fiche. */
export function jeuDejaPresent(erreur: ErreurApp | null): number | null {
  if (erreur?.code !== 'deja_present') return null;
  const id = erreur.details?.id_jeu;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
}

// ───────────────────────────── États de l'écran ─────────────────────────────

/** Un problème à afficher sous le champ : l'extension vue ici, ou une erreur du cœur. */
export type Probleme = { type: 'extension' } | { type: 'coeur'; erreur: ErreurApp };

export interface EtatAjout {
  /** Ce qui est dans le champ, tel quel. */
  saisie: string;
  phase: 'saisie' | 'analyse' | 'apercu' | 'ajout';
  /** Chemin nettoyé en cours d'analyse ou analysé ; null avant toute analyse. */
  chemin: string | null;
  analyse: AnalyseChemin | null;
  titre: string;
  probleme: Probleme | null;
}

export const ETAT_INITIAL: EtatAjout = { saisie: '', phase: 'saisie', chemin: null, analyse: null, titre: '', probleme: null };

export type ActionAjout =
  | { type: 'saisir'; saisie: string }
  /** Analyser ce qui est saisi (Entrée, bouton) ou ce qui vient d'être déposé. */
  | { type: 'analyser'; saisie: string }
  | { type: 'analyse_reussie'; chemin: string; analyse: AnalyseChemin }
  | { type: 'analyse_echouee'; chemin: string; erreur: ErreurApp }
  | { type: 'renommer'; titre: string }
  | { type: 'ajouter' }
  | { type: 'ajout_echoue'; erreur: ErreurApp }
  | { type: 'recommencer' };

export function evoluer(etat: EtatAjout, action: ActionAjout): EtatAjout {
  switch (action.type) {
    case 'saisir':
      // Changer le chemin rend l'aperçu faux : on l'efface plutôt que de montrer un autre jeu.
      if (etat.phase === 'ajout') return etat;
      return { ...ETAT_INITIAL, saisie: action.saisie };
    case 'analyser': {
      if (etat.phase === 'ajout') return etat;
      const chemin = nettoyerChemin(action.saisie);
      if (chemin === '') return { ...ETAT_INITIAL, saisie: action.saisie };
      if (!extensionAcceptee(chemin)) return { ...ETAT_INITIAL, saisie: action.saisie, probleme: { type: 'extension' } };
      // Le champ montre le chemin nettoyé : le joueur voit ce qui est réellement analysé.
      return { ...ETAT_INITIAL, saisie: chemin, phase: 'analyse', chemin };
    }
    case 'analyse_reussie':
      // Une réponse pour un chemin qui n'est plus celui du champ arrive trop tard : on l'ignore.
      if (etat.phase !== 'analyse' || etat.chemin !== action.chemin) return etat;
      return { ...etat, phase: 'apercu', analyse: action.analyse, titre: action.analyse.titre_propose, probleme: null };
    case 'analyse_echouee':
      if (etat.phase !== 'analyse' || etat.chemin !== action.chemin) return etat;
      return { ...etat, phase: 'saisie', analyse: null, probleme: { type: 'coeur', erreur: action.erreur } };
    case 'renommer':
      return etat.phase === 'apercu' ? { ...etat, titre: action.titre } : etat;
    case 'ajouter':
      if (etat.phase !== 'apercu' || etat.analyse === null || etat.analyse.doublon_de !== null) return etat;
      return { ...etat, phase: 'ajout', probleme: null };
    case 'ajout_echoue':
      return etat.phase === 'ajout' ? { ...etat, phase: 'apercu', probleme: { type: 'coeur', erreur: action.erreur } } : etat;
    case 'recommencer':
      return etat.phase === 'ajout' ? etat : ETAT_INITIAL;
  }
}

// ───────────────────────────── Aperçu de la jaquette ─────────────────────────────

/**
 * Le titre que l'aperçu montre avant toute analyse : le nom du fichier sans son extension
 * (« C:\Jeux\Celeste\Celeste.exe » donne « Celeste »). Vide tant que rien d'utile n'est saisi.
 */
export function titreProvisoire(saisie: string): string {
  const nom = nomDuFichier(nettoyerChemin(saisie));
  const point = nom.lastIndexOf('.');
  return (point > 0 ? nom.slice(0, point) : nom).trim();
}

/**
 * La couleur de la jaquette dessinée d'un jeu ajouté à la main, tirée de son titre : la même règle que
 * le faux cœur (un hachage FNV-1a, trois canaux entre 56 et 127), pour que l'aperçu annonce la couleur
 * que la bibliothèque montrera. Le cœur Rust devra reprendre cette règle. Un titre vide n'a pas de couleur.
 */
export function couleurDeLApercu(titre: string): string | null {
  const propre = titre.trim();
  if (propre === '') return null;
  let h = 2166136261;
  for (let i = 0; i < propre.length; i += 1) h = Math.imul(h ^ propre.charCodeAt(i), 16777619) >>> 0;
  const canal = (decalage: number) => (56 + ((h >>> decalage) % 72)).toString(16).padStart(2, '0');
  return `#${canal(0)}${canal(8)}${canal(16)}`;
}

/** L'étape de l'assistant où en est l'écran : 0 le fichier, 1 le titre, 2 l'ajout. */
export function etapeDe(phase: EtatAjout['phase']): 0 | 1 | 2 {
  if (phase === 'apercu') return 1;
  if (phase === 'ajout') return 2;
  return 0;
}
