/** Tri et choix des succès à montrer. Fonctions pures, comme pour la bibliothèque. */
import type { Succes } from '../../contrat/types';

export const FILTRES_SUCCES = ['tous', 'debloques', 'a_debloquer'] as const;
export type FiltreSucces = (typeof FILTRES_SUCCES)[number];

const parRarete = (a: Succes, b: Succes) => (b.pct_mondial ?? -1) - (a.pct_mondial ?? -1) || a.nom.localeCompare(b.nom);

/**
 * Ordre d'affichage : d'abord les succès débloqués, du plus récent au plus ancien ; puis ceux qui
 * restent, du plus courant au plus rare (les plus accessibles d'abord).
 */
export function ordonner(liste: readonly Succes[]): Succes[] {
  const debloques = liste.filter((s) => s.debloque === true).sort((a, b) => (b.debloque_le ?? '').localeCompare(a.debloque_le ?? '') || parRarete(a, b));
  const autres = liste.filter((s) => s.debloque !== true).sort(parRarete);
  return [...debloques, ...autres];
}

export function filtrerSucces(liste: readonly Succes[], filtre: FiltreSucces): Succes[] {
  if (filtre === 'debloques') return liste.filter((s) => s.debloque === true);
  if (filtre === 'a_debloquer') return liste.filter((s) => s.debloque !== true);
  return [...liste];
}

/**
 * Aperçu pour la fiche d'un jeu : les derniers succès débloqués, puis les prochains à portée.
 * Un succès secret non débloqué n'y figure pas : son texte est caché, il n'apprendrait rien.
 */
export function apercu(liste: readonly Succes[], nombre: number): Succes[] {
  const ordonnes = ordonner(liste);
  const debloques = ordonnes.filter((s) => s.debloque === true);
  const restants = ordonnes.filter((s) => s.debloque !== true && !s.secret);
  const moitie = Math.ceil(nombre / 2);
  const pris = debloques.slice(0, Math.max(moitie, nombre - restants.length));
  return [...pris, ...restants.slice(0, nombre - pris.length)].slice(0, nombre);
}

/** Vrai si le texte du succès doit rester caché. */
export function estCache(succes: Succes, reveler: boolean): boolean {
  return succes.secret && succes.debloque !== true && !reveler;
}

/** Seuils de rareté, en part des joueurs qui ont le succès. */
export const SEUIL_ULTRA_RARE = 5;
export const SEUIL_RARE = 15;

/** Rareté d'un succès : « ultra » sous 5 % des joueurs, « rare » sous 15 %, sinon rien. */
export function rarete(succes: Succes): 'ultra' | 'rare' | null {
  if (succes.pct_mondial === null) return null;
  if (succes.pct_mondial < SEUIL_ULTRA_RARE) return 'ultra';
  if (succes.pct_mondial < SEUIL_RARE) return 'rare';
  return null;
}

/**
 * La vitrine : les trois succès débloqués les plus rares. Sans progression connue, ou sans succès
 * débloqué, ce sont les trois plus rares du jeu (hors secrets cachés), présentés comme des défis.
 */
export function vitrine(liste: readonly Succes[], reveler: boolean): { succes: Succes[]; defis: boolean } {
  const rares = (a: Succes, b: Succes) => (a.pct_mondial ?? 101) - (b.pct_mondial ?? 101) || a.nom.localeCompare(b.nom);
  const debloques = liste.filter((s) => s.debloque === true && s.pct_mondial !== null).sort(rares);
  if (debloques.length > 0) return { succes: debloques.slice(0, 3), defis: false };
  const defis = liste.filter((s) => s.pct_mondial !== null && !estCache(s, reveler)).sort(rares);
  return { succes: defis.slice(0, 3), defis: true };
}
