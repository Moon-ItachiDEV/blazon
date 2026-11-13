/**
 * Remplace le faux cœur dans l'exécutable Windows (`BLAZON_EXE=1 vite build`, voir vite.config.ts).
 * L'exécutable parle toujours au vrai cœur : ni le faux cœur ni les 20 Mo de données factices
 * (2 000 jeux, amis et profil inventés) n'y sont embarqués.
 */
import type { Coeur } from '../../contrat/types';

export function creerFauxCoeur(_options?: unknown): Coeur {
  throw new Error('Blazon : le vrai cœur est introuvable (pont Electron absent).');
}
