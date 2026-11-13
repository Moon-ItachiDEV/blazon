import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './Parametres.module.css';

interface Proprietes {
  /** Identifiant de l'élément qui nomme le curseur (le nom de la ligne de réglage). */
  nommePar: string;
  min: number;
  max: number;
  pas: number;
  valeur: number;
  /** Valeur lisible, affichée à côté et lue par les lecteurs d'écran (« 180 px »). */
  formater: (valeur: number) => string;
  /** Appelé une fois le geste posé, pas à chaque cran. */
  onValider: (valeur: number) => void;
  /** Appelé à chaque cran, pour un aperçu qui suit le doigt. */
  onGlisser?: (valeur: number) => void;
  delai?: number;
}

/**
 * Curseur `input type="range"` qui suit le doigt tout de suite mais ne prévient l'appelant
 * qu'après un court arrêt : glisser de 120 à 260 px ne fait qu'un seul appel au cœur.
 * Pièce absente de `src/composants` : elle vit ici tant qu'un seul écran s'en sert.
 */
export function Curseur({ nommePar, min, max, pas, valeur, formater, onValider, onGlisser, delai = 250 }: Proprietes) {
  const [locale, setLocale] = useState(valeur);
  const minuterie = useRef<number | null>(null);
  const enAttente = useRef<number | null>(null);
  const valider = useRef(onValider);
  valider.current = onValider;

  // La valeur enregistrée a changé ailleurs (refus du cœur, autre écran) : le curseur la reprend.
  useEffect(() => {
    if (enAttente.current === null) setLocale(valeur);
  }, [valeur]);

  // En quittant l'écran pendant le différé, le dernier réglage n'est pas perdu.
  useEffect(
    () => () => {
      if (minuterie.current !== null) window.clearTimeout(minuterie.current);
      if (enAttente.current !== null) valider.current(enAttente.current);
    },
    [],
  );

  const changer = (suivante: number) => {
    setLocale(suivante);
    onGlisser?.(suivante);
    enAttente.current = suivante;
    if (minuterie.current !== null) window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => {
      minuterie.current = null;
      const aEnvoyer = enAttente.current;
      enAttente.current = null;
      if (aEnvoyer !== null) valider.current(aEnvoyer);
    }, delai);
  };

  const lisible = formater(locale);
  return (
    <div className={styles.curseur} style={{ '--p': `${((locale - min) / (max - min)) * 100}%` } as CSSProperties}>
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={locale}
        aria-labelledby={nommePar}
        aria-valuetext={lisible}
        onChange={(evenement) => changer(Number(evenement.target.value))}
      />
      <output className="chiffres" aria-hidden="true">
        {lisible}
      </output>
    </div>
  );
}
