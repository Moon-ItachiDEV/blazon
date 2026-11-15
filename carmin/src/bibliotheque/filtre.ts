import { creerMagasin } from '../etat/magasin';
import type { Filtre } from './logique';

/**
 * Le filtre de la bibliothèque. Hors des composants : il est retrouvé tel quel au retour d'une fiche,
 * et le menu de gauche peut le choisir (raccourcis Installés, Favoris, Jamais lancés).
 */
export const filtreChoisi = creerMagasin<Filtre>('tous');
