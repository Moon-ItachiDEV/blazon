import { useEffect, useRef, useState } from 'react';
import { valeurAuTemps } from './compte';

/** Durée du compte, lue dans le thème : zéro quand les animations sont coupées. */
function dureeDuCompte(): number {
  const brute = getComputedStyle(document.documentElement).getPropertyValue('--duree-compte');
  const ms = Number.parseFloat(brute);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Un nombre qui compte jusqu'à sa valeur quand il arrive à l'écran, puis d'une valeur à l'autre.
 * `format` l'écrit (« 72 h », « 1 980 »). Les lecteurs d'écran ne reçoivent que la valeur finale.
 */
export function NombreAnime({ valeur, format }: { valeur: number; format: (valeur: number) => string }) {
  const [affichee, setAffichee] = useState(0);
  const depart = useRef(0);

  useEffect(() => {
    const duree = dureeDuCompte();
    if (duree === 0) {
      depart.current = valeur;
      setAffichee(valeur);
      return;
    }
    const debut = depart.current;
    const t0 = performance.now();
    let image = 0;
    const avancer = (maintenant: number) => {
      const t = (maintenant - t0) / duree;
      const courante = valeurAuTemps(debut, valeur, t);
      depart.current = courante;
      setAffichee(courante);
      if (t < 1) image = requestAnimationFrame(avancer);
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, [valeur]);

  return (
    <>
      <span aria-hidden="true">{format(affichee)}</span>
      <span className="hors-ecran">{format(valeur)}</span>
    </>
  );
}
