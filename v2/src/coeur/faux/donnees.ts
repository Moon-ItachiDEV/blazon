/**
 * Accès aux fichiers de `donnees-factices/`.
 *
 * `import.meta.glob` laisse Vite découper les données en morceaux chargés à la demande :
 * les 20 Mo ne sont jamais chargés d'un bloc, et le même code tourne dans le navigateur,
 * dans le build et dans les tests, sans `fetch` ni lecture de disque.
 * On ne type pas ces imports depuis le JSON : TypeScript n'a pas à lire 20 Mo de littéraux.
 * La conformité au contrat est tenue par `outils/verifier_donnees.mjs`.
 */
import { reecrireImages, VERSION_ARTEFACT } from '../../artefact/images';

const RACINE = '../../../donnees-factices/';
const modules = import.meta.glob<unknown>('../../../donnees-factices/**/*.json', { import: 'default' });

/** Renvoie une COPIE du fichier (les modules JSON sont partagés : on ne les modifie jamais). */
export async function lireFichier<T>(chemin: string): Promise<T | null> {
  const charger = modules[RACINE + chemin];
  if (!charger) return null;
  const copie = structuredClone(await charger()) as T;
  return VERSION_ARTEFACT ? reecrireImages(copie) : copie;
}

/** fiches/NN.json et succes/NN.json : NN = partie entière de (id - 1) / 100. */
export function numeroDeMorceau(id_jeu: number): number {
  return Math.floor((id_jeu - 1) / 100);
}

export function nomDeMorceau(dossier: 'fiches' | 'succes', numero: number): string {
  return `${dossier}/${String(numero).padStart(2, '0')}.json`;
}
