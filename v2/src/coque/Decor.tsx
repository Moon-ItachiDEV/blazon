import { useEffect } from 'react';
import { useApplication } from '../etat/application';

/**
 * V2 : le fond est un anthracite uni ; l'interface reste neutre et seules les images portent la
 * couleur (aucune teinte tirée du jeu, qui pourrait être orange). `Decor` ne dessine donc plus rien :
 * il ne fait que figer ce qui bouge sans raison pendant une partie, ou quand la fenêtre n'est plus devant.
 */
export function Decor() {
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
  return null;
}
