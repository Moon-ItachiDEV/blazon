/**
 * Fenêtrage d'une longue liste : on ne crée dans la page que les éléments proches de l'écran.
 *
 * Mesuré sur 2 000 jeux : sans fenêtrage, la page compte 14 600 éléments et revenir au filtre
 * « Tous » prend 200 ms ; avec, une soixantaine de cartes existent à la fois et le changement est
 * immédiat. La hauteur totale est conservée : la barre de défilement se comporte comme si tout était là.
 *
 * Tous les éléments ont la même taille (grille régulière ou lignes de hauteur fixe) : c'est ce qui
 * permet de calculer les positions sans rien mesurer d'autre que la largeur du conteneur.
 *
 * Clavier : un élément qui a le focus peut sortir de la fenêtre (on fait défiler à la souris après
 * avoir tabulé). Il disparaît alors de la page, et le navigateur renverrait le clavier tout en haut.
 * Le conteneur reprend donc le focus à ce moment-là, et la touche Tab suivante repart du premier
 * élément visible à l'écran.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface OptionsDeFenetre {
  /** Nombre total d'éléments. */
  nombre: number;
  /** Largeur minimale d'une colonne, ou null pour une seule colonne (liste). */
  largeurMin: number | null;
  /** Espace entre deux éléments, en pixels. */
  espace: number;
  /** Hauteur d'un élément pour une largeur de colonne donnée. */
  hauteur: (largeurDeColonne: number) => number;
}

export interface Fenetre {
  /** 0 tant que la largeur n'est pas connue : ne rien dessiner. */
  colonnes: number;
  /** Indices des éléments à créer : de `debut` inclus à `fin` exclu. */
  debut: number;
  fin: number;
  /** Hauteur à donner au conteneur. */
  hauteurTotale: number;
  /** Décalage vertical du premier élément créé. */
  decalage: number;
}

interface Mesure {
  largeur: number;
  premiere: number;
  derniere: number;
}

/** Pure : la géométrie de la grille pour une largeur donnée. Testée à part. */
export function geometrie(largeur: number, options: OptionsDeFenetre): { colonnes: number; pas: number; lignes: number } {
  const { largeurMin, espace, nombre } = options;
  const colonnes = largeurMin === null ? 1 : Math.max(1, Math.floor((largeur + espace) / (largeurMin + espace)));
  const largeurDeColonne = (largeur - espace * (colonnes - 1)) / colonnes;
  const pas = options.hauteur(largeurDeColonne) + espace;
  return { colonnes, pas, lignes: Math.ceil(nombre / colonnes) };
}

/** Le premier élément activable de la première ligne (`li`) dont le haut est à l'écran : une carte entière, pas le bas d'une carte coupée. */
function premierVisible(conteneur: HTMLElement): HTMLElement | null {
  for (const ligne of conteneur.querySelectorAll('li')) {
    const haut = ligne.getBoundingClientRect().top;
    if (haut >= 0 && haut < window.innerHeight) return ligne.querySelector<HTMLElement>('a[href], button:not(:disabled)');
  }
  return null;
}

export function useFenetre(conteneur: RefObject<HTMLElement | null>, options: OptionsDeFenetre): Fenetre {
  const [mesure, setMesure] = useState<Mesure>({ largeur: 0, premiere: 0, derniere: 0 });
  const actuelles = useRef(options);
  actuelles.current = options;

  const mesurer = useRef(() => {
    const element = conteneur.current;
    if (element === null) return;
    const cadre = element.getBoundingClientRect();
    if (cadre.width === 0) return;
    const { pas, lignes } = geometrie(cadre.width, actuelles.current);
    // Marge : trois quarts d'écran au-dessus et en dessous, pour qu'un défilement rapide ne montre pas de vide.
    const marge = window.innerHeight * 0.75;
    const borner = (ligne: number) => Math.min(Math.max(ligne, 0), Math.max(lignes - 1, 0));
    const premiere = borner(Math.floor((-cadre.top - marge) / pas));
    const derniere = borner(Math.floor((-cadre.top + window.innerHeight + marge) / pas));
    const actif = document.activeElement;
    if (actif instanceof HTMLElement && actif !== element && element.contains(actif)) {
      const ligne = Math.floor((actif.getBoundingClientRect().top - cadre.top) / pas);
      if (ligne < premiere || ligne > derniere) element.focus({ preventScroll: true });
    }
    setMesure((avant) =>
      avant.largeur === cadre.width && avant.premiere === premiere && avant.derniere === derniere ? avant : { largeur: cadre.width, premiere, derniere },
    );
  }).current;

  // Avant le premier affichage, et à chaque changement de liste ou de taille de jaquette.
  useLayoutEffect(mesurer, [mesurer, options.nombre, options.largeurMin, options.espace]);

  useEffect(() => {
    const element = conteneur.current;
    if (element === null) return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    window.addEventListener('scroll', mesurer, { passive: true });
    window.addEventListener('resize', mesurer);
    // Le conteneur peut recevoir le focus par le code, jamais par Tab. `data-fenetre` lui retire l'anneau (base.css).
    element.tabIndex = -1;
    element.dataset.fenetre = '';
    const repartirDuVisible = (evenement: KeyboardEvent) => {
      if (evenement.key !== 'Tab' || evenement.shiftKey || evenement.target !== element) return;
      const visible = premierVisible(element);
      if (visible === null) return;
      evenement.preventDefault();
      visible.focus();
    };
    element.addEventListener('keydown', repartirDuVisible);
    return () => {
      observateur.disconnect();
      window.removeEventListener('scroll', mesurer);
      window.removeEventListener('resize', mesurer);
      element.removeEventListener('keydown', repartirDuVisible);
    };
  }, [conteneur, mesurer]);

  if (mesure.largeur === 0) return { colonnes: 0, debut: 0, fin: 0, hauteurTotale: 0, decalage: 0 };
  const { colonnes, pas, lignes } = geometrie(mesure.largeur, options);
  const premiere = Math.min(mesure.premiere, Math.max(lignes - 1, 0));
  const derniere = Math.min(mesure.derniere, Math.max(lignes - 1, 0));
  return {
    colonnes,
    debut: premiere * colonnes,
    fin: Math.min(options.nombre, (derniere + 1) * colonnes),
    hauteurTotale: Math.max(0, lignes * pas - options.espace),
    decalage: premiere * pas,
  };
}
