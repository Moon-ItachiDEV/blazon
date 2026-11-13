import type { Succes } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { Medaille } from '../fiche/Medaille';
import { formaterDateComplete, formaterPart } from '../formats';
import { useTexte } from '../i18n/react';
import { estCache, rarete } from './logique';
import styles from './Succes.module.css';

interface Proprietes {
  succes: Succes;
  /** Réglage du joueur : montrer le texte des succès secrets. */
  reveler: boolean;
  /** Vrai dans un aperçu : chaque texte tient sur une ligne. */
  compacte?: boolean;
}

/** Un succès : son icône, son nom, sa description et son état. Verrouillé, il passe en retrait. */
export function CarteSucces({ succes, reveler, compacte = false }: Proprietes) {
  const { t, langue } = useTexte();
  const cache = estCache(succes, reveler);
  const acquis = succes.debloque === true;
  const niveau = rarete(succes);
  const etat: string[] = [];
  if (acquis) {
    etat.push(succes.debloque_le === null ? t('succes.debloque') : t('succes.debloque_le', { date: formaterDateComplete(succes.debloque_le, langue) }));
  } else if (succes.debloque === false) {
    etat.push(t('succes.pas_encore'));
  }
  if (succes.pct_mondial !== null) etat.push(t('succes.part_des_joueurs', { part: formaterPart(succes.pct_mondial, langue) }));

  return (
    <li className={`${styles.carte} ${acquis ? styles.acquis : ''} ${compacte ? styles.compacte : ''}`} data-rarete={niveau ?? undefined}>
      <Medaille taille={48} eteinte={!acquis}>
        {cache ? <Icone nom="cadenas" taille={20} /> : <img src={acquis ? succes.icone : succes.icone_grise} alt="" width={48} height={48} loading="lazy" decoding="async" />}
      </Medaille>
      <div className={styles.corps}>
        <div className={styles.nom}>{cache ? t('succes.secret') : succes.nom}</div>
        <div className={styles.description}>{cache ? t('succes.secret_texte') : (succes.description ?? '')}</div>
        {etat.length > 0 && <div className={styles.etat}>{etat.join(' · ')}</div>}
      </div>
      {niveau !== null && !compacte && <span className={styles.rarete}>{t(`succes.rarete.${niveau}`)}</span>}
    </li>
  );
}

/** Barre de progression des succès, avec son équivalent en texte pour les lecteurs d'écran. */
export function BarreDeSucces({ debloques, total }: { debloques: number; total: number }) {
  const { tp } = useTexte();
  const part = total === 0 ? 0 : debloques / total;
  return (
    <div className={styles.barre} role="img" aria-label={tp('succes.progression', debloques, { total })}>
      <span style={{ transform: `scaleX(${part})` }} />
    </div>
  );
}
