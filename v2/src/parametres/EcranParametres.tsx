import type { EtatApp, Parametres } from '../../contrat/types';
import { Squelette } from '../composants/Etats';
import { Icone, type NomDIcone } from '../composants/Icone';
import { Sigle } from '../composants/Marque';
import { Page } from '../composants/Page';
import { suiviDeListe } from '../composants/pointeur';
import { useApplication } from '../etat/application';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import type { SectionParametres } from '../navigation/routes';
import { useIndicateur } from './indicateur';
import { explicationDesJeuxPossedes } from './logique';
import { SectionAPropos } from './SectionAPropos';
import { SectionBibliotheque } from './SectionBibliotheque';
import { SectionDonnees } from './SectionDonnees';
import { SectionGeneral } from './SectionGeneral';
import { SectionSteam } from './SectionSteam';
import styles from './Parametres.module.css';

const ICONES: Record<SectionParametres, NomDIcone> = {
  general: 'reglages',
  steam: 'cle',
  bibliotheque: 'grille',
  donnees: 'cadenas',
  a_propos: 'info',
};

const ORDRE: SectionParametres[] = ['general', 'steam', 'bibliotheque', 'donnees', 'a_propos'];

function Contenu({ section, etat, parametres }: { section: SectionParametres; etat: EtatApp; parametres: Parametres }) {
  switch (section) {
    case 'general':
      return <SectionGeneral parametres={parametres} />;
    case 'steam':
      return <SectionSteam etat={etat} />;
    case 'bibliotheque':
      return <SectionBibliotheque etat={etat} parametres={parametres} />;
    case 'donnees':
      return <SectionDonnees etat={etat} parametres={parametres} />;
    case 'a_propos':
      return <SectionAPropos etat={etat} />;
  }
}

function Chargement() {
  const { t } = useTexte();
  return (
    <div role="status" aria-label={t('commun.chargement')}>
      <Squelette hauteur="24px" largeur="180px" style={{ display: 'block', marginBottom: 14 }} />
      <Squelette hauteur="200px" rayon="var(--rayon-l)" style={{ display: 'block', marginBottom: 40 }} />
      <Squelette hauteur="24px" largeur="220px" style={{ display: 'block', marginBottom: 14 }} />
      <Squelette hauteur="140px" rayon="var(--rayon-l)" style={{ display: 'block' }} />
    </div>
  );
}

/** Un reflet suit le pointeur sur la carte de réglages survolée. */
const suiviDesCartes = suiviDeListe('[data-carte]');

/** Les paramètres : une navigation entre cinq sections, et chaque réglage s'applique sans bouton Enregistrer. */
export function EcranParametres({ section }: { section: SectionParametres }) {
  const { t } = useTexte();
  const etat = useApplication((a) => a.etat);
  const parametres = useApplication((a) => a.parametres);
  // La clé refusée ou le profil privé privent le joueur de données : on le signale dans la navigation.
  const liste = useIndicateur<HTMLUListElement>(section);
  const steamACorriger = etat !== null && (etat.cle === 'refusee' || explicationDesJeuxPossedes(etat.jeux_possedes_erreur) === 'profil_prive');

  return (
    <Page titre={t('coque.parametres')}>
      <div className={styles.cadre}>
        <nav className={styles.navigation} aria-label={t('parametres.navigation')}>
          <ul ref={liste} className={styles.sections}>
            {/* La pastille de verre glisse jusqu'à la section ouverte. */}
            <li className={styles.indicateur} aria-hidden="true" />
            {ORDRE.map((cle) => (
              <li key={cle}>
                <Lien
                  className={styles.lienSection}
                  vers={{ ecran: 'parametres', section: cle }}
                  aria-current={cle === section ? 'page' : undefined}
                  data-actif={cle === section ? '' : undefined}
                >
                  <span className={styles.lienIcone}>
                    <Icone nom={ICONES[cle]} taille={20} />
                  </span>
                  <span className={styles.lienTexte}>{t(`parametres.section.${cle}`)}</span>
                  {cle === 'steam' && steamACorriger && (
                    <span className={styles.marqueAlerte}>
                      <Icone nom="alerte" taille={18} />
                      <span className="hors-ecran">{t('parametres.a_corriger')}</span>
                    </span>
                  )}
                </Lien>
              </li>
            ))}
          </ul>
          <p className={styles.signature}>
            <Sigle className={styles.signatureSigle ?? ''} />
            <span>
              <span className={styles.signatureNom}>{t('app.nom')}</span>
              {etat !== null && <span className={`${styles.signatureVersion} chiffres`}>{etat.version}</span>}
            </span>
          </p>
        </nav>
        {/* Changer de section rejoue l'entrée en cascade : la clé recrée le contenu. */}
        <div key={section} className={`cascade ${styles.contenu}`} {...suiviDesCartes}>
          {etat === null || parametres === null ? <Chargement /> : <Contenu section={section} etat={etat} parametres={parametres} />}
        </div>
      </div>
    </Page>
  );
}
