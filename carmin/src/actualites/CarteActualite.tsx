import type { Actualite } from '../../contrat/types';
import { useMaintenant } from '../etat/maintenant';
import { formaterDate } from '../formats';
import { useTexte } from '../i18n/react';
import styles from './Actualites.module.css';

interface Proprietes {
  actualite: Actualite;
  /** Titre du jeu, affiché dans le fil global où les annonces de tous les jeux se mêlent. */
  jeu?: string;
  /** Vrai dans le fil global : vignette et résumé. Faux dans la fiche d'un jeu : la place est comptée. */
  detaillee?: boolean;
  onOuvrir: (actualite: Actualite) => void;
}

/** Étiquettes d'une annonce : son type, sa langue si ce n'est pas celle de l'interface, sa date. */
export function Etiquettes({ actualite, jeu }: { actualite: Actualite; jeu?: string }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  return (
    <div className={styles.etiquettes}>
      {jeu !== undefined && <span className={styles.jeu}>{jeu}</span>}
      <span className={styles.type}>{t(`actualite.type.${actualite.type}`)}</span>
      {/* Toutes les annonces ne sont pas traduites : on prévient avant le clic. */}
      {actualite.langue !== langue && actualite.langue !== 'autre' && (
        <span className={styles.langue} title={t(`langue.${actualite.langue}`)}>
          {actualite.langue}
        </span>
      )}
      <span>{formaterDate(actualite.date, langue, maintenant)}</span>
    </div>
  );
}

export function CarteActualite({ actualite, jeu, detaillee = false, onOuvrir }: Proprietes) {
  return (
    <button type="button" className={styles.carte} onClick={() => onOuvrir(actualite)}>
      {detaillee && actualite.image !== null && <img className={styles.vignette} src={actualite.image} alt="" loading="lazy" decoding="async" />}
      <span className={styles.corps}>
        <Etiquettes actualite={actualite} {...(jeu === undefined ? {} : { jeu })} />
        <span className={styles.titre} style={{ display: 'block' }}>
          {actualite.titre}
        </span>
        {detaillee && (
          <span className={styles.resume}>
            {actualite.resume}
          </span>
        )}
      </span>
    </button>
  );
}
