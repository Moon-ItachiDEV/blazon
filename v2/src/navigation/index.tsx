/**
 * Navigation entre les écrans.
 *
 * Pas de bibliothèque de routage : l'application a huit adresses, toutes dans la partie « # » de
 * l'adresse. On s'appuie sur l'historique du navigateur (`pushState`, `popstate`), ce qui donne
 * gratuitement le bouton Précédent de la souris, Alt+Gauche et le retour à l'endroit exact
 * de la liste que l'on venait de quitter.
 */
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { creerMagasin, useMagasin } from '../etat/magasin';
import { ACCUEIL, ecrireRoute, lireRoute, type Route } from './routes';

export { ACCUEIL, type Route } from './routes';

const dansUnNavigateur = typeof window !== 'undefined';

const magasin = creerMagasin<Route>(dansUnNavigateur ? lireRoute(location.hash) : ACCUEIL);

/** Numéro de l'entrée d'historique courante : sert de clé pour retrouver sa position de défilement. */
let numero: number = dansUnNavigateur ? lireNumero(history.state) : 0;
const defilements = new Map<number, number>();

/**
 * L'élément qui défile : la page de la fenêtre flottante (la fenêtre du navigateur, elle, ne défile pas).
 * Tant qu'aucun n'est déclaré, c'est le document.
 */
let defileur: HTMLElement | null = null;

export function declarerLeDefileur(element: HTMLElement | null): void {
  defileur = element;
}

export function positionDeDefilement(): number {
  return defileur?.scrollTop ?? window.scrollY;
}

function defilerA(position: number): void {
  if (defileur !== null) defileur.scrollTop = position;
  else window.scrollTo(0, position);
}

function lireNumero(etat: unknown): number {
  if (typeof etat === 'object' && etat !== null && 'n' in etat && typeof etat.n === 'number') return etat.n;
  return 0;
}

/** Vrai si les animations sont permises : réglage de l'application, sinon celui de Windows. */
export function animationsActives(): boolean {
  const reglage = document.documentElement.dataset.animations;
  if (reglage === 'desactivees') return false;
  if (reglage === 'activees') return true;
  return !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Change d'écran. Avec les animations, le navigateur photographie l'ancien écran, on dessine le
 * nouveau d'un seul coup (`flushSync`), puis il fond l'un dans l'autre (View Transitions).
 */
function changer(route: Route, defilement: number): void {
  const appliquer = () => {
    flushSync(() => magasin.ecrire(route));
    defilerA(defilement);
    // Les listes fenêtrées calculent quoi dessiner d'après le défilement : on les prévient sans
    // attendre l'événement du navigateur, pour que l'écran soit complet dès la première image.
    flushSync(() => window.dispatchEvent(new Event('scroll')));
  };
  if (animationsActives() && typeof document.startViewTransition === 'function') {
    document.startViewTransition(appliquer);
  } else {
    // Hors du rendu React en cours : `flushSync` n'est pas permis depuis un effet.
    queueMicrotask(appliquer);
  }
}

export function naviguer(route: Route, options: { remplacer?: boolean } = {}): void {
  const adresse = ecrireRoute(route);
  if (adresse === ecrireRoute(magasin.lire())) return;
  defilements.set(numero, positionDeDefilement());
  if (options.remplacer === true) {
    history.replaceState({ n: numero }, '', adresse);
  } else {
    numero += 1;
    history.pushState({ n: numero }, '', adresse);
  }
  changer(route, 0);
}

/** Revient à l'écran précédent, ou à la bibliothèque si l'application a été ouverte sur cet écran. */
export function revenir(): void {
  if (numero > 0) history.back();
  else naviguer(ACCUEIL, { remplacer: true });
}

if (dansUnNavigateur) {
  // On replace nous-mêmes le défilement : le navigateur le ferait avant que la liste soit redessinée.
  history.scrollRestoration = 'manual';
  window.addEventListener('popstate', (evenement) => {
    defilements.set(numero, positionDeDefilement());
    numero = lireNumero(evenement.state);
    changer(lireRoute(location.hash), defilements.get(numero) ?? 0);
  });
}

export function useRoute(): Route {
  return useMagasin(magasin, (route) => route);
}

type ProprietesDeLien = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { vers: Route };

/** Un vrai lien (`<a href>`) : clic du milieu, lecteur d'écran et copie d'adresse fonctionnent. */
export function Lien({ vers, onClick, ...reste }: ProprietesDeLien) {
  const auClic = (evenement: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(evenement);
    if (evenement.defaultPrevented || evenement.button !== 0) return;
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
    evenement.preventDefault();
    naviguer(vers);
  };
  return <a {...reste} href={ecrireRoute(vers)} onClick={auClic} />;
}
