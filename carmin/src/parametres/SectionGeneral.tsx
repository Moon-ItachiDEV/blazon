import type { CSSProperties } from 'react';
import type { Parametres } from '../../contrat/types';
import { LigneDeReglage, ReglageOuiNon, Segments } from '../composants/Formulaire';
import { Carte, Section } from './Bloc';
import { modifierLesParametres } from '../etat/application';
import { useTexte } from '../i18n/react';
import styles from './Parametres.module.css';

/**
 * Ce que change le réglage Animations, montré tout de suite : des ondes au dégradé du logo qui
 * battent, une orbite et un reflet qui passe. Tout suit les jetons de durée : quand les animations
 * sont coupées, la bande se fige d'elle-même.
 */
function ApercuDesAnimations() {
  const { t } = useTexte();
  return (
    <div className={styles.apercuAnimations} aria-hidden="true">
      <span className={styles.apercuEtiquette}>
        <span className={styles.apercuPoint} />
        {t('parametres.animations.apercu')}
      </span>
      <span className={styles.ondes}>
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} style={{ '--i': index } as CSSProperties} />
        ))}
      </span>
      <span className={styles.orbite}>
        <span />
      </span>
    </div>
  );
}

export function SectionGeneral({ parametres }: { parametres: Parametres }) {
  const { t } = useTexte();
  return (
    <>
      <Section titre={t('parametres.interface')}>
        <Carte apercu={<ApercuDesAnimations />}>
          <LigneDeReglage nom={t('parametres.langue')} aide={t('parametres.langue.aide')}>
            {/* Chaque langue est écrite dans sa propre langue : on la retrouve même si l'on ne lit pas l'autre. */}
            <Segments
              nom={t('parametres.langue')}
              valeur={parametres.langue}
              options={[
                { valeur: 'fr', libelle: t('parametres.langue.fr') },
                { valeur: 'en', libelle: t('parametres.langue.en') },
              ]}
              onChanger={(langue) => void modifierLesParametres((p) => ({ ...p, langue }))}
            />
          </LigneDeReglage>
          <LigneDeReglage nom={t('parametres.animations')} aide={t('parametres.animations.aide')}>
            <Segments
              nom={t('parametres.animations')}
              valeur={parametres.animations}
              options={[
                { valeur: 'systeme', libelle: t('parametres.animations.systeme') },
                { valeur: 'activees', libelle: t('parametres.animations.activees') },
                { valeur: 'desactivees', libelle: t('parametres.animations.desactivees') },
              ]}
              onChanger={(animations) => void modifierLesParametres((p) => ({ ...p, animations }))}
            />
          </LigneDeReglage>
        </Carte>
      </Section>

      <Section titre={t('parametres.demarrage')}>
        <Carte>
          <ReglageOuiNon
            nom={t('parametres.demarrer_avec_windows')}
            aide={t('parametres.demarrer_avec_windows.aide')}
            actif={parametres.demarrer_avec_windows}
            onChanger={(actif) => void modifierLesParametres((p) => ({ ...p, demarrer_avec_windows: actif }))}
          />
          <ReglageOuiNon
            nom={t('parametres.zone_de_notification')}
            aide={t('parametres.zone_de_notification.aide')}
            actif={parametres.reduire_dans_la_zone_de_notification}
            onChanger={(actif) => void modifierLesParametres((p) => ({ ...p, reduire_dans_la_zone_de_notification: actif }))}
          />
        </Carte>
      </Section>
    </>
  );
}
