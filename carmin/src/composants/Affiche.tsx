import { useState, type ReactNode } from 'react';
import { useAmbiance } from '../etat/ambiance';
import { couleurDeJeu } from './couleur';
import styles from './Affiche.module.css';

interface Proprietes {
  /** Couleur dominante du jeu : fond de l'affiche tant que l'image n'est pas là, ou s'il n'y en a pas. */
  couleur: string | null;
  image: string | null;
  /** Ce qui occupe le haut de l'affiche (bouton Retour de la fiche). */
  haut?: ReactNode;
  /** Ce qui occupe le bas à droite (l'encart de la fiche). */
  cote?: ReactNode;
  /** Identifiant du titre, pour nommer la section. */
  idDuTitre: string;
  /** Change quand le jeu change : le panneau d'informations rejoue son apparition. */
  cle: string | number;
  /** Classe ajoutée à la section (taille, marges). */
  className?: string;
  children: ReactNode;
}

/**
 * L'affiche d'un jeu, en haut de sa fiche : son image en bandeau, qui se fond dans la page, et dessus
 * son titre, ses faits et ses actions. L'image est fixe ; elle arrive en fondu, et c'est tout.
 */
export function Affiche({ couleur, image, haut, cote, idDuTitre, cle, className = '', children }: Proprietes) {
  useAmbiance(couleur);

  // D'un jeu à l'autre, l'image précédente reste sous la nouvelle le temps du fondu : jamais de fond nu entre deux.
  const [couches, setCouches] = useState<string[]>(image === null ? [] : [image]);
  const derniere = couches[couches.length - 1];
  if (image !== null && image !== derniere) setCouches([...couches.slice(-1), image]);

  return (
    <section className={`${styles.affiche} ${className}`} {...couleurDeJeu(couleur)} aria-labelledby={idDuTitre}>
      {/* Sans image pour ce jeu, les anciennes s'éteignent et laissent voir sa couleur. */}
      <div className={styles.images} data-eteintes={image === null ? '' : undefined} aria-hidden="true">
        {couches.map((src, rang) => (
          <img
            key={src}
            className={styles.image}
            src={src}
            alt=""
            fetchPriority="high"
            decoding="async"
            onAnimationEnd={rang > 0 && rang === couches.length - 1 ? () => setCouches([src]) : undefined}
          />
        ))}
      </div>
      <div className={styles.contenu}>
        <div className={styles.haut}>{haut}</div>
        <div className={styles.bas}>
          <div key={cle} className={styles.infos}>
            {children}
          </div>
          {cote !== undefined && <div className={styles.cote}>{cote}</div>}
        </div>
      </div>
    </section>
  );
}

/** Une ligne de faits courts (studio, année, source), séparés par un point médian. */
export function LigneDAffiche({ morceaux }: { morceaux: string[] }) {
  return (
    <p className={styles.ligne}>
      {morceaux.map((morceau) => (
        <span key={morceau}>{morceau}</span>
      ))}
    </p>
  );
}

export function ActionsDAffiche({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
