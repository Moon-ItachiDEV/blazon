import type { ReactNode } from 'react';
import styles from './Medaille.module.css';

/**
 * L'icône d'un succès, dans un carré arrondi : l'image telle que le jeu l'a dessinée, sans cadre.
 * Verrouillé, il s'éteint. Décorative : le sens est toujours écrit à côté.
 */
export function Medaille({ children, taille = 48, eteinte = false, className = '' }: { children: ReactNode; taille?: number; eteinte?: boolean; className?: string }) {
  return (
    <span className={`${styles.medaille} ${className}`} data-eteinte={eteinte ? '' : undefined} style={{ width: taille, height: taille }} aria-hidden="true">
      {children}
    </span>
  );
}
