import { useEffect } from 'react';
import { creerMagasin } from './magasin';

/**
 * La couleur qui éclaire le fond de l'application : celle du dernier jeu mis à l'écran (scène de la
 * bibliothèque, fiche). Elle reste en place quand on passe aux amis ou aux paramètres : le client garde
 * la teinte du jeu que l'on vient de regarder, au lieu de retomber sur un fond neutre.
 */
export const ambiance = creerMagasin<string | null>(null);

export function useAmbiance(couleur: string | null): void {
  useEffect(() => {
    if (couleur !== null) ambiance.ecrire(couleur);
  }, [couleur]);
}
