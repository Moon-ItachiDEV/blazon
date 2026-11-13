import { useId, type ReactNode } from 'react';
import styles from './Medaille.module.css';

/**
 * Une médaille ronde au liseré dégradé (carmin-framboise ; Carmin remplace l'hexagone par le cercle), avec un contenu au centre :
 * une icône, une image de succès. Décorative : le sens est toujours écrit à côté.
 */
export function Medaille({ children, taille = 52, eteinte = false, className = '' }: { children: ReactNode; taille?: number; eteinte?: boolean; className?: string }) {
  const id = useId();
  return (
    <span className={`${styles.medaille} ${className}`} data-eteinte={eteinte ? '' : undefined} style={{ width: taille, height: taille }} aria-hidden="true">
      <svg className={styles.cadre} viewBox="0 0 52 52">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className={styles.arret1} />
            <stop offset="0.5" className={styles.arret2} />
            <stop offset="1" className={styles.arret3} />
          </linearGradient>
        </defs>
        <circle className={styles.fond} cx="26" cy="26" r="24" />
        <circle className={styles.trait} cx="26" cy="26" r="24" stroke={`url(#${id})`} />
      </svg>
      <span className={styles.centre}>{children}</span>
    </span>
  );
}
