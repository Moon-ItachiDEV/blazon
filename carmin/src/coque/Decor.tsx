import { useEffect, type CSSProperties } from 'react';
import { useState } from 'react';
import { ambiance, imageAmbiance } from '../etat/ambiance';
import { useApplication } from '../etat/application';
import { useMagasin } from '../etat/magasin';
import { useRoute } from '../navigation';
import styles from './Decor.module.css';

/**
 * Le fond vivant, fixe derrière tous les écrans : la trame, deux lumières à la couleur du jeu qui
 * dérivent lentement et une lumière d'accent. Purement décoratif, et dessiné en une seule couche.
 */
export function Decor() {
  const couleur = useMagasin(ambiance, (c) => c);
  const image = useMagasin(imageAmbiance, (i) => i);
  // La fresque est franche sur les écrans d'un jeu (bibliothèque, fiche, succès), discrète ailleurs.
  const ecran = useRoute().ecran;
  const fresque = ecran === 'bibliotheque' || ecran === 'jeu' || ecran === 'succes' ? 'franche' : 'discrete';
  // L'image précédente reste dessous le temps du fondu : le fond ne repasse jamais par le vide.
  const [images, setImages] = useState<string[]>([]);
  if (image !== null && images[images.length - 1] !== image) setImages([...images.slice(-1), image]);

  // Pendant une partie, ou quand la fenêtre n'est plus devant, tout ce qui bouge sans raison se fige :
  // le launcher ne prend rien au jeu ni à ce que le joueur fait ailleurs.
  const enPartie = useApplication((a) => a.etat?.session_en_cours != null);
  useEffect(() => {
    const regler = () => {
      if (enPartie || document.hidden || !document.hasFocus()) document.documentElement.dataset.ambiance = 'figee';
      else delete document.documentElement.dataset.ambiance;
    };
    regler();
    window.addEventListener('focus', regler);
    window.addEventListener('blur', regler);
    document.addEventListener('visibilitychange', regler);
    return () => {
      window.removeEventListener('focus', regler);
      window.removeEventListener('blur', regler);
      document.removeEventListener('visibilitychange', regler);
    };
  }, [enPartie]);
  const style = couleur === null ? undefined : ({ '--couleur-ambiance': couleur } as CSSProperties);
  return (
    <div className={styles.decor} style={style} aria-hidden="true">
      {/* La fresque : l'image du jeu, immense, floue et saturée. Immobile : elle ne coûte qu'au changement de jeu. */}
      <div className={styles.fresque} data-fresque={fresque}>
        {images.map((src, rang) => (
          <img
            key={src}
            src={src}
            alt=""
            decoding="async"
            onAnimationEnd={rang === images.length - 1 && images.length > 1 ? () => setImages([src]) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
