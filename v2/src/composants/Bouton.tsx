import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Bouton.module.css';

export type VarianteDeBouton = 'principal' | 'voile' | 'discret' | 'texte' | 'danger';

export interface AllureDeBouton {
  variante?: VarianteDeBouton;
  grand?: boolean;
  /** Bouton carré qui ne contient qu'une icône : `aria-label` obligatoire. */
  carre?: boolean;
}

/** Les classes d'un bouton, pour donner la même allure à un lien (`<Lien className={classeBouton()}>`). */
export function classeBouton({ variante = 'discret', grand = false, carre = false }: AllureDeBouton = {}, autres = ''): string {
  return [styles.bouton, styles[variante], grand ? styles.grand : '', carre ? styles.carre : '', autres].filter(Boolean).join(' ');
}

type Proprietes = ButtonHTMLAttributes<HTMLButtonElement> & AllureDeBouton & { children: ReactNode };

export function Bouton({ variante, grand, carre, className, type = 'button', ...reste }: Proprietes) {
  const allure: AllureDeBouton = {
    ...(variante === undefined ? {} : { variante }),
    ...(grand === undefined ? {} : { grand }),
    ...(carre === undefined ? {} : { carre }),
  };
  return <button {...reste} type={type} className={classeBouton(allure, className)} />;
}

/** Petit cercle qui tourne, pour une action en cours dans un bouton. */
export function Attente({ taille = 18 }: { taille?: number }) {
  return (
    <svg aria-hidden="true" className={styles.tourne} viewBox="0 0 24 24" width={taille} height={taille} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ flex: 'none' }}>
      <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />
    </svg>
  );
}
