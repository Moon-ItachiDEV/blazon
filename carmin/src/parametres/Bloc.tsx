import type { ReactNode } from 'react';
import styles from './Parametres.module.css';

/** Une partie d'une section de réglages : son titre, une phrase d'explication facultative, puis le contenu. */
export function Section({ titre, texte, children }: { titre: string; texte?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitre}>{titre}</h2>
      {texte !== undefined && <p className={styles.sectionTexte}>{texte}</p>}
      {children}
    </section>
  );
}

/**
 * Une carte de réglages : une surface unie, des lignes séparées par un filet.
 * `apercu` : une bande au-dessus des lignes, qui montre tout de suite l'effet du réglage.
 */
export function Carte({ apercu, children }: { apercu?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.carte}>
      {apercu !== undefined && apercu !== null && <div className={styles.apercu}>{apercu}</div>}
      <div className={styles.carteCorps}>{children}</div>
    </div>
  );
}
