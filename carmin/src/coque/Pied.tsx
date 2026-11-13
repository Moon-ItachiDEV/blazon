import { NombreAnime } from '../composants/NombreAnime';
import { useApplication, useLangue } from '../etat/application';
import { formaterNombre } from '../formats';
import { useTexte } from '../i18n/react';
import styles from './Pied.module.css';

/**
 * La barre d'état, en bas de la fenêtre : la connexion, l'analyse en cours, puis quelques chiffres
 * de la bibliothèque. Elle ferme le cadre de l'application, comme dans un client de jeu.
 */
export function Pied({ amisEnJeu }: { amisEnJeu: number | null }) {
  const { t } = useTexte();
  const langue = useLangue();
  const enLigne = useApplication((a) => a.etat?.en_ligne ?? true);
  const version = useApplication((a) => a.etat?.version ?? null);
  const analyse = useApplication((a) => a.scan !== null);
  const total = useApplication((a) => a.jeux?.filter((jeu) => !jeu.masque).length ?? null);
  const installes = useApplication((a) => a.jeux?.filter((jeu) => jeu.installe && !jeu.masque).length ?? null);
  const nombre = (valeur: number) => formaterNombre(valeur, langue);

  return (
    <footer className={styles.pied} aria-label={t('pied.nom')}>
      <p className={styles.etat} data-etat={enLigne ? 'en_ligne' : 'hors_ligne'}>
        <span className={styles.voyant} aria-hidden="true" />
        {t(enLigne ? 'pied.en_ligne' : 'pied.hors_ligne')}
      </p>
      {analyse && <p className={styles.analyse}>{t('pied.analyse')}</p>}
      <dl className={styles.chiffres}>
        {total !== null && (
          <div>
            <dt>{t('pied.jeux')}</dt>
            <dd className="chiffres">
              <NombreAnime valeur={total} format={nombre} />
            </dd>
          </div>
        )}
        {installes !== null && (
          <div>
            <dt>{t('pied.installes')}</dt>
            <dd className="chiffres">
              <NombreAnime valeur={installes} format={nombre} />
            </dd>
          </div>
        )}
        {amisEnJeu !== null && (
          <div>
            <dt>{t('pied.amis_en_jeu')}</dt>
            <dd className="chiffres">
              <NombreAnime valeur={amisEnJeu} format={nombre} />
            </dd>
          </div>
        )}
        {version !== null && (
          <div>
            <dt>{t('pied.version')}</dt>
            <dd className="chiffres">{version}</dd>
          </div>
        )}
      </dl>
    </footer>
  );
}
