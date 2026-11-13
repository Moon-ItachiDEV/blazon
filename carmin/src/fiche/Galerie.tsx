import { useEffect, useRef, useState } from 'react';
import type { Capture } from '../../contrat/types';
import { Visionneuse } from '../composants/Dialogue';
import { Icone } from '../composants/Icone';
import { useTexte } from '../i18n/react';
import { animationsActives } from '../navigation';
import styles from './Galerie.module.css';

/**
 * La galerie de captures : une grande image, une bande de miniatures sous elle. Survoler ou choisir
 * une miniature la montre en grand ; cliquer la grande image ouvre la visionneuse. Rien ne défile seul.
 */
export function Galerie({ captures, titre }: { captures: Capture[]; titre: string }) {
  const { t } = useTexte();
  const [courante, setCourante] = useState(0);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const bande = useRef<HTMLUListElement>(null);

  // La miniature active reste en vue dans la bande, sans faire défiler la page.
  useEffect(() => {
    const liste = bande.current;
    const element = liste?.children[courante] as HTMLElement | undefined;
    if (liste === null || element === undefined) return;
    liste.scrollTo({ left: element.offsetLeft - liste.clientWidth / 2 + element.clientWidth / 2, behavior: animationsActives() ? 'smooth' : 'auto' });
  }, [courante]);

  const aller = (pas: number) => setCourante((i) => (i + pas + captures.length) % captures.length);
  const image = captures[Math.min(courante, captures.length - 1)];
  if (image === undefined) return null;

  return (
    <div className={styles.galerie}>
      <div className={styles.scene}>
        <button type="button" className={styles.grande} aria-label={t('fiche.agrandir_la_capture', { n: courante + 1 })} onClick={() => setOuverte(courante)}>
          {/* Une seule grande image dans la page : celle qu'on regarde. Elle arrive en fondu sur la précédente. */}
          <img key={image.pleine} src={image.pleine} alt="" decoding="async" className={styles.image} />
        </button>
        {captures.length > 1 && (
          <>
            <span className={`chiffres ${styles.position}`}>{t('fiche.galerie.position', { n: courante + 1, total: captures.length })}</span>
            <div className={styles.fleches}>
              <button type="button" className={`${styles.fleche} ${styles.inverse}`} aria-label={t('visionneuse.precedente')} onClick={() => aller(-1)}>
                <Icone nom="chevron_droit" taille={16} />
              </button>
              <button type="button" className={styles.fleche} aria-label={t('visionneuse.suivante')} onClick={() => aller(1)}>
                <Icone nom="chevron_droit" taille={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {captures.length > 1 && (
        <ul ref={bande} className={styles.bande} aria-label={t('fiche.galerie.miniatures')}>
          {captures.map((capture, index) => (
            <li key={capture.miniature} className={styles.case}>
              <button
                type="button"
                className={styles.miniature}
                aria-label={t('fiche.agrandir_la_capture', { n: index + 1 })}
                aria-current={index === courante ? 'true' : undefined}
                onPointerEnter={(evenement) => {
                  if (evenement.pointerType === 'mouse') setCourante(index);
                }}
                onClick={() => {
                  setCourante(index);
                  setOuverte(index);
                }}
              >
                <img src={capture.miniature} alt="" loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Visionneuse images={captures.map((capture, index) => ({ src: capture.pleine, alt: t('fiche.capture', { n: index + 1, titre }) }))} ouverte={ouverte} onFermer={() => setOuverte(null)} />
    </div>
  );
}
