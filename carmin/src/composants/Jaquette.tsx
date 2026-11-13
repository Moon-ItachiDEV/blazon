import { memo, useState, type CSSProperties } from 'react';
import type { JeuResume } from '../../contrat/types';
import { useTexte } from '../i18n/react';
import styles from './Jaquette.module.css';

interface Proprietes {
  jeu: Pick<JeuResume, 'titre' | 'jaquette' | 'couleur_dominante' | 'sources' | 'installe'>;
  /** Vrai pour les quelques images visibles dès l'ouverture : elles sont chargées sans attendre. */
  prioritaire?: boolean;
  /** Atténue l'image d'un jeu qui n'est pas installé. */
  estomperSiAbsent?: boolean;
  className?: string;
}

/**
 * La jaquette d'un jeu. Elle est décorative : le titre est porté par le lien ou la carte autour.
 * Si l'image manque ou ne se charge pas (hors ligne, adresse morte), la jaquette est dessinée.
 */
export const Jaquette = memo(function Jaquette({ jeu, prioritaire = false, estomperSiAbsent = false, className = '' }: Proprietes) {
  const { t } = useTexte();
  const [echec, setEchec] = useState(false);
  const source = jeu.sources[0];
  const style = { '--couleur-jaquette': jeu.couleur_dominante ?? undefined } as CSSProperties;
  return (
    <span className={`${styles.jaquette} ${className}`} style={style}>
      {jeu.jaquette !== null && !echec ? (
        <img
          className={`${styles.image} ${estomperSiAbsent && !jeu.installe ? styles.estompee : ''}`}
          src={jeu.jaquette}
          alt=""
          width={300}
          height={450}
          loading={prioritaire ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setEchec(true)}
        />
      ) : (
        <span className={styles.dessinee} aria-hidden="true">
          <span className={styles.titre}>{jeu.titre}</span>
          {source !== undefined && <span className={styles.source}>{t(`sources.${source}`)}</span>}
        </span>
      )}
    </span>
  );
});
