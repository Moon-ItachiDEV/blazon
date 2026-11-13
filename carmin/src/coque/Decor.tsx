import type { CSSProperties } from 'react';
import { ambiance } from '../etat/ambiance';
import { useMagasin } from '../etat/magasin';
import styles from './Decor.module.css';

/**
 * Le fond de l'application, fixe derrière tous les écrans : un noir profond, une lumière carmin qui
 * monte du bas à gauche et un souffle de la couleur du jeu en haut. Purement décoratif, immobile, et
 * dessiné en une seule couche opaque : il ne coûte rien quand la page défile.
 */
export function Decor() {
  const couleur = useMagasin(ambiance, (c) => c);
  const style = couleur === null ? undefined : ({ '--couleur-ambiance': couleur } as CSSProperties);
  return <div className={styles.decor} style={style} aria-hidden="true" />;
}
