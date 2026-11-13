/**
 * Tri, filtres et recherche de la bibliothèque. Ce sont des fonctions pures : elles reçoivent
 * la liste des jeux et renvoient une nouvelle liste, sans rien modifier ni rien appeler.
 * 2 000 jeux se filtrent et se trient en moins d'une milliseconde : inutile de mettre en cache.
 */
import type { Affichage, JeuResume, TriBibliotheque } from '../../contrat/types';

export const FILTRES = ['tous', 'installes', 'favoris', 'jamais_lances'] as const;
export type Filtre = (typeof FILTRES)[number];

export interface Criteres {
  filtre: Filtre;
  /** Texte tapé par le joueur, tel quel. */
  recherche: string;
  montrer_les_jeux_masques: boolean;
}

/** Minuscules, sans accent ni ponctuation : « Épée & Magie ! » devient « epee magie ». */
export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function motsDe(recherche: string): string[] {
  const propre = normaliserRecherche(recherche);
  return propre === '' ? [] : propre.split(' ');
}

/** Vrai si chaque mot tapé se retrouve dans le titre, dans n'importe quel ordre. */
function correspond(jeu: JeuResume, mots: string[]): boolean {
  if (mots.length === 0) return true;
  // On cherche dans le titre complet, article compris : « the witcher » doit trouver « The Witcher 3 ».
  const titre = normaliserRecherche(jeu.titre);
  return mots.every((mot) => titre.includes(mot));
}

function passeLeFiltre(jeu: JeuResume, filtre: Filtre): boolean {
  switch (filtre) {
    case 'tous':
      return true;
    case 'installes':
      return jeu.installe;
    case 'favoris':
      return jeu.favori;
    case 'jamais_lances':
      return jeu.temps.dernier_lancement === null;
  }
}

export function filtrer(jeux: readonly JeuResume[], criteres: Criteres): JeuResume[] {
  const mots = motsDe(criteres.recherche);
  return jeux.filter(
    (jeu) => (criteres.montrer_les_jeux_masques || !jeu.masque) && passeLeFiltre(jeu, criteres.filtre) && correspond(jeu, mots),
  );
}

/** Nombre de jeux derrière chaque filtre, pour les compteurs affichés à côté des filtres. */
export function compter(jeux: readonly JeuResume[], montrer_les_jeux_masques: boolean): Record<Filtre, number> {
  const compte: Record<Filtre, number> = { tous: 0, installes: 0, favoris: 0, jamais_lances: 0 };
  for (const jeu of jeux) {
    if (jeu.masque && !montrer_les_jeux_masques) continue;
    for (const filtre of FILTRES) if (passeLeFiltre(jeu, filtre)) compte[filtre] += 1;
  }
  return compte;
}

// « Civilization 2 » avant « Civilization 10 » : le tri des titres comprend les nombres.
const ALPHABETIQUE = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

function valeurDeTri(jeu: JeuResume, tri: TriBibliotheque): string | number | null {
  switch (tri) {
    case 'titre':
      return jeu.titre_tri;
    case 'dernier_lancement':
      return jeu.temps.dernier_lancement;
    case 'temps_de_jeu':
      return jeu.temps.minutes_total;
    case 'ajoute_le':
      return jeu.ajoute_le;
    case 'date_sortie':
      return jeu.date_sortie;
  }
}

/**
 * Trie sans modifier la liste reçue. Un jeu sans valeur (jamais lancé, date de sortie inconnue)
 * va toujours à la fin, dans les deux sens. À égalité, l'ordre alphabétique départage.
 */
export function trier(jeux: readonly JeuResume[], tri: TriBibliotheque, ordre: Affichage['ordre']): JeuResume[] {
  const sens = ordre === 'croissant' ? 1 : -1;
  return [...jeux].sort((a, b) => {
    const va = valeurDeTri(a, tri);
    const vb = valeurDeTri(b, tri);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else if (va !== vb) {
      const ecart = typeof va === 'number' && typeof vb === 'number' ? va - vb : tri === 'titre' ? ALPHABETIQUE.compare(String(va), String(vb)) : String(va).localeCompare(String(vb));
      if (ecart !== 0) return ecart * sens;
    }
    return ALPHABETIQUE.compare(a.titre_tri, b.titre_tri) || a.id - b.id;
  });
}

/** Les jeux à reprendre : installés, visibles, du plus récemment lancé au plus ancien. */
export function aReprendre(jeux: readonly JeuResume[], nombre: number): JeuResume[] {
  const candidats = jeux.filter((jeu) => jeu.installe && !jeu.masque && jeu.temps.dernier_lancement !== null);
  return trier(candidats, 'dernier_lancement', 'decroissant').slice(0, Math.max(0, nombre));
}

/**
 * Résultats de la recherche rapide (Ctrl K), les plus probables d'abord :
 * titre exact, puis titre qui commence par le texte, puis mot qui commence par le texte,
 * puis le reste. À rang égal, le jeu lancé le plus récemment passe devant.
 */
export function rechercheRapide(jeux: readonly JeuResume[], recherche: string, limite: number): JeuResume[] {
  const texte = normaliserRecherche(recherche);
  const mots = motsDe(recherche);
  if (mots.length === 0) return [];
  const rang = (jeu: JeuResume): number => {
    const titre = normaliserRecherche(jeu.titre);
    if (titre === texte || jeu.titre_tri === texte) return 0;
    if (titre.startsWith(texte) || jeu.titre_tri.startsWith(texte)) return 1;
    if (titre.includes(` ${texte}`)) return 2;
    return 3;
  };
  return jeux
    .filter((jeu) => !jeu.masque && correspond(jeu, mots))
    .map((jeu) => ({ jeu, rang: rang(jeu) }))
    .sort(
      (a, b) =>
        a.rang - b.rang ||
        (b.jeu.temps.dernier_lancement ?? '').localeCompare(a.jeu.temps.dernier_lancement ?? '') ||
        ALPHABETIQUE.compare(a.jeu.titre_tri, b.jeu.titre_tri),
    )
    .slice(0, Math.max(0, limite))
    .map((resultat) => resultat.jeu);
}
