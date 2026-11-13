/**
 * SEUL point d'entrée des écrans vers le cœur.
 * Dans l'exécutable Windows : le vrai cœur (Steam, le PC), derrière le pont d'Electron.
 * Dans un navigateur, l'artefact et les tests : le faux cœur et ses scénarios (`?scenario=hors_ligne`).
 */
import type { Coeur } from '../../contrat/types';
import { creerFauxCoeur } from './faux/faux_coeur';
import { lireScenario } from './faux/scenarios';
import { creerCoeurElectron, pontElectron } from './electron';

export { erreur, estErreurApp, estTransitoire, vautUnNouvelEssai } from './erreurs';

export const scenario = lireScenario(typeof location === 'undefined' ? '' : location.search);

const pont = pontElectron();

export const coeurReel = pont !== null;

export const coeur: Coeur = pont !== null ? creerCoeurElectron(pont) : creerFauxCoeur({ scenario });
