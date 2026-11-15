/**
 * État partagé par tous les écrans : ce que dit le cœur (état, paramètres, jeux) et le peu
 * que l'interface ajoute elle-même (lancement en cours, messages éphémères).
 *
 * Les écrans ne parlent jamais au cœur pour ces données : ils lisent ce magasin, tenu à jour
 * ici par les événements du cœur. Une seule lecture de 2 000 jeux au démarrage, puis seulement
 * les jeux modifiés.
 */
import type { Affichage, Coeur, Domaine, ErreurApp, EtatApp, Evenement, JeuResume, Langue, Parametres, Source } from '../../contrat/types';
import { erreur, estErreurApp } from '../coeur/erreurs';
import { creerMagasin, useMagasin } from './magasin';

export interface Avis {
  id: number;
  /** Erreur du cœur à traduire, ou clé de texte déjà choisie par l'écran. */
  erreur: ErreurApp;
}

export interface ProgressionScan {
  source: Source | null;
  jeux_trouves: number;
}

export interface EtatApplication {
  /** Faux tant que le premier échange avec le cœur n'est pas terminé. */
  pret: boolean;
  /** Le cœur n'a pas répondu au démarrage : l'application ne peut rien afficher d'autre. */
  panne: ErreurApp | null;
  etat: EtatApp | null;
  parametres: Parametres | null;
  /** null = pas encore lu. */
  jeux: JeuResume[] | null;
  /** Nom de chaque tag dans la langue courante. */
  tags: ReadonlyMap<number, string>;
  /** Progression en direct pendant un scan, null en dehors. */
  scan: ProgressionScan | null;
  /** Jeu dont le lancement a été demandé et dont on attend le démarrage. */
  lancement: number | null;
  avis: Avis[];
}

const INITIAL: EtatApplication = {
  pret: false,
  panne: null,
  etat: null,
  parametres: null,
  jeux: null,
  tags: new Map(),
  scan: null,
  lancement: null,
  avis: [],
};

export const application = creerMagasin<EtatApplication>(INITIAL);

export function useApplication<S>(choisir: (etat: EtatApplication) => S): S {
  return useMagasin(application, choisir);
}

export function useLangue(): Langue {
  return useApplication((a) => a.parametres?.langue ?? 'fr');
}

// ───────────────────────────── Rafraîchissements ─────────────────────────────

type Ecouteur = (id_jeu: number | null) => void;
const ecouteurs = new Map<Domaine, Set<Ecouteur>>();

/** Prévenu chaque fois que le cœur annonce de nouvelles données pour ce domaine. */
export function ecouterLesRafraichissements(domaine: Domaine, rappel: Ecouteur): () => void {
  const groupe = ecouteurs.get(domaine) ?? new Set<Ecouteur>();
  ecouteurs.set(domaine, groupe);
  groupe.add(rappel);
  return () => groupe.delete(rappel);
}

// ───────────────────────────── Démarrage et événements ─────────────────────────────

let coeurActif: Coeur | null = null;
let prochainAvis = 1;

function leCoeur(): Coeur {
  if (coeurActif === null) throw erreur('interne');
  return coeurActif;
}

function versErreurApp(cause: unknown): ErreurApp {
  return estErreurApp(cause) ? cause : erreur('interne');
}

/** Affiche un message éphémère. Une cause inconnue devient l'erreur générique, jamais un texte brut. */
export function signaler(cause: unknown): void {
  const avis: Avis = { id: prochainAvis++, erreur: versErreurApp(cause) };
  application.ecrire((a) => ({ ...a, avis: [...a.avis, avis].slice(-3) }));
}

export function fermerLAvis(id: number): void {
  application.ecrire((a) => ({ ...a, avis: a.avis.filter((avis) => avis.id !== id) }));
}

async function relireLEtat(coeur: Coeur): Promise<void> {
  const [etat, parametres] = await Promise.all([coeur.etat(), coeur.parametres()]);
  application.ecrire((a) => ({ ...a, etat, parametres, scan: etat.scan.en_cours ? a.scan : null }));
  await accorderLesTags(coeur, parametres.langue);
}

/**
 * Langue dans laquelle les tags du magasin ont été demandés, ou null avant la première lecture.
 * On ne compare pas la langue « avant » et « après » dans le magasin : un changement de langue y est
 * écrit tout de suite (`modifierLesParametres`), avant la réponse du cœur, et la comparaison ne verrait rien.
 */
let langueDesTags: Langue | null = null;

async function relireLesTags(coeur: Coeur, langue: Langue): Promise<void> {
  langueDesTags = langue;
  try {
    const referentiels = await coeur.referentiels(langue);
    // Une autre langue a pu être demandée entre-temps : la dernière demande gagne.
    if (langueDesTags !== langue) return;
    application.ecrire((a) => ({ ...a, tags: new Map(referentiels.tags.map((tag) => [tag.id, tag.nom])) }));
  } catch (cause) {
    if (langueDesTags === langue) langueDesTags = null;
    throw cause;
  }
}

/** Relit les tags si la langue voulue n'est pas celle dans laquelle ils ont été lus. Rien avant le démarrage, qui les lit lui-même. */
async function accorderLesTags(coeur: Coeur, langue: Langue): Promise<void> {
  if (langueDesTags !== null && langueDesTags !== langue) await relireLesTags(coeur, langue);
}

async function relireTousLesJeux(coeur: Coeur): Promise<void> {
  const jeux = await coeur.lister_jeux();
  application.ecrire((a) => ({ ...a, jeux }));
}

async function relireDesJeux(coeur: Coeur, modifies: number[], retires: number[]): Promise<void> {
  const frais = modifies.length > 0 ? await coeur.jeux(modifies) : [];
  application.ecrire((a) => {
    if (a.jeux === null) return a;
    const parId = new Map(frais.map((jeu) => [jeu.id, jeu]));
    const absents = new Set(retires);
    // Un jeu demandé mais non renvoyé n'est plus visible (clé retirée, jeu supprimé) : on l'enlève.
    for (const id of modifies) if (!parId.has(id)) absents.add(id);
    const jeux = a.jeux.filter((jeu) => !absents.has(jeu.id)).map((jeu) => parId.get(jeu.id) ?? jeu);
    const connus = new Set(a.jeux.map((jeu) => jeu.id));
    for (const jeu of frais) if (!connus.has(jeu.id)) jeux.push(jeu);
    return { ...a, jeux };
  });
}

function traiter(coeur: Coeur, evenement: Evenement): void {
  switch (evenement.type) {
    case 'etat_modifie':
      void relireLEtat(coeur).catch(signaler);
      break;
    case 'bibliotheque_modifiee':
      void relireDesJeux(coeur, evenement.modifies, evenement.retires).catch(signaler);
      break;
    case 'scan_progression':
      application.ecrire((a) => ({ ...a, scan: { source: evenement.source, jeux_trouves: evenement.jeux_trouves } }));
      break;
    case 'scan_termine':
      application.ecrire((a) => ({ ...a, scan: null }));
      break;
    case 'session_demarree':
    case 'lancement_sans_session':
      application.ecrire((a) => (a.lancement === evenement.id_jeu ? { ...a, lancement: null } : a));
      break;
    case 'session_terminee':
      // Le nouveau temps de jeu arrive juste après par `bibliotheque_modifiee`.
      break;
    case 'donnees_rafraichies':
      if (evenement.domaine === 'bibliotheque') void relireTousLesJeux(coeur).catch(signaler);
      for (const rappel of ecouteurs.get(evenement.domaine) ?? []) rappel(evenement.id_jeu);
      break;
  }
}

/**
 * Branche l'application sur le cœur. On écoute AVANT de lire l'état (règle du contrat) :
 * un événement de scan émis pendant la première lecture ne peut pas être manqué.
 * Renvoie la fonction qui débranche tout.
 */
export function demarrer(coeur: Coeur): () => void {
  coeurActif = coeur;
  application.ecrire(INITIAL);
  const arreter = coeur.ecouter((evenement) => traiter(coeur, evenement));
  void (async () => {
    try {
      await relireLEtat(coeur);
      const langue = application.lire().parametres?.langue ?? 'fr';
      await Promise.all([relireTousLesJeux(coeur), relireLesTags(coeur, langue)]);
      application.ecrire((a) => ({ ...a, pret: true }));
    } catch (cause) {
      application.ecrire((a) => ({ ...a, pret: true, panne: versErreurApp(cause) }));
    }
  })();
  return () => {
    arreter();
    if (coeurActif === coeur) {
      coeurActif = null;
      langueDesTags = null;
    }
  };
}

// ───────────────────────────── Actions ─────────────────────────────

/** Lance un jeu. L'indicateur reste allumé jusqu'à `session_demarree` ou `lancement_sans_session`. */
export async function lancerLeJeu(id_jeu: number, source: Source | null = null): Promise<void> {
  if (application.lire().lancement !== null) return;
  application.ecrire((a) => ({ ...a, lancement: id_jeu }));
  try {
    await leCoeur().lancer(id_jeu, source);
  } catch (cause) {
    application.ecrire((a) => ({ ...a, lancement: null }));
    signaler(cause);
  }
}

/**
 * Favori : on change l'affichage tout de suite, puis on demande au cœur. S'il refuse, on revient
 * en arrière et on le dit. Le joueur n'attend jamais une réponse pour voir son clic pris en compte.
 */
export async function definirFavori(id_jeu: number, favori: boolean): Promise<void> {
  const appliquer = (valeur: boolean) =>
    application.ecrire((a) => (a.jeux === null ? a : { ...a, jeux: a.jeux.map((jeu) => (jeu.id === id_jeu ? { ...jeu, favori: valeur } : jeu)) }));
  appliquer(favori);
  try {
    await leCoeur().definir_favori(id_jeu, favori);
  } catch (cause) {
    appliquer(!favori);
    signaler(cause);
  }
}

export async function definirMasque(id_jeu: number, masque: boolean): Promise<void> {
  try {
    await leCoeur().definir_masque(id_jeu, masque);
  } catch (cause) {
    signaler(cause);
  }
}

/** Le contrat demande l'objet complet : on repart des paramètres connus et on remplace une partie. */
export async function modifierLesParametres(changer: (actuels: Parametres) => Parametres): Promise<void> {
  const actuels = application.lire().parametres;
  if (actuels === null) return;
  const voulus = changer(actuels);
  application.ecrire((a) => ({ ...a, parametres: voulus }));
  try {
    const coeur = leCoeur();
    const enregistres = await coeur.modifier_parametres(voulus);
    application.ecrire((a) => ({ ...a, parametres: enregistres }));
    await accorderLesTags(coeur, enregistres.langue);
  } catch (cause) {
    application.ecrire((a) => ({ ...a, parametres: actuels }));
    signaler(cause);
  }
}

export function modifierLAffichage(partie: Partial<Affichage>): Promise<void> {
  return modifierLesParametres((p) => ({ ...p, affichage: { ...p.affichage, ...partie } }));
}

/** Pour une action sans état à tenir (ouvrir un lien, un dossier) : l'échec devient un message. */
export async function tenter(action: (coeur: Coeur) => Promise<unknown>): Promise<boolean> {
  try {
    await action(leCoeur());
    return true;
  } catch (cause) {
    signaler(cause);
    return false;
  }
}
