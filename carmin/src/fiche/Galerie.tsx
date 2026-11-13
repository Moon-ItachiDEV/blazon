import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Capture } from '../../contrat/types';
import { Visionneuse } from '../composants/Dialogue';
import { Icone } from '../composants/Icone';
import { useTexte } from '../i18n/react';
import { animationsActives } from '../navigation';
import styles from './Galerie.module.css';

/** Temps passé sur chaque capture quand la galerie défile seule. */
const PAUSE_MS = 6000;

/**
 * La galerie de captures : une grande image qui défile seule (fondu et lent zoom), une bande de
 * miniatures sous elle. Survoler une miniature la montre en grand ; cliquer ouvre la visionneuse.
 * Le défilement s'arrête sous le pointeur, quand la visionneuse est ouverte ou les animations coupées.
 */
export function Galerie({ captures, titre }: { captures: Capture[]; titre: string }) {
  const { t } = useTexte();
  const [courante, setCourante] = useState(0);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [arret, setArret] = useState(false);
  const bande = useRef<HTMLUListElement>(null);
  const defile = captures.length > 1 && animationsActives();

  useEffect(() => {
    if (!defile || arret || ouverte !== null) return;
    const minuteur = window.setTimeout(() => setCourante((i) => (i + 1) % captures.length), PAUSE_MS);
    return () => window.clearTimeout(minuteur);
  }, [courante, arret, ouverte, defile, captures.length]);

  // La miniature active reste en vue dans la bande, sans faire défiler la page.
  useEffect(() => {
    const liste = bande.current;
    const element = liste?.children[courante] as HTMLElement | undefined;
    if (liste === null || element === undefined) return;
    liste.scrollTo({ left: element.offsetLeft - liste.clientWidth / 2 + element.clientWidth / 2, behavior: animationsActives() ? 'smooth' : 'auto' });
  }, [courante]);

  const aller = (pas: number) => setCourante((i) => (i + pas + captures.length) % captures.length);

  return (
    <div className={styles.galerie} onPointerEnter={() => setArret(true)} onPointerLeave={() => setArret(false)} onFocus={() => setArret(true)} onBlur={() => setArret(false)}>
      <div className={styles.scene}>
        <button type="button" className={styles.grande} aria-label={t('fiche.agrandir_la_capture', { n: courante + 1 })} onClick={() => setOuverte(courante)}>
          {captures.map((image, index) => (
            <img
              key={image.pleine}
              src={image.pleine}
              alt=""
              decoding="async"
              loading={index === 0 ? 'eager' : 'lazy'}
              className={styles.image}
              data-active={index === courante ? '' : undefined}
            />
          ))}
          <span className={styles.voile} aria-hidden="true" />
          <span className={styles.agrandir} aria-hidden="true">
            <Icone nom="plus" taille={20} />
          </span>
        </button>
        <span className={`chiffres ${styles.position}`}>{t('fiche.galerie.position', { n: courante + 1, total: captures.length })}</span>
        {captures.length > 1 && (
          <div className={styles.fleches}>
            <button type="button" className={`${styles.fleche} ${styles.inverse}`} aria-label={t('visionneuse.precedente')} onClick={() => aller(-1)}>
              <Icone nom="chevron_droit" taille={18} />
            </button>
            <button type="button" className={styles.fleche} aria-label={t('visionneuse.suivante')} onClick={() => aller(1)}>
              <Icone nom="chevron_droit" taille={18} />
            </button>
          </div>
        )}
      </div>

      {captures.length > 1 && (
        <ul ref={bande} className={styles.bande} aria-label={t('fiche.galerie.miniatures')}>
          {captures.map((image, index) => (
            <li key={image.miniature} className={styles.case} style={{ '--rang': index } as CSSProperties}>
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
                <img src={image.miniature} alt="" loading="lazy" decoding="async" />
                {index === courante && defile && !arret && <span key={courante} className={styles.minuteur} style={{ '--pause': `${PAUSE_MS}ms` } as CSSProperties} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Visionneuse images={captures.map((image, index) => ({ src: image.pleine, alt: t('fiche.capture', { n: index + 1, titre }) }))} ouverte={ouverte} onFermer={() => setOuverte(null)} />
    </div>
  );
}
