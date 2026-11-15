import { useEffect, useState, type CSSProperties } from 'react';
import { disponible } from '../artefact/images';
import { ambiance, imageAmbiance } from '../etat/ambiance';
import { useMagasin } from '../etat/magasin';
import styles from './Fond.module.css';

interface Couche {
  cle: number;
  src: string;
}

/**
 * L'art du jeu affiché, très flou et teinté. Quand le jeu change, la nouvelle image se pose en fondu
 * sur l'ancienne, qui disparaît une fois recouverte. Deux couches au plus.
 */
export function ArtFlou({ className = '' }: { className?: string | undefined }) {
  const image = useMagasin(imageAmbiance, (i) => i);
  const [couches, setCouches] = useState<Couche[]>([]);
  useEffect(() => {
    if (!disponible(image)) return;
    setCouches((avant) => {
      if (avant.at(-1)?.src === image) return avant;
      return [...avant.slice(-1), { cle: (avant.at(-1)?.cle ?? 0) + 1, src: image }];
    });
  }, [image]);
  return (
    <div className={`${styles.art} ${className}`} aria-hidden="true">
      {couches.map((c) => (
        <img key={c.cle} src={c.src} alt="" draggable={false} decoding="async" />
      ))}
    </div>
  );
}

/** Pose la couleur d'ambiance sur la racine : la fenêtre, le halo et le fond la suivent en transition. */
export function useCouleurAmbiance(): void {
  const couleur = useMagasin(ambiance, (c) => c);
  useEffect(() => {
    if (couleur !== null) document.documentElement.style.setProperty('--ambiance', couleur);
  }, [couleur]);
}

/**
 * Le fond de la page, sous la fenêtre flottante : un dégradé ardoise-bleu profond, l'art du jeu courant
 * flouté à l'extrême, et trois fines courbes blanches qui ondulent lentement (Dribbble 08).
 */
export function Fond() {
  useCouleurAmbiance();
  return (
    <div className={styles.fond} aria-hidden="true">
      <ArtFlou className={styles.artPage} />
      <div className={styles.halo} />
      {/* Deux nappes de lumière (la couleur du jeu, le bleu de l'app) qui dérivent lentement, comme une aurore. */}
      <div className={styles.aurore}>
        <span />
        <span />
        <span />
      </div>
      {/* Une poussière de lumière qui monte doucement : l'air de la pièce. */}
      <div className={styles.poussiere}>
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <svg className={styles.courbes} viewBox="0 0 1440 900" preserveAspectRatio="none">
        <path className={styles.courbe1} d="M-60 720 C 220 520, 420 860, 720 640 S 1180 380, 1500 520" />
        <path className={styles.courbe2} d="M-60 260 C 180 120, 360 420, 640 300 S 1080 80, 1500 220" />
        <path className={styles.courbe3} d="M-60 880 C 300 760, 560 980, 900 820 S 1300 700, 1500 780" />
      </svg>
      <div className={styles.grain} />
    </div>
  );
}
