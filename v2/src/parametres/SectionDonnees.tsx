import { useState } from 'react';
import type { EtatApp, Parametres } from '../../contrat/types';
import { Attente, Bouton } from '../composants/Bouton';
import { Dialogue } from '../composants/Dialogue';
import { ReglageOuiNon } from '../composants/Formulaire';
import { Icone } from '../composants/Icone';
import { Carte, Section } from './Bloc';
import { coeur } from '../coeur';
import { modifierLesParametres, tenter } from '../etat/application';
import { useTexte } from '../i18n/react';
import { ACCUEIL, naviguer } from '../navigation';
import { SOURCES_EN_LIGNE } from './logique';
import styles from './Parametres.module.css';

export function SectionDonnees({ etat, parametres }: { etat: EtatApp; parametres: Parametres }) {
  const { t } = useTexte();
  const [confirmer, setConfirmer] = useState(false);
  const [effacement, setEffacement] = useState(false);
  // Effacer pendant une partie couperait la session en cours sans l'enregistrer.
  const enJeu = etat.session_en_cours !== null;

  const toutEffacer = async () => {
    setEffacement(true);
    const ok = await tenter(() => coeur.tout_effacer());
    setEffacement(false);
    if (!ok) return;
    setConfirmer(false);
    // Le cœur repasse au premier lancement : l'accueil remplace l'application. On quitte aussi
    // l'adresse des paramètres pour que la fin de l'accueil mène à la bibliothèque, pas ici.
    naviguer(ACCUEIL, { remplacer: true });
  };

  return (
    <>
      <Section titre={t('parametres.sources.titre')} texte={t('parametres.sources.texte')}>
        <Carte>
          {SOURCES_EN_LIGNE.map((source) => (
            <ReglageOuiNon
              key={source}
              nom={t(`parametres.source.${source}`)}
              aide={
                <>
                  {t(`parametres.source.${source}.perte`)}
                  {etat.sources_coupees.includes(source) && (
                    <span className={styles.enPause}>
                      <Icone nom="horloge" taille={16} />
                      <span>{t('parametres.source.en_pause')}</span>
                    </span>
                  )}
                </>
              }
              actif={parametres.sources_en_ligne[source]}
              onChanger={(actif) => void modifierLesParametres((p) => ({ ...p, sources_en_ligne: { ...p.sources_en_ligne, [source]: actif } }))}
            />
          ))}
        </Carte>
      </Section>

      <Section titre={t('parametres.vie_privee.titre')}>
        <Carte>
          <ReglageOuiNon
            nom={t('parametres.secrets')}
            aide={t('parametres.secrets.aide')}
            actif={parametres.reveler_les_succes_secrets}
            onChanger={(actif) => void modifierLesParametres((p) => ({ ...p, reveler_les_succes_secrets: actif }))}
          />
          <ReglageOuiNon
            nom={t('parametres.plantage')}
            aide={parametres.rapports_de_plantage ? t('parametres.plantage.actif') : t('parametres.plantage.inactif')}
            actif={parametres.rapports_de_plantage}
            onChanger={(actif) => void modifierLesParametres((p) => ({ ...p, rapports_de_plantage: actif }))}
          />
        </Carte>
      </Section>

      <Section titre={t('parametres.effacer.titre')}>
        <div className={styles.zoneDanger}>
          <div>
            <p className={styles.sousTitre}>{t('parametres.effacer')}</p>
            <p className={styles.discret}>{enJeu ? t('parametres.effacer.mode_jeu') : t('parametres.effacer.aide')}</p>
          </div>
          <Bouton variante="danger" aria-disabled={enJeu} onClick={() => enJeu || setConfirmer(true)}>
            <Icone nom="poubelle" taille={18} />
            {t('parametres.effacer')}
          </Bouton>
        </div>
      </Section>

      <Dialogue
        ouvert={confirmer}
        onFermer={() => setConfirmer(false)}
        titre={t('parametres.effacer.confirmer.titre')}
        pied={
          <>
            <Bouton onClick={() => setConfirmer(false)}>{t('commun.annuler')}</Bouton>
            <Bouton variante="danger" aria-disabled={effacement} onClick={() => void (effacement || toutEffacer())}>
              {effacement && <Attente />}
              {effacement ? t('parametres.effacer.en_cours') : t('parametres.effacer')}
            </Bouton>
          </>
        }
      >
        <p>{t('parametres.effacer.confirmer.texte')}</p>
        <ul className={styles.puces}>
          <li>{t('parametres.effacer.cle')}</li>
          <li>{t('parametres.effacer.cache')}</li>
          <li>{t('parametres.effacer.favoris')}</li>
          <li>{t('parametres.effacer.manuels')}</li>
          <li>{t('parametres.effacer.sessions')}</li>
          <li>{t('parametres.effacer.reglages')}</li>
        </ul>
        <p className={styles.discret}>{t('parametres.effacer.intacts')}</p>
      </Dialogue>
    </>
  );
}
