import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTexte } from '../i18n/react';
import { Icone } from './Icone';
import styles from './Dialogue.module.css';

/** Ouvre et ferme un `<dialog>` selon `ouvert`. `showModal` retient le focus et gère Échap. */
function useModale(ouvert: boolean) {
  const reference = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = reference.current;
    if (element === null) return;
    if (ouvert && !element.open) element.showModal();
    else if (!ouvert && element.open) element.close();
  }, [ouvert]);
  return reference;
}

interface Proprietes {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  large?: boolean;
  /** Boutons du bas (Annuler, Confirmer…). */
  pied?: ReactNode;
  children: ReactNode;
}

export function Dialogue({ ouvert, onFermer, titre, large = false, pied, children }: Proprietes) {
  const { t } = useTexte();
  const reference = useModale(ouvert);
  const idTitre = useId();
  return (
    <dialog
      ref={reference}
      className={`${styles.dialogue} ${large ? styles.large : ''}`}
      aria-labelledby={idTitre}
      onClose={onFermer}
      onClick={(evenement) => {
        if (evenement.target === reference.current) onFermer();
      }}
    >
      <div className={styles.entete}>
        <h2 id={idTitre} className={styles.titre}>
          {titre}
        </h2>
        <button type="button" className={styles.fermer} aria-label={t('commun.fermer')} onClick={onFermer}>
          <Icone nom="fermer" />
        </button>
      </div>
      {/* Le contenu n'existe que fenêtre ouverte : pas d'image ni de champ chargés pour rien. */}
      {ouvert && <div className={styles.corps}>{children}</div>}
      {ouvert && pied !== undefined && <div className={styles.pied}>{pied}</div>}
    </dialog>
  );
}

interface ProprietesDeVisionneuse {
  images: { src: string; alt: string }[];
  /** Indice de l'image ouverte, ou null si la visionneuse est fermée. */
  ouverte: number | null;
  onFermer: () => void;
}

/** Captures en plein écran. Flèches gauche et droite pour passer de l'une à l'autre. */
export function Visionneuse({ images, ouverte, onFermer }: ProprietesDeVisionneuse) {
  const { t } = useTexte();
  const reference = useModale(ouverte !== null);
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    if (ouverte !== null) setIndice(ouverte);
  }, [ouverte]);
  const image = images[indice];
  const aller = (pas: number) => setIndice((actuel) => (actuel + pas + images.length) % images.length);
  return (
    <dialog
      ref={reference}
      className={styles.visionneuse}
      aria-label={t('visionneuse.titre')}
      onClose={onFermer}
      onKeyDown={(evenement) => {
        if (evenement.key === 'ArrowRight') aller(1);
        else if (evenement.key === 'ArrowLeft') aller(-1);
      }}
    >
      {ouverte !== null && image !== undefined && (
        <>
          <div className={styles.visionneuseHaut}>
            <span className="chiffres" aria-live="polite">
              {t('visionneuse.position', { n: indice + 1, total: images.length })}
            </span>
            <button type="button" className={styles.fermer} aria-label={t('commun.fermer')} onClick={onFermer}>
              <Icone nom="fermer" />
            </button>
          </div>
          <button type="button" className={`${styles.fleche} ${styles.flecheGauche}`} aria-label={t('visionneuse.precedente')} onClick={() => aller(-1)}>
            <Icone nom="chevron_droit" />
          </button>
          <img src={image.src} alt={image.alt} />
          <button type="button" className={styles.fleche} aria-label={t('visionneuse.suivante')} onClick={() => aller(1)}>
            <Icone nom="chevron_droit" />
          </button>
        </>
      )}
    </dialog>
  );
}
