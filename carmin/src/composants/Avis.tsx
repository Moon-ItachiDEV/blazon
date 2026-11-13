import { useEffect } from 'react';
import { fermerLAvis, useApplication, type Avis as UnAvis } from '../etat/application';
import { useTexte } from '../i18n/react';
import { iconeDErreur } from './Etats';
import { Icone } from './Icone';
import styles from './Avis.module.css';

const DUREE_MS = 7000;

function UnMessage({ avis }: { avis: UnAvis }) {
  const { t, te } = useTexte();
  // Le message s'efface seul. Sept secondes : le temps de lire une phrase sans se presser.
  useEffect(() => {
    const minuterie = setTimeout(() => fermerLAvis(avis.id), DUREE_MS);
    return () => clearTimeout(minuterie);
  }, [avis.id]);
  return (
    <div className={styles.avis}>
      <Icone nom={iconeDErreur(avis.erreur)} />
      <span className={styles.texte}>{te(avis.erreur)}</span>
      <button type="button" className={styles.fermer} aria-label={t('commun.fermer')} onClick={() => fermerLAvis(avis.id)}>
        <Icone nom="fermer" taille={18} />
      </button>
    </div>
  );
}

/** La zone existe toujours dans la page : un lecteur d'écran annonce ce qui y apparaît. */
export function PileDAvis() {
  const avis = useApplication((a) => a.avis);
  return (
    <div className={styles.pile} role="alert" aria-live="assertive">
      {avis.map((unAvis) => (
        <UnMessage key={unAvis.id} avis={unAvis} />
      ))}
    </div>
  );
}
