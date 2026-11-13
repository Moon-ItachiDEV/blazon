import { Fragment, type CSSProperties } from 'react';
import type { Actualite, JeuResume } from '../../contrat/types';
import { classeBouton } from '../composants/Bouton';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { NombreAnime } from '../composants/NombreAnime';
import { useMaintenant } from '../etat/maintenant';
import { formaterDate, formaterNombre } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import styles from './Magazine.module.css';

interface ProprietesUne {
  actualite: Actualite;
  jeu: JeuResume | undefined;
  onOuvrir: (actualite: Actualite) => void;
}

/** Badge du type : cyan pour une mise à jour, au dégradé pour une annonce. */
export function BadgeDeType({ type }: { type: Actualite['type'] }) {
  const { t } = useTexte();
  return (
    <span className={styles.badge} data-type={type}>
      <span className={styles.point} aria-hidden="true" />
      {t(`actualite.type.${type}`)}
    </span>
  );
}

/**
 * La une : la dernière grande annonce en très grand. L'image dérive lentement, le titre se dévoile
 * mot à mot. La clé du composant est l'annonce : changer de filtre rejoue l'entrée.
 */
export function Une({ actualite, jeu, onOuvrir }: ProprietesUne) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const mots = actualite.titre.split(/\s+/).filter((mot) => mot !== '');
  const image = actualite.image ?? jeu?.jaquette ?? null;
  return (
    <article className={styles.une} style={{ '--couleur-une': jeu?.couleur_dominante ?? undefined } as CSSProperties}>
      <div className={styles.uneFond} aria-hidden="true">
        {image !== null && <img className={styles.uneImage} src={image} alt="" decoding="async" draggable={false} />}
      </div>
      <div className={styles.uneVoile} aria-hidden="true" />
      <div className={styles.uneTexte}>
        <p className={styles.uneSurTitre}>
          <span className={styles.direct} aria-hidden="true" />
          {t('actualites.une')}
        </p>
        <div className={styles.uneEtiquettes}>
          <BadgeDeType type={actualite.type} />
          {jeu !== undefined && <span className={styles.pilule}>{jeu.titre}</span>}
          <span className={styles.pilule}>{formaterDate(actualite.date, langue, maintenant)}</span>
          {actualite.langue !== langue && actualite.langue !== 'autre' && <span className={styles.pilule}>{actualite.langue}</span>}
        </div>
        <h2 className={styles.uneTitre}>
          <button type="button" className={styles.uneBouton} onClick={() => onOuvrir(actualite)}>
            {mots.map((mot, i) => (
              <Fragment key={i}>
                <span className={styles.mot}>
                  <span style={{ '--i': i } as CSSProperties}>{mot}</span>
                </span>{' '}
              </Fragment>
            ))}
          </button>
        </h2>
        {actualite.resume !== '' && <p className={styles.uneResume}>{actualite.resume}</p>}
        <div className={styles.uneActions}>
          <button type="button" className={classeBouton({ variante: 'principal' })} onClick={() => onOuvrir(actualite)}>
            <Icone nom="journal" taille={18} />
            {t('actualites.lire')}
          </button>
          {jeu !== undefined && (
            <Lien className={classeBouton({})} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
              {t('actualites.voir_le_jeu')}
              <Icone nom="chevron_droit" taille={16} />
            </Lien>
          )}
        </div>
      </div>
      {jeu !== undefined && (
        <span className={styles.uneJaquette} aria-hidden="true">
          <Jaquette jeu={jeu} prioritaire />
        </span>
      )}
    </article>
  );
}

interface ProprietesCote {
  annonces: readonly Actualite[];
  aussi: readonly Actualite[];
  jeuDe: (id_jeu: number) => JeuResume | undefined;
  onOuvrir: (actualite: Actualite) => void;
}

/** À côté de la une : la carte au dégradé (le fil en chiffres) et trois autres titres. */
export function CoteDeLaUne({ annonces, aussi, jeuDe, onOuvrir }: ProprietesCote) {
  const { t, tp, langue } = useTexte();
  const maintenant = useMaintenant();
  const majs = annonces.filter((a) => a.type === 'mise_a_jour').length;
  const autres = annonces.length - majs;
  const jeux = new Set(annonces.map((a) => a.id_jeu)).size;
  const nombre = (valeur: number) => formaterNombre(valeur, langue);
  return (
    <aside className={styles.cote}>
      <div className={styles.bilan}>
        <p className={styles.bilanTitre}>{t('actualites.bilan.titre')}</p>
        <dl className={styles.bilanChiffres}>
          <div>
            <dd className="chiffres">
              <NombreAnime valeur={majs} format={nombre} />
            </dd>
            <dt>{tp('actualites.bilan.mises_a_jour', majs)}</dt>
          </div>
          <div>
            <dd className="chiffres">
              <NombreAnime valeur={autres} format={nombre} />
            </dd>
            <dt>{tp('actualites.bilan.annonces', autres)}</dt>
          </div>
          <div>
            <dd className="chiffres">
              <NombreAnime valeur={jeux} format={nombre} />
            </dd>
            <dt>{tp('actualites.bilan.jeux', jeux)}</dt>
          </div>
        </dl>
        <p className={styles.bilanTexte}>{t('actualites.bilan.texte')}</p>
      </div>
      {aussi.length > 0 && (
        <div className={styles.aussi}>
          <p className={styles.aussiTitre}>{t('actualites.aussi')}</p>
          <ul className="cascade">
            {aussi.map((annonce) => {
              const jeu = jeuDe(annonce.id_jeu);
              const image = annonce.image ?? jeu?.jaquette ?? null;
              return (
                <li key={annonce.id}>
                  <button type="button" className={styles.aussiCarte} onClick={() => onOuvrir(annonce)}>
                    <span className={styles.aussiImage} aria-hidden="true">
                      {image !== null && <img src={image} alt="" loading="lazy" decoding="async" draggable={false} />}
                    </span>
                    <span className={styles.aussiCorps}>
                      <span className={styles.aussiJeu}>
                        {jeu?.titre ?? t(`actualite.type.${annonce.type}`)} · {formaterDate(annonce.date, langue, maintenant)}
                      </span>
                      <span className={styles.aussiTexte}>{annonce.titre}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
