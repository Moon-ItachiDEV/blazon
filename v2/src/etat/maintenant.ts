/**
 * L'heure courante, partagée et mise à jour une fois par minute : « Aujourd'hui » devient « Hier »
 * à minuit sans que chaque composant ait sa propre minuterie.
 */
import { creerMagasin, useMagasin } from './magasin';

const horloge = creerMagasin(new Date());

if (typeof window !== 'undefined') {
  setInterval(() => horloge.ecrire(new Date()), 60_000);
}

export function useMaintenant(): Date {
  return useMagasin(horloge, (instant) => instant);
}
