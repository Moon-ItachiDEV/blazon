import type { PointerEvent as EvenementReact } from 'react';
import { animationsActives } from '../navigation';

/** Inclinaison maximale d'une carte holographique, en degrés. */
const INCLINAISON = 12;

/**
 * Pose sur `element` la place du pointeur, pour les effets en CSS :
 *   --px, --py : de -1 à 1 (centre = 0), pour une parallaxe ;
 *   --rx, --ry : inclinaison vers le pointeur ; --gx, --gy : place du reflet, en pourcentage.
 * Une seule écriture par image (requestAnimationFrame), même si la souris envoie plus d'événements.
 */
const enAttente = new WeakMap<HTMLElement, { x: number; y: number }>();

export function suivreLePointeur(element: HTMLElement, clientX: number, clientY: number): void {
  const deja = enAttente.has(element);
  enAttente.set(element, { x: clientX, y: clientY });
  if (deja) return;
  requestAnimationFrame(() => {
    const position = enAttente.get(element);
    enAttente.delete(element);
    if (position === undefined) return;
    const cadre = element.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (position.x - cadre.left) / cadre.width));
    const y = Math.min(1, Math.max(0, (position.y - cadre.top) / cadre.height));
    const arrondir = (valeur: number) => Math.round(valeur * 1000) / 1000;
    element.style.setProperty('--px', `${arrondir(x * 2 - 1)}`);
    element.style.setProperty('--py', `${arrondir(y * 2 - 1)}`);
    element.style.setProperty('--rx', `${arrondir((0.5 - y) * 2 * INCLINAISON)}deg`);
    element.style.setProperty('--ry', `${arrondir((x - 0.5) * 2 * INCLINAISON)}deg`);
    element.style.setProperty('--gx', `${Math.round(x * 100)}%`);
    element.style.setProperty('--gy', `${Math.round(y * 100)}%`);
  });
}

export function oublierLePointeur(element: HTMLElement): void {
  enAttente.delete(element);
  for (const variable of ['--px', '--py', '--rx', '--ry', '--gx', '--gy']) element.style.removeProperty(variable);
}

/**
 * Gestionnaires prêts à poser sur une liste : l'élément suivi est l'ancêtre du pointeur qui correspond
 * à `selecteur`. Rien ne bouge au toucher, ni quand les animations sont coupées.
 */
export function suiviDeListe(selecteur: string) {
  let suivi: HTMLElement | null = null;
  const quitter = () => {
    if (suivi !== null) oublierLePointeur(suivi);
    suivi = null;
  };
  return {
    onPointerMove: (evenement: EvenementReact<HTMLElement>) => {
      if (evenement.pointerType !== 'mouse' || !animationsActives()) return;
      const element = (evenement.target as HTMLElement).closest<HTMLElement>(selecteur);
      if (element !== suivi) quitter();
      if (element === null) return;
      suivi = element;
      suivreLePointeur(element, evenement.clientX, evenement.clientY);
    },
    onPointerLeave: quitter,
  };
}
