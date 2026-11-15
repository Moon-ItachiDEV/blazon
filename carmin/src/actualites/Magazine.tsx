import type { CSSProperties } from 'react';
import type { Actualite, JeuResume } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { useMaintenant } from '../etat/maintenant';
import { formaterDate } from '../formats';
import { useTexte } from '../i18n/react';
import type { NouvellesDUnJeu } from './logique';
import { BadgeDeType } from './Une';
import styles from './Magazine.module.css';

export type Format = 'grande' | 'normale' | 'texte';

/**
 * Le format d'une carte dans la grille d'un jour : une grande toutes les neuf cartes (quand elle a une
 * image), la carte « texte » quand il n'y en a pas (la jaquette du jeu prend la place de l'image).
 */
export function formatDeCarte(actualite: Actualite, rang: number): Format {
  if (actualite.image === null) return 'texte';
  return rang % 9 === 2 ? 'grande' : 'normale';
}

interface ProprietesCarte {
  actualite: Actualite;
  jeu: JeuResume | undefined;
  format: Format;
  /** Place dans l'entrée en cascade. */
  rang: number;
  /** Sur la première carte d'un jour : « Hier », « Il y a 2 jours »… */
  jour?: string;
  onOuvrir: (actualite: Actualite) => void;
}

/** Une carte du fil, façon magazine de console : l'image en tête, le jeu en vignette, le badge du type. */
export function CarteMagazine({ actualite, jeu, format, rang, jour, onOuvrir }: ProprietesCarte) {
  const { langue } = useTexte();
  const maintenant = useMaintenant();
  const style = { '--rang': rang, '--couleur-carte': jeu?.couleur_dominante ?? undefined } as CSSProperties;
  return (
    <li className={styles.case} data-format={format} style={style}>
      {jour !== undefined && <span className={styles.onglet}>{jour}</span>}
      <button type="button" className={styles.carte} data-carte="" onClick={() => onOuvrir(actualite)}>
        <span className={styles.visuel} aria-hidden="true">
          {actualite.image !== null ? (
            <img className={styles.photo} src={actualite.image} alt="" loading="lazy" decoding="async" draggable={false} />
          ) : (
            jeu?.jaquette != null && <img className={styles.flou} src={jeu.jaquette} alt="" loading="lazy" decoding="async" draggable={false} />
          )}
        </span>
        {jeu !== undefined && (
          <span className={styles.vignette} aria-hidden="true">
            <Jaquette jeu={jeu} />
          </span>
        )}
        <span className={styles.corps}>
          <span className={styles.ligne}>
            <BadgeDeType type={actualite.type} />
            {actualite.langue !== langue && actualite.langue !== 'autre' && <span className={styles.langue}>{actualite.langue}</span>}
            <span className={styles.date}>{formaterDate(actualite.date, langue, maintenant)}</span>
          </span>
          {jeu !== undefined && <span className={styles.nomDuJeu}>{jeu.titre}</span>}
          <span className={styles.titreCarte}>{actualite.titre}</span>
          {actualite.resume !== '' && <span className={styles.resumeCarte}>{actualite.resume}</span>}
        </span>
        <span className={styles.lire} aria-hidden="true">
          <Icone nom="chevron_droit" taille={18} />
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
      <ul className={`cascade ${styles.piste}`}>
        <li>
          <button type="button" className={styles.tous} aria-pressed={choisi === null} onClick={() => onChoisir(null)}>
            <Icone nom="grille" taille={26} />
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
