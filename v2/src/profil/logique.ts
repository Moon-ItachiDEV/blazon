/**
 * Les chiffres du profil, calculés sur la bibliothèque. Des fonctions pures : le cœur ne les
 * fournit pas, l'écran les tire de la liste des jeux qu'il a déjà.
 */
import type { JeuResume, Source } from '../../contrat/types';

export interface Chiffres {
  jeux: number;
  installes: number;
  minutes_total: number;
  /** null = Steam n'a donné la valeur d'aucun jeu : afficher « 0 min » serait faux. */
  minutes_2sem: number | null;
  jamais_lances: number;
  /** De 0 à 100. */
  part_jamais_lances: number;
  /** null = aucun jeu n'a de progression connue (sans clé, profil privé). */
  succes_debloques: number | null;
  favoris: number;
  taille_installee: number;
}

export interface PartDeSource {
  source: Source;
  jeux: number;
}

/** Les jeux masqués ne comptent dans aucun chiffre. */
export function jeuxComptes(jeux: readonly JeuResume[]): JeuResume[] {
  return jeux.filter((jeu) => !jeu.masque);
}

export function compterMasques(jeux: readonly JeuResume[]): number {
  return jeux.filter((jeu) => jeu.masque).length;
}

export function calculerLesChiffres(jeux: readonly JeuResume[]): Chiffres {
  const comptes = jeuxComptes(jeux);
  let minutes_total = 0;
  let minutes_2sem = 0;
  let a_des_minutes_2sem = false;
  let succes = 0;
  let a_des_succes = false;
  let installes = 0;
  let jamais_lances = 0;
  let favoris = 0;
  let taille_installee = 0;

  for (const jeu of comptes) {
    minutes_total += jeu.temps.minutes_total;
    if (jeu.temps.minutes_2sem !== null) {
      minutes_2sem += jeu.temps.minutes_2sem;
      a_des_minutes_2sem = true;
    }
    if (jeu.succes !== null && jeu.succes.debloques !== null) {
      succes += jeu.succes.debloques;
      a_des_succes = true;
    }
    if (jeu.installe) {
      installes += 1;
      taille_installee += jeu.taille_octets ?? 0;
    }
    if (jeu.temps.dernier_lancement === null) jamais_lances += 1;
    if (jeu.favori) favoris += 1;
  }

  return {
    jeux: comptes.length,
    installes,
    minutes_total,
    minutes_2sem: a_des_minutes_2sem ? minutes_2sem : null,
    jamais_lances,
    part_jamais_lances: comptes.length === 0 ? 0 : (jamais_lances / comptes.length) * 100,
    succes_debloques: a_des_succes ? succes : null,
    favoris,
    taille_installee,
  };
}

/**
 * Nombre de jeux par source, du plus fourni au moins fourni. Un jeu présent sur deux sources
 * compte pour chacune : la somme peut dépasser le nombre de jeux.
 */
export function repartitionParSource(jeux: readonly JeuResume[]): PartDeSource[] {
  const nombres = new Map<Source, number>();
  for (const jeu of jeuxComptes(jeux)) {
    for (const source of new Set(jeu.sources)) nombres.set(source, (nombres.get(source) ?? 0) + 1);
  }
  return [...nombres]
    .map(([source, n]) => ({ source, jeux: n }))
    .sort((a, b) => b.jeux - a.jeux || a.source.localeCompare(b.source));
}

/** Les jeux les plus joués. Un jeu jamais joué n'est pas « joué » : il n'entre pas dans le palmarès. */
export function plusJoues(jeux: readonly JeuResume[], nombre = 5): JeuResume[] {
  return jeuxComptes(jeux)
    .filter((jeu) => jeu.temps.minutes_total > 0)
    .sort((a, b) => b.temps.minutes_total - a.temps.minutes_total || a.titre_tri.localeCompare(b.titre_tri) || a.id - b.id)
    .slice(0, nombre);
}
