import { useState, type CSSProperties } from 'react';
import { Icone } from '../composants/Icone';
import styles from './Avatar.module.css';

interface Proprietes {
  image: string | null;
  /** Sert à l'initiale quand il n'y a pas d'image. null = on ne le connaît pas. */
  pseudo: string | null;
  /** Côté en pixels. */
  taille: number;
}

/**
 * Avatar rond. Il est décoratif : le pseudo est toujours écrit à côté, donc `alt=""`.
 * Sans image (ou si elle ne charge pas), un rond avec l'initiale ; sans pseudo, une silhouette.
 */
export function Avatar({ image, pseudo, taille }: Proprietes) {
  const [echec, setEchec] = useState(false);
  const style = { '--taille': `${taille}px` } as CSSProperties;
  if (image !== null && !echec) {
    return <img className={styles.avatar} style={style} src={image} alt="" width={taille} height={taille} loading="lazy" decoding="async" draggable={false} onError={() => setEchec(true)} />;
  }
  // Le premier caractère entier : un pseudo peut commencer par un emoji ou une lettre accentuée.
  const initiale = pseudo === null ? undefined : [...pseudo.trim()][0]?.toLocaleUpperCase();
  return (
    <span className={`${styles.avatar} ${styles.initiale}`} style={style} aria-hidden="true">
      {initiale === undefined ? <Icone nom="utilisateur" taille={Math.round(taille * 0.5)} /> : initiale}
    </span>
  );
}
