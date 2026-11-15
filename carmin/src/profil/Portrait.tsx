import type { CSSProperties } from 'react';
import type { StatutAmi } from '../../contrat/types';
import { Avatar } from './Avatar';
import styles from './Portrait.module.css';

interface Proprietes {
  image: string | null;
  pseudo: string;
  statut: StatutAmi;
  /** Côté de l'avatar en pixels, sans son anneau (8 px de plus en tout). */
  taille: number;
}

/**
 * L'avatar d'un ami et son statut : une pastille verte quand il joue (avec un anneau au dégradé d'accent),
 * cyan en ligne, ambre absent, rouge occupé, grise hors ligne. La couleur ne dit rien toute seule : le
 * statut est toujours écrit à côté. Un ami hors ligne est éteint.
 */
export function Portrait({ image, pseudo, statut, taille }: Proprietes) {
  return (
    <span className={styles.portrait} data-statut={statut} style={{ '--taille': `${taille}px` } as CSSProperties}>
      <Avatar image={image} pseudo={pseudo} taille={taille} />
    </span>
  );
}
