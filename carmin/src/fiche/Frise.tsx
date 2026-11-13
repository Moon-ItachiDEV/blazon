import type { CSSProperties } from 'react';
import type { Session } from '../../contrat/types';
import { useMaintenant } from '../etat/maintenant';
import { formaterDate, formaterDateHeure, formaterDureeDeSession } from '../formats';
import { useTexte } from '../i18n/react';
import styles from './Frise.module.css';

/**
 * Les dernières parties en barres, de la plus ancienne à la plus récente : la hauteur dit la durée.
 * La plus longue et la plus récente portent leur durée, les autres la montrent au survol.
 * Une session en cours est verte.
 */
export function Frise({ sessions }: { sessions: Session[] }) {
  const { t, tp, langue } = useTexte();
  const maintenant = useMaintenant();
  const chronologie = [...sessions].sort((a, b) => a.debut.localeCompare(b.debut)).slice(-12);
  const max = Math.max(60, ...chronologie.map((s) => s.duree_s));
  const total = chronologie.reduce((somme, s) => somme + s.duree_s, 0);
  const indiceMax = chronologie.findIndex((s) => s.duree_s === max);

  return (
    <div className={styles.frise}>
      <div className={styles.resume}>
        <strong className="chiffres">{formaterDureeDeSession(total, langue)}</strong>
        <span>
          {tp('fiche.sessions.total', chronologie.length, { duree: '' }).trim()}
          {chronologie.length > 1 && <> · {t('fiche.sessions.moyenne', { duree: formaterDureeDeSession(total / chronologie.length, langue) })}</>}
        </span>
      </div>
      <ol className={styles.barres} aria-label={t('fiche.sessions.graphique')}>
        {chronologie.map((session, rang) => {
          const duree = session.fin === null ? t('fiche.session_en_cours') : formaterDureeDeSession(session.duree_s, langue);
          const etiquetee = rang === indiceMax || rang === chronologie.length - 1;
          return (
            <li
              key={session.id}
              className={styles.colonne}
              data-en-cours={session.fin === null ? '' : undefined}
              data-etiquetee={etiquetee ? '' : undefined}
              style={{ '--part': Math.max(0.04, session.duree_s / max) } as CSSProperties}
            >
              <span className={styles.bulle} aria-hidden="true">
                {duree}
              </span>
              <span className={styles.barre} aria-hidden="true" />
              <span className={styles.date} aria-hidden="true">
                {formaterDate(session.debut, langue, maintenant)}
              </span>
              <span className="hors-ecran">{t('fiche.sessions.barre', { date: formaterDateHeure(session.debut, langue, maintenant), duree })}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
