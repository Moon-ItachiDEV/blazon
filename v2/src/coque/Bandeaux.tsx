import type { ReactNode } from 'react';
import { Icone, type NomDIcone } from '../composants/Icone';
import { coeur } from '../coeur';
import { tenter, useApplication } from '../etat/application';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import styles from './Coque.module.css';

function Bandeau({ icone, calme = false, children, action }: { icone: NomDIcone; calme?: boolean; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${styles.bandeau} ${calme ? styles.calme : ''}`}>
      <Icone nom={icone} taille={18} />
      <span className={styles.bandeauTexte}>{children}</span>
      {action}
    </div>
  );
}

/**
 * Ce que l'application doit dire au joueur quel que soit l'écran : une partie en cours, pas de
 * réseau, une clé refusée, une source en pause, un scan, une mise à jour. Rien à dire : rien d'affiché.
 */
export function Bandeaux() {
  const { t, tp } = useTexte();
  const etat = useApplication((a) => a.etat);
  const scan = useApplication((a) => a.scan);
  const jeux = useApplication((a) => a.jeux);
  if (etat === null) return null;

  const session = etat.session_en_cours;
  const titreEnCours = session === null ? null : (jeux?.find((jeu) => jeu.id === session.id_jeu)?.titre ?? null);
  const maj = etat.mise_a_jour;

  return (
    <div role="status">
      {session !== null && (
        <Bandeau icone="manette" calme>
          {titreEnCours === null ? t('bandeau.en_jeu_sans_titre') : t('bandeau.en_jeu', { titre: titreEnCours })}
        </Bandeau>
      )}
      {!etat.en_ligne && <Bandeau icone="hors_ligne">{t('bandeau.hors_ligne')}</Bandeau>}
      {etat.cle === 'refusee' && (
        <Bandeau
          icone="cle"
          action={
            <Lien className={styles.bandeauAction} vers={{ ecran: 'parametres', section: 'steam' }}>
              {t('bandeau.cle_refusee.action')}
            </Lien>
          }
        >
          {t('bandeau.cle_refusee')}
        </Bandeau>
      )}
      {etat.sources_coupees.length > 0 && (
        <Bandeau icone="horloge">
          {t('bandeau.sources_coupees', { sources: etat.sources_coupees.map((source) => t(`sources_en_ligne.${source}`)).join(', ') })}
        </Bandeau>
      )}
      {(etat.scan.en_cours || scan !== null) && !etat.premier_lancement && (
        <Bandeau icone="rafraichir" calme>
          {tp('bandeau.scan', scan?.jeux_trouves ?? etat.scan.jeux_trouves)}
        </Bandeau>
      )}
      {maj !== null && maj.etape === 'disponible' && (
        <Bandeau
          icone="telechargement"
          calme
          action={
            <button type="button" className={styles.bandeauAction} onClick={() => void tenter(() => coeur.installer_la_mise_a_jour())}>
              {t('bandeau.maj.installer')}
            </button>
          }
        >
          {t('bandeau.maj.disponible', { version: maj.version })}
        </Bandeau>
      )}
      {maj !== null && maj.etape === 'telechargement' && (
        <Bandeau icone="telechargement" calme>
          {t('bandeau.maj.telechargement', { version: maj.version, pct: maj.progression_pct ?? 0 })}
        </Bandeau>
      )}
      {maj !== null && maj.etape === 'prete' && (
        <Bandeau icone="coche" calme>
          {t('bandeau.maj.prete', { version: maj.version })}
        </Bandeau>
      )}
    </div>
  );
}
