import { useId } from 'react';
import { useTexte } from '../i18n/react';
import styles from './Marque.module.css';

/**
 * Le sigle seul : le blason C1 (deux chevrons dans un écu, dégradé violet-rose), choisi par le propriétaire
 * le 12/11/2026. Décoratif : le nom est donné par ce qui l'entoure. `--taille-sigle` le grandit.
 */
export function Sigle({ className = '' }: { className?: string }) {
  // Les dégradés d'un SVG sont nommés dans toute la page : un nom par sigle affiché.
  const id = `sigle-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const degrade = `url(#${id})`;
  return (
    <span className={`${styles.sigle} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" width="100%" height="100%">
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" className={styles.rose} />
            <stop offset="1" className={styles.violet} />
          </linearGradient>
        </defs>
        <path className={styles.ecu} d="M60 7 L104 22 V58 C104 84 86 101 60 113 C34 101 16 84 16 58 V22 Z" stroke={degrade} strokeWidth="6" strokeLinejoin="round" />
        <path className={styles.reflet} d="M60 18 L94 30 V40" fill="none" strokeWidth="2" />
        <polyline className={styles.chevron} points="36,80 60,58 84,80" fill="none" stroke={degrade} strokeWidth="11" strokeLinejoin="miter" />
        <polyline className={styles.chevron2} points="40,56 60,38 80,56" fill="none" stroke={degrade} strokeWidth="9" strokeOpacity="0.7" strokeLinejoin="miter" />
        <polygon className={styles.gemme} points="60,22 64,30 60,34 56,30" />
      </svg>
    </span>
  );
}

/** Le sigle et le nom de l'application. `classeDuNom` permet à la barre de cacher le nom quand elle manque de place. */
export function Marque({ classeDuNom = '' }: { classeDuNom?: string }) {
  const { t } = useTexte();
  return (
    <span className={styles.marque}>
      <Sigle />
      <span className={`${styles.nom} ${classeDuNom}`}>{t('app.nom')}</span>
    </span>
  );
}
