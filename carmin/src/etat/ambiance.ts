import { useEffect } from 'react';
import { creerMagasin } from './magasin';

/**
 * La couleur qui éclaire le fond de l'application : celle du dernier jeu mis à l'écran (scène de la
 * bibliothèque, fiche). Elle reste en place quand on passe aux amis ou aux paramètres : le client garde
 * la teinte du jeu que l'on vient de regarder, au lieu de retomber sur un fond neutre.
 */
export const ambiance = creerMagasin<string | null>(null);

/**
 * L'image du dernier jeu mis à l'écran : `Decor` la pose en très grand et très floue derrière toute
 * l'application, et les panneaux de verre dépoli en laissent passer les couleurs.
 */
export const imageAmbiance = creerMagasin<string | null>(null);

export function useAmbiance(couleur: string | null, image: string | null = null): void {
  useEffect(() => {
    if (couleur !== null) ambiance.ecrire(couleur);
  }, [couleur]);
  useEffect(() => {
    if (image !== null) imageAmbiance.ecrire(image);
  }, [image]);
}
