import { useState, type CSSProperties } from 'react';
import type { Actualite, JeuResume } from '../../contrat/types';
import { classeBouton } from '../composants/Bouton';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { useMaintenant } from '../etat/maintenant';
import { formaterDate } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import styles from './Magazine.module.css';

interface ProprietesUne {
  actualite: Actualite;
  jeu: JeuResume | undefined;
  onOuvrir: (actualite: Actualite) => void;
}

/** La une : la dernière grande annonce, sur son image. Rien ne bouge : un titre, un résumé, deux actions. */
export function Une({ actualite, jeu, onOuvrir }: ProprietesUne) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  // Une image d'annonce qui ne se charge pas (adresse morte, hors ligne) laisse la place à la jaquette du jeu.
  const [echec, setEchec] = useState(false);
  const image = echec ? null : actualite.image;
  const faits = [t('actualites.une'), t(`actualite.type.${actualite.type}`), ...(jeu === undefined ? [] : [jeu.titre]), formaterDate(actualite.date, langue, maintenant)];
  return (
    <article className={styles.une} style={{ '--couleur-une': jeu?.couleur_dominante ?? undefined } as CSSProperties}>
      {image !== null && (
        <div className={styles.uneFond} aria-hidden="true">
          <img src={image} alt="" decoding="async" draggable={false} onError={() => setEchec(true)} />
        </div>
      )}
      <div className={styles.uneTexte}>
        <p className={styles.uneFaits}>
          {faits.map((fait) => (
            <span key={fait}>{fait}</span>
          ))}
          {actualite.langue !== langue && actualite.langue !== 'autre' && <span className={styles.langue}>{actualite.langue}</span>}
        </p>
        <h2 className={styles.uneTitre}>
          <button type="button" onClick={() => onOuvrir(actualite)}>
            {actualite.titre}
          </button>
        </h2>
        {actualite.resume !== '' && <p className={styles.uneResume}>{actualite.resume}</p>}
        <div className={styles.uneActions}>
          <button type="button" className={classeBouton({ variante: 'principal' })} onClick={() => onOuvrir(actualite)}>
            {t('actualites.lire')}
          </button>
          {jeu !== undefined && (
            <Lien className={classeBouton({ variante: 'voile' })} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
              {t('actualites.voir_le_jeu')}
              <Icone nom="chevron_droit" taille={16} />
            </Lien>
          )}
        </div>
      </div>
      {/* Sans image d'annonce, la jaquette du jeu tient la droite de la carte. */}
      {image === null && jeu !== undefined && (
        <span className={styles.uneJaquette} aria-hidden="true">
          <Jaquette jeu={jeu} prioritaire />
        </span>
      )}
    </article>
  );
}
