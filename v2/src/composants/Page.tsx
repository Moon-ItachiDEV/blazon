import type { ReactNode } from 'react';
import { useTexte } from '../i18n/react';
import { revenir } from '../navigation';
import { classeBouton } from './Bouton';
import { Icone } from './Icone';
import styles from './Page.module.css';

interface Proprietes {
  titre: string;
  /** Ligne sous le titre : un compteur, une précision. */
  sousTitre?: ReactNode;
  /** Boutons à droite du titre. */
  actions?: ReactNode;
  /** Affiche le bouton Retour au-dessus du titre (écrans ouverts depuis un autre écran). */
  retour?: boolean;
  /** Colonne étroite (880 px) pour les textes et les réglages ; pleine largeur sinon. */
  etroite?: boolean;
  children: ReactNode;
}

/** Écran sans affiche : Actualités, Amis, Profil, Paramètres, Succès d'un jeu, Ajout d'un jeu. */
export function Page({ titre, sousTitre, actions, retour = false, etroite = false, children }: Proprietes) {
  const { t } = useTexte();
  return (
    <div className={`cascade ${styles.page} ${etroite ? styles.etroite : ''}`}>
      {retour && (
        <button type="button" className={classeBouton({}, styles.retour)} onClick={revenir}>
          <Icone nom="retour" taille={18} />
          {t('commun.retour')}
        </button>
      )}
      <header className={styles.entete}>
        <div>
          <h1 className={styles.titre}>{titre}</h1>
          {sousTitre !== undefined && <p className={styles.sousTitre}>{sousTitre}</p>}
        </div>
        {actions !== undefined && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** Partie d'un écran, avec son titre de section et une phrase d'explication facultative. */
export function Section({ titre, texte, children }: { titre: string; texte?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className="titre-section">{titre}</h2>
      {texte !== undefined && <p className={styles.sectionTexte}>{texte}</p>}
      {children}
    </section>
  );
}

/** Bloc sur fond de surface, pour regrouper des lignes de réglage ou une courte liste. */
export function Carte({ children }: { children: ReactNode }) {
  return <div className={styles.carte}>{children}</div>;
}
