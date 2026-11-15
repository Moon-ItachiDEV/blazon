import { useEffect, useRef } from 'react';
import { indiceApresRetrait } from './logique';

/**
 * Quand on retire une ligne d'une liste (dossier, jeu masqué), son bouton disparaît et le focus
 * clavier retomberait au début de la page. On le pose sur le bouton de la ligne suivante, ou sur
 * l'élément que donne `repli` quand la liste est vide. Les boutons concernés portent `data-retrait`.
 */
export function useFocusApresRetrait(nombre: number, repli: () => HTMLElement | null | undefined) {
  const liste = useRef<HTMLUListElement>(null);
  const retire = useRef<number | null>(null);
  const seRabattre = useRef(repli);
  seRabattre.current = repli;

  useEffect(() => {
    const indice = retire.current;
    if (indice === null) return;
    retire.current = null;
    const boutons = liste.current?.querySelectorAll<HTMLButtonElement>('[data-retrait]') ?? [];
    const cible = indiceApresRetrait(indice, boutons.length);
    if (cible >= 0) boutons[cible]?.focus();
    else seRabattre.current()?.focus();
  }, [nombre]);

  return {
    liste,
    /** À appeler au clic, avec la position de la ligne retirée. */
    noterLeRetrait: (indice: number) => {
      retire.current = indice;
    },
  };
}
