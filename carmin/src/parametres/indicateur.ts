import { useLayoutEffect, useRef } from 'react';

/**
 * Un indicateur qui glisse d'une entrée à l'autre (section ouverte, filtre choisi). Le conteneur, en
 * `position: relative`, reçoit la place de l'entrée marquée `data-actif` : --ind-x, --ind-y, --ind-l,
 * --ind-h, en pixels. Mesuré avec `offset*`, qui ignore les transformations : la mesure reste juste
 * pendant l'entrée en cascade. `data-pret` n'est posé qu'après la première mesure, pour que
 * l'indicateur apparaisse en place puis seulement ensuite glisse.
 */
export function useIndicateur<E extends HTMLElement>(actif: string) {
  const conteneur = useRef<E>(null);
  useLayoutEffect(() => {
    const element = conteneur.current;
    if (element === null) return;
    const placer = () => {
      const cible = element.querySelector<HTMLElement>('[data-actif]');
      if (cible === null) {
        element.style.setProperty('--ind-o', '0');
        return;
      }
      // L'entrée peut être enveloppée (un `li`) : on additionne les décalages jusqu'au conteneur.
      let x = 0;
      let y = 0;
      let noeud: HTMLElement | null = cible;
      while (noeud !== null && noeud !== element) {
        x += noeud.offsetLeft;
        y += noeud.offsetTop;
        noeud = noeud.offsetParent as HTMLElement | null;
      }
      element.style.setProperty('--ind-x', `${x}px`);
      element.style.setProperty('--ind-y', `${y}px`);
      element.style.setProperty('--ind-l', `${cible.offsetWidth}px`);
      element.style.setProperty('--ind-h', `${cible.offsetHeight}px`);
      element.style.setProperty('--ind-o', '1');
    };
    placer();
    const image = requestAnimationFrame(() => element.setAttribute('data-pret', ''));
    const observateur = new ResizeObserver(placer);
    observateur.observe(element);
    return () => {
      cancelAnimationFrame(image);
      observateur.disconnect();
    };
  }, [actif]);
  return conteneur;
}
