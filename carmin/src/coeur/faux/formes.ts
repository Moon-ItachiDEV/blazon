/**
 * Noms donnés aux formes que le cœur renvoie, pour pouvoir les vérifier à l'exécution :
 * le test de conformité fabrique un schéma à partir de chacun de ces types du contrat.
 */
import type {
  Actualite, Ami, AnalyseChemin, CompteSteam, EtatApp, Evenement, FicheMagasin, JeuDetail, JeuResume,
  Parametres, Profil, Referentiels, Reponse, ResultatTestCle, Session, SuccesDuJeu,
} from '../../../contrat/types';

export type FormeEtat = EtatApp;
export type FormeParametres = Parametres;
export type FormeReferentiels = Referentiels;
export type FormeComptes = CompteSteam[];
export type FormeJeux = JeuResume[];
export type FormeJeu = JeuResume;
export type FormeDetail = JeuDetail;
export type FormeSessions = Session[];
export type FormeFiche = Reponse<FicheMagasin>;
export type FormeSucces = Reponse<SuccesDuJeu>;
export type FormeAmis = Reponse<Ami[]>;
export type FormeActualites = Reponse<Actualite[]>;
export type FormeProfil = Reponse<Profil>;
export type FormeAnalyse = AnalyseChemin;
export type FormeResultatCle = ResultatTestCle;
export type FormeEvenement = Evenement;
