/** Filtre et regroupement du fil d'actualités. Fonctions pures, comme pour la bibliothèque. */
import type { Actualite, DateUtc } from '../../contrat/types';

export const FILTRES_ACTUALITES = ['toutes', 'mises_a_jour', 'annonces'] as const;
export type FiltreActualites = (typeof FILTRES_ACTUALITES)[number];

export function filtrerActualites(liste: readonly Actualite[], filtre: FiltreActualites): Actualite[] {
  if (filtre === 'mises_a_jour') return liste.filter((a) => a.type === 'mise_a_jour');
  if (filtre === 'annonces') return liste.filter((a) => a.type === 'annonce');
  return [...liste];
}

export interface GroupeDeJour {
  /** Jour du calendrier local au format « 2026-11-11 » : sert de clé. */
  jour: string;
  /** Date de la première annonce du groupe, pour écrire « Aujourd'hui », « Hier » ou la date. */
  date: DateUtc;
  annonces: Actualite[];
}

/**
 * Le jour est celui du PC, pas celui d'UTC : une annonce de 23 h 30 à Paris appartient à ce soir-là.
 * `fuseau` absent = celui du PC ; les tests en fixent un pour ne pas dépendre de la machine.
 */
function jourLocal(date: DateUtc, fuseau: string | undefined): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
}

/**
 * Regroupe par jour, du plus récent au plus ancien. On retrie par précaution : l'ordre d'arrivée
 * vient de pages accumulées, et un groupe coupé en deux ferait apparaître deux fois le même titre.
 */
export function regrouperParJour(liste: readonly Actualite[], fuseau?: string): GroupeDeJour[] {
  const tri = [...liste].sort((a, b) => b.date.localeCompare(a.date));
  const groupes: GroupeDeJour[] = [];
  for (const annonce of tri) {
    const jour = jourLocal(annonce.date, fuseau);
    const dernier = groupes[groupes.length - 1];
    if (dernier !== undefined && dernier.jour === jour) dernier.annonces.push(annonce);
    else groupes.push({ jour, date: annonce.date, annonces: [annonce] });
  }
  return groupes;
}

/** Le filtre « un seul jeu » du ruban Par jeu : null = tous les jeux. */
export function filtrerParJeu(liste: readonly Actualite[], id_jeu: number | null): Actualite[] {
  return id_jeu === null ? [...liste] : liste.filter((a) => a.id_jeu === id_jeu);
}

export interface NouvellesDUnJeu {
  id_jeu: number;
  nombre: number;
  /** Date de sa nouvelle la plus récente. */
  derniere: DateUtc;
}

/** Les jeux qui ont des nouvelles, du plus bavard au plus discret ; à égalité, le plus récent d'abord. */
export function compterParJeu(liste: readonly Actualite[]): NouvellesDUnJeu[] {
  const parJeu = new Map<number, NouvellesDUnJeu>();
  for (const annonce of liste) {
    const deja = parJeu.get(annonce.id_jeu);
    if (deja === undefined) parJeu.set(annonce.id_jeu, { id_jeu: annonce.id_jeu, nombre: 1, derniere: annonce.date });
    else {
      deja.nombre += 1;
      if (annonce.date > deja.derniere) deja.derniere = annonce.date;
    }
  }
  return [...parJeu.values()].sort((a, b) => b.nombre - a.nombre || b.derniere.localeCompare(a.derniere) || a.id_jeu - b.id_jeu);
}

/**
 * La « une » : la plus récente qui a une image (une une sans image n'en est pas une) ; à défaut, la plus récente.
 * undefined pour une liste vide.
 */
export function choisirLaUne(liste: readonly Actualite[]): Actualite | undefined {
  const tri = [...liste].sort((a, b) => b.date.localeCompare(a.date));
  return tri.find((a) => a.image !== null) ?? tri[0];
}
