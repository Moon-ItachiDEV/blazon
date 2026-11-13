import { useState, type CSSProperties } from 'react';
import type { Actualite, JeuResume } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { useMaintenant } from '../etat/maintenant';
import { formaterDate } from '../formats';
import { useTexte } from '../i18n/react';
import type { NouvellesDUnJeu } from './logique';
import styles from './Magazine.module.css';

interface ProprietesCarte {
  actualite: Actualite;
  jeu: JeuResume | undefined;
  /** Sur la première carte d'un jour : « Hier », « Il y a 2 jours »… */
  jour?: string;
  onOuvrir: (actualite: Actualite) => void;
}

/**
 * Une carte du fil : l'image de l'annonce en tête (à défaut, la jaquette du jeu sur sa couleur),
 * puis son type et sa date, le jeu, le titre et deux lignes de résumé. Toutes les cartes ont la même forme.
 */
export function CarteMagazine({ actualite, jeu, jour, onOuvrir }: ProprietesCarte) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  // Une image d'annonce qui ne se charge pas laisse la place à la jaquette du jeu.
  const [echec, setEchec] = useState(false);
  const image = echec ? null : actualite.image;
  return (
    <li className={styles.case}>
      {jour !== undefined && <span className={styles.jour}>{jour}</span>}
      <button type="button" className={styles.carte} style={{ '--couleur-carte': jeu?.couleur_dominante ?? undefined } as CSSProperties} onClick={() => onOuvrir(actualite)}>
        <span className={styles.visuel} aria-hidden="true">
          {image !== null ? (
            <img className={styles.photo} src={image} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setEchec(true)} />
          ) : (
            jeu !== undefined && (
              <span className={styles.petiteJaquette}>
                <Jaquette jeu={jeu} />
              </span>
            )
          )}
        </span>
        <span className={styles.corps}>
          <span className={styles.ligne}>
            <span>{t(`actualite.type.${actualite.type}`)}</span>
            <span>{formaterDate(actualite.date, langue, maintenant)}</span>
            {actualite.langue !== langue && actualite.langue !== 'autre' && <span className={styles.langue}>{actualite.langue}</span>}
          </span>
          {jeu !== undefined && <span className={styles.nomDuJeu}>{jeu.titre}</span>}
          <span className={styles.titreCarte}>{actualite.titre}</span>
          {actualite.resume !== '' && <span className={styles.resumeCarte}>{actualite.resume}</span>}
        </span>
      </button>
    </li>
  );
}

interface ProprietesRuban {
  jeux: readonly NouvellesDUnJeu[];
  jeuDe: (id_jeu: number) => JeuResume | undefined;
  choisi: number | null;
  onChoisir: (id_jeu: number | null) => void;
}

/** Le ruban « Par jeu » : les jaquettes des jeux qui ont des nouvelles, et leur nombre. Un clic filtre le fil. */
export function RubanParJeu({ jeux, jeuDe, choisi, onChoisir }: ProprietesRuban) {
  const { t, tp } = useTexte();
  return (
    <section className={styles.ruban} aria-labelledby="actualites-par-jeu">
      <h2 id="actualites-par-jeu" className="titre-section">
        {t('actualites.par_jeu')}
      </h2>
      <ul className={styles.piste}>
        <li>
          <button type="button" className={styles.tous} aria-pressed={choisi === null} onClick={() => onChoisir(null)}>
            <Icone nom="grille" taille={20} />
            <span>{t('actualites.par_jeu.tous')}</span>
          </button>
        </li>
        {jeux.map((nouvelles) => {
          const jeu = jeuDe(nouvelles.id_jeu);
          if (jeu === undefined) return null;
          const actif = choisi === nouvelles.id_jeu;
          return (
            <li key={nouvelles.id_jeu}>
              <button type="button" className={styles.jeuDuRuban} aria-pressed={actif} onClick={() => onChoisir(actif ? null : nouvelles.id_jeu)}>
                <span className={styles.couverture}>
                  <Jaquette jeu={jeu} />
                  <span className={`${styles.compte} chiffres`} aria-hidden="true">
                    {nouvelles.nombre}
                  </span>
                </span>
                <span className={styles.nomRuban}>{jeu.titre}</span>
                <span className="hors-ecran">{tp('actualites.par_jeu.nombre', nouvelles.nombre)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
