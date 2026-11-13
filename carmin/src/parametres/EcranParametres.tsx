import type { EtatApp, Parametres } from '../../contrat/types';
import { Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Page } from '../composants/Page';
import { useApplication } from '../etat/application';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { SECTIONS_PARAMETRES, type SectionParametres } from '../navigation/routes';
import { explicationDesJeuxPossedes } from './logique';
import { SectionAPropos } from './SectionAPropos';
import { SectionBibliotheque } from './SectionBibliotheque';
import { SectionDonnees } from './SectionDonnees';
import { SectionGeneral } from './SectionGeneral';
import { SectionSteam } from './SectionSteam';
import styles from './Parametres.module.css';

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
      <Squelette hauteur="20px" largeur="140px" style={{ display: 'block', marginBottom: 12 }} />
      <Squelette hauteur="124px" rayon="var(--rayon-l)" style={{ display: 'block', marginBottom: 32 }} />
      <Squelette hauteur="20px" largeur="160px" style={{ display: 'block', marginBottom: 12 }} />
      <Squelette hauteur="124px" rayon="var(--rayon-l)" style={{ display: 'block' }} />
    </div>
  );
}

/**
 * Les paramètres : cinq onglets sous le titre, puis une seule colonne de réglages. Chaque réglage
 * s'applique tout de suite, sans bouton Enregistrer.
 */
export function EcranParametres({ section }: { section: SectionParametres }) {
  const { t } = useTexte();
  const etat = useApplication((a) => a.etat);
  const parametres = useApplication((a) => a.parametres);
  // La clé refusée ou le profil privé privent le joueur de données : on le signale sur l'onglet Steam.
  const steamACorriger = etat !== null && (etat.cle === 'refusee' || explicationDesJeuxPossedes(etat.jeux_possedes_erreur) === 'profil_prive');

  return (
    <Page titre={t('coque.parametres')}>
      <nav className={styles.onglets} aria-label={t('parametres.navigation')}>
        {SECTIONS_PARAMETRES.map((cle) => (
          <Lien key={cle} className={styles.onglet} vers={{ ecran: 'parametres', section: cle }} aria-current={cle === section ? 'page' : undefined}>
            {t(`parametres.section.${cle}`)}
            {cle === 'steam' && steamACorriger && (
              <span className={styles.marqueAlerte}>
                <Icone nom="alerte" taille={14} />
                <span className="hors-ecran">{t('parametres.a_corriger')}</span>
              </span>
            )}
          </Lien>
        ))}
      </nav>
      <div className={styles.contenu}>{etat === null || parametres === null ? <Chargement /> : <Contenu section={section} etat={etat} parametres={parametres} />}</div>
    </Page>
  );
}
