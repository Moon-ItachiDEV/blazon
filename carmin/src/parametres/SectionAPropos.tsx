import { useState } from 'react';
import type { EtatApp, MiseAJour, NiveauDonnees } from '../../contrat/types';
import { Attente, Bouton } from '../composants/Bouton';
import { Icone } from '../composants/Icone';
import { Sigle } from '../composants/Marque';
import { Carte, Section } from './Bloc';
import { coeur } from '../coeur';
import { tenter } from '../etat/application';
import { formaterPourcentage } from '../formats';
import { useTexte } from '../i18n/react';
import { BlocDEtat } from './BlocDEtat';
import { progressionDeLaMiseAJour } from './logique';
import styles from './Parametres.module.css';

const NIVEAUX: NiveauDonnees[] = ['local', 'public', 'personnel'];

/** Une mise à jour que le cœur annonce : à installer, en cours de téléchargement, ou prête. */
function EtatDeLaMiseAJour({ maj }: { maj: MiseAJour }) {
  const { t, langue } = useTexte();
  const [demande, setDemande] = useState(false);

  switch (maj.etape) {
    case 'disponible':
      return (
        <BlocDEtat icone="telechargement" ton="ok" titre={t('bandeau.maj.disponible', { version: maj.version })}>
          <div className={styles.actions}>
            <Bouton
              variante="principal"
              aria-disabled={demande}
              onClick={async () => {
                if (demande) return;
                setDemande(true);
                await tenter(() => coeur.installer_la_mise_a_jour());
                setDemande(false);
              }}
            >
              {demande ? <Attente taille={16} /> : <Icone nom="telechargement" taille={16} />}
              {t('bandeau.maj.installer')}
            </Bouton>
          </div>
        </BlocDEtat>
      );
    case 'telechargement': {
      const pct = progressionDeLaMiseAJour(maj);
      const lisible = formaterPourcentage(pct, langue);
      return (
        <BlocDEtat icone="telechargement" ton="neutre" titre={t('parametres.maj.telechargement', { version: maj.version })}>
          <div className={styles.progression}>
            <progress max={100} value={pct} aria-label={t('parametres.maj.progression')} aria-valuetext={lisible} />
            <span className="chiffres" aria-hidden="true">
              {lisible}
            </span>
          </div>
        </BlocDEtat>
      );
    }
    case 'prete':
      return <BlocDEtat icone="coche" ton="ok" titre={t('bandeau.maj.prete', { version: maj.version })} />;
  }
}

/** À propos : le blason, le nom et la version ; puis ce que l'application peut savoir, selon la connexion et la clé. */
export function SectionAPropos({ etat }: { etat: EtatApp }) {
  const { t } = useTexte();
  return (
    <>
      <section className={styles.section}>
        <div className={styles.identite}>
          <Sigle />
          <div>
            <h2 className={styles.identiteNom}>{t('app.nom')}</h2>
            <p className={`${styles.identiteVersion} chiffres`}>{t('parametres.version', { version: etat.version })}</p>
          </div>
        </div>
        <p className={styles.valve}>{t('parametres.valve')}</p>
      </section>

      {/* Rien à dire tant que le cœur n'annonce pas de mise à jour : pas de « tout est à jour » invérifiable. */}
      {etat.mise_a_jour !== null && (
        <Section titre={t('parametres.maj.titre')}>
          <EtatDeLaMiseAJour maj={etat.mise_a_jour} />
        </Section>
      )}

      <Section titre={t('parametres.niveau.titre')} texte={t('parametres.niveau.texte')}>
        <Carte>
          <ul>
            {NIVEAUX.map((niveau) => {
              const actuel = niveau === etat.niveau;
              return (
                <li key={niveau} className={styles.niveau} aria-current={actuel ? 'true' : undefined}>
                  <div>
                    <p className={styles.niveauNom}>{t(`parametres.niveau.${niveau}`)}</p>
                    <p className={styles.niveauTexte}>{t(`parametres.niveau.${niveau}.texte`)}</p>
                  </div>
                  {actuel && (
                    <span className={styles.etiquette}>
                      <Icone nom="coche" taille={14} />
                      {t('parametres.niveau.actuel')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Carte>
      </Section>
    </>
  );
}
