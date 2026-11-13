/**
 * Logique de l'accueil du premier lancement : ordre des étapes, lecture du scan en direct,
 * annonces pour les lecteurs d'écran, récapitulatif. Des fonctions pures, sans React.
 */
import type { EtatCle, EtatScan, JeuResume, ResultatTestCle, Source } from '../../contrat/types';

export const ETAPES = ['bienvenue', 'analyse', 'cle', 'fin'] as const;
export type Etape = (typeof ETAPES)[number];

/** Numéro affiché, à partir de 1. */
export function numeroDEtape(etape: Etape): number {
  return ETAPES.indexOf(etape) + 1;
}

export function etapeSuivante(etape: Etape): Etape | null {
  return ETAPES[ETAPES.indexOf(etape) + 1] ?? null;
}

export function etapePrecedente(etape: Etape): Etape | null {
  const index = ETAPES.indexOf(etape);
  return index <= 0 ? null : (ETAPES[index - 1] ?? null);
}

// ───────────────────────────── Scan en direct ─────────────────────────────

/** Ce que l'on sait d'un scan à un instant : la même forme que la progression du magasin d'état. */
export interface Progression {
  source: Source | null;
  jeux_trouves: number;
}

export type PhaseDuScan = 'attente' | 'en_cours' | 'termine';

export interface LectureDuScan {
  phase: PhaseDuScan;
  jeux_trouves: number;
  /** Source analysée en ce moment, null si on ne la connaît pas encore. */
  source: Source | null;
}

/**
 * Réunit les trois sources d'information sur le scan :
 *  - `direct`, la progression des événements, présente seulement pendant le scan ;
 *  - `scan`, l'état relu au cœur, qui n'est à jour qu'après chaque `etat_modifie` ;
 *  - `dernierVu`, la dernière progression directe reçue.
 * Entre la fin du scan et la relecture de l'état, `direct` est déjà vide alors que `scan` dit
 * encore « en cours » avec un compte ancien : sans `dernierVu`, le compteur retomberait à zéro.
 */
export function lireLeScan(scan: EtatScan | null, direct: Progression | null, dernierVu: Progression | null): LectureDuScan {
  if (direct !== null) return { phase: 'en_cours', jeux_trouves: direct.jeux_trouves, source: direct.source };
  if (scan !== null && !scan.en_cours && scan.dernier !== null) return { phase: 'termine', jeux_trouves: scan.jeux_trouves, source: null };
  if (scan?.en_cours === true || dernierVu !== null) {
    return {
      phase: 'en_cours',
      jeux_trouves: Math.max(scan?.jeux_trouves ?? 0, dernierVu?.jeux_trouves ?? 0),
      source: dernierVu?.source ?? null,
    };
  }
  return { phase: 'attente', jeux_trouves: 0, source: null };
}

/** Les magasins parcourus par le scan, dans l'ordre où le cœur les visite. */
export const SOURCES_DU_SCAN = ['steam', 'epic', 'gog', 'ea'] as const satisfies readonly Source[];
export type SourceDuScan = (typeof SOURCES_DU_SCAN)[number];

export type StatutDeSource = 'a_venir' | 'en_cours' | 'fini' | 'absent';

/** Où en est chaque magasin. Steam absent du PC est dit comme tel, jamais « en cours ». */
export function statutsDesSources(lecture: LectureDuScan, steamInstalle: boolean): { source: SourceDuScan; statut: StatutDeSource }[] {
  const presentes = SOURCES_DU_SCAN.filter((s) => s !== 'steam' || steamInstalle);
  const index = SOURCES_DU_SCAN.findIndex((s) => s === lecture.source);
  // Source inconnue (pas encore d'événement) : c'est la première source présente qui commence.
  const courante: SourceDuScan | undefined = index >= 0 ? SOURCES_DU_SCAN[index] : presentes[0];
  const rangCourant = courante === undefined ? -1 : SOURCES_DU_SCAN.indexOf(courante);
  return SOURCES_DU_SCAN.map((source, rang) => {
    if (source === 'steam' && !steamInstalle) return { source, statut: 'absent' };
    if (lecture.phase === 'termine') return { source, statut: 'fini' };
    if (lecture.phase === 'attente') return { source, statut: 'a_venir' };
    if (rang < rangCourant) return { source, statut: 'fini' };
    return { source, statut: rang === rangCourant ? 'en_cours' : 'a_venir' };
  });
}

/**
 * Les dernières jaquettes arrivées, la plus récente en premier. Les jeux masqués n'y sont pas.
 * Un jeu qui a une vraie image passe avant un jeu dont la jaquette sera dessinée : la rangée sert à
 * montrer que la bibliothèque se remplit, et huit rectangles dessinés ne le montrent pas.
 */
export function dernieresJaquettes(jeux: readonly JeuResume[] | null, nombre: number): JeuResume[] {
  if (jeux === null || nombre <= 0) return [];
  const visibles = jeux.filter((jeu) => !jeu.masque).reverse();
  const avecImage = visibles.filter((jeu) => jeu.jaquette != null);
  const dessinees = visibles.filter((jeu) => jeu.jaquette == null);
  return [...avecImage, ...dessinees].slice(0, nombre);
}

// ───────────────────────────── Annonces ─────────────────────────────

/** Écart minimal entre deux annonces du compteur : assez pour ne pas couvrir le reste de la page. */
export const INTERVALLE_D_ANNONCE_MS = 6_000;

export interface Annonce {
  phase: PhaseDuScan;
  source: Source | null;
  instant_ms: number;
}

/**
 * Faut-il annoncer la progression maintenant ? Oui au début, à la fin et quand le magasin
 * analysé change ; sinon au plus une fois toutes les quelques secondes, pas à chaque jeu trouvé.
 */
export function fautIlAnnoncer(precedente: Annonce | null, lecture: LectureDuScan, maintenant_ms: number): boolean {
  if (lecture.phase === 'attente') return false;
  if (precedente === null || precedente.phase !== lecture.phase) return true;
  if (lecture.phase === 'termine') return false;
  if (lecture.source !== null && lecture.source !== precedente.source) return true;
  return maintenant_ms - precedente.instant_ms >= INTERVALLE_D_ANNONCE_MS;
}

// ───────────────────────────── Clé et récapitulatif ─────────────────────────────

export type CleAuRecapitulatif = { etat: 'valide'; pseudo: string | null } | { etat: 'non_verifiee' } | { etat: 'sans' };

/**
 * Ce que le récapitulatif dit de la clé. Le verdict reçu pendant l'accueil donne le pseudo.
 * Après un refus, c'est l'état du cœur qui fait foi : une clé refusée n'est pas conservée,
 * mais une clé acceptée plus tôt reste en place.
 */
export function cleAuRecapitulatif(verdict: ResultatTestCle | null, cle: EtatCle): CleAuRecapitulatif {
  const utile = verdict !== null && verdict.etat !== 'refusee' ? verdict : null;
  const etat = utile?.etat ?? cle;
  if (etat === 'valide') return { etat: 'valide', pseudo: utile?.pseudo ?? null };
  if (etat === 'non_verifiee') return { etat: 'non_verifiee' };
  return { etat: 'sans' };
}

export type ActionSuivante = 'commencer' | 'continuer' | 'plus_tard' | 'continuer_sans_cle' | 'ouvrir';

/**
 * Le bouton qui fait avancer, et s'il est le bouton principal de l'étape. À l'étape de la clé,
 * tant que le formulaire est affiché, le principal est le sien : « Plus tard » reste à côté,
 * de la même taille, mais en second.
 */
export function actionSuivante(
  etape: Etape,
  cle: CleAuRecapitulatif,
  verdict: ResultatTestCle | null,
  formulaireVisible: boolean,
): { action: ActionSuivante; principale: boolean } {
  switch (etape) {
    case 'bienvenue':
      return { action: 'commencer', principale: true };
    case 'analyse':
      return { action: 'continuer', principale: true };
    case 'cle':
      if (!formulaireVisible) return { action: 'continuer', principale: true };
      if (cle.etat !== 'sans') return { action: 'continuer', principale: false };
      return { action: verdict?.etat === 'refusee' ? 'continuer_sans_cle' : 'plus_tard', principale: false };
    case 'fin':
      return { action: 'ouvrir', principale: true };
  }
}
