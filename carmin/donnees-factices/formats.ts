/**
 * Forme des fichiers de données factices. Chaque fichier est vérifié contre ces types
 * par outils/verifier_donnees.mjs : si le contrat change, la vérification le dit.
 */
import type {
  Actualite, Ami, EtatApp, FicheMagasin, JeuResume, Parametres, Profil, Referentiels, Session, SourceDeJeu, SuccesDuJeu,
} from '../contrat/types';

/** jeux.json */
export type FichierJeux = JeuResume[];
/** sessions.json : toutes les sessions mesurées par le launcher, de la plus ancienne à la plus récente. */
export type FichierSessions = Session[];
/** amis.json */
export type FichierAmis = Ami[];
/** actualites.json : de la plus récente à la plus ancienne. */
export type FichierActualites = Actualite[];
/** referentiels.json */
export interface FichierReferentiels { fr: Referentiels; en: Referentiels }
/** etat.json */
export interface FichierEtat { etat: EtatApp; profil: Profil; parametres: Parametres }

/** Ce qu'il faut ajouter à un JeuResume et à ses sessions pour former un JeuDetail, plus sa fiche du magasin. */
export interface FicheFactice {
  hero: string | null;
  logo: string | null;
  en_tete: string | null;
  sources: SourceDeJeu[];
  /** null = jeu hors Steam (le cœur factice répond alors avec l'erreur `jeu_non_steam`). */
  fiche: FicheMagasin | null;
}
/** fiches/NN.json : NN = partie entière de (id - 1) / 100. Clé = identifiant du jeu. */
export type FichierFiches = Record<string, FicheFactice>;
/** succes/NN.json : même découpage. Un jeu absent n'a pas de succès connus. */
export type FichierSucces = Record<string, SuccesDuJeu>;
