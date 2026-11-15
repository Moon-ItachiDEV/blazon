import { useMemo, useState, type CSSProperties } from 'react';
import type { EtatApp, MiseAJour, NiveauDonnees } from '../../contrat/types';
import { Attente, Bouton } from '../composants/Bouton';
import { Icone } from '../composants/Icone';
import { Sigle } from '../composants/Marque';
import { NombreAnime } from '../composants/NombreAnime';
import { Section } from './Bloc';
import { coeur } from '../coeur';
import { tenter, useApplication } from '../etat/application';
import { formaterNombre, formaterPourcentage } from '../formats';
import { useTexte } from '../i18n/react';
import { BlocDEtat } from './BlocDEtat';
import { progressionDeLaMiseAJour } from './logique';
import styles from './Parametres.module.css';

const NIVEAUX: NiveauDonnees[] = ['local', 'public', 'personnel'];

function EtatDeLaMiseAJour({ maj }: { maj: MiseAJour | null }) {
  const { t, langue } = useTexte();
  const [demande, setDemande] = useState(false);

  if (maj === null) return <BlocDEtat icone="coche" ton="ok" titre={t('parametres.maj.aucune')} />;

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
              {demande ? <Attente /> : <Icone nom="telechargement" taille={18} />}
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

/** Combien de jaquettes forment le mur derrière le logo. */
const MUR = 9;

/**
 * L'en-tête de la section : le logo en néon qui respire devant un mur de jaquettes de la bibliothèque,
 * le nom, la version et quelques chiffres qui comptent jusqu'à leur valeur.
 */
function Vitrine({ etat }: { etat: EtatApp }) {
  const { t, langue } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const mur = useMemo(() => (jeux ?? []).filter((jeu) => jeu.jaquette !== null && !jeu.masque && jeu.installe).slice(0, MUR), [jeux]);
  const nombre = (valeur: number) => formaterNombre(valeur, langue);
  const chiffres: [string, number][] = [
    [t('pied.jeux'), jeux?.filter((jeu) => !jeu.masque).length ?? 0],
    [t('pied.installes'), jeux?.filter((jeu) => jeu.installe).length ?? 0],
  ];
  return (
    <div className={styles.vitrine}>
      <ul className={styles.mur} aria-hidden="true">
        {mur.map((jeu, index) => (
          <li key={jeu.id} style={{ '--i': index } as CSSProperties}>
            {jeu.jaquette !== null && <img src={jeu.jaquette} alt="" width={300} height={450} loading="lazy" decoding="async" draggable={false} />}
          </li>
        ))}
      </ul>
      <span className={styles.murVoile} aria-hidden="true" />
      <div className={styles.neon} aria-hidden="true">
        <span className={styles.neonHalo} />
        <span className={styles.neonAnneau} />
        <Sigle className={styles.neonSigle ?? ''} />
      </div>
      <div className={styles.vitrineTexte}>
        <h2 className={styles.vitrineNom}>{t('app.nom')}</h2>
        <p className={styles.vitrineSlogan}>{t('parametres.a_propos.slogan')}</p>
        <p className={styles.vitrineVersion}>
          <span className="chiffres">{t('parametres.version', { version: etat.version })}</span>
        </p>
        <dl className={styles.vitrineChiffres}>
          {chiffres.map(([nom, valeur]) => (
            <div key={nom}>
              <dt>{nom}</dt>
              <dd className="chiffres">
                <NombreAnime valeur={valeur} format={nombre} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function SectionAPropos({ etat }: { etat: EtatApp }) {
  const { t } = useTexte();
  return (
    <>
      <section className={styles.section}>
        <Vitrine etat={etat} />
        <p className={`${styles.discret} ${styles.valve}`}>{t('parametres.valve')}</p>
      </section>

      <Section titre={t('parametres.maj.titre')}>
        <EtatDeLaMiseAJour maj={etat.mise_a_jour} />
      </Section>

      <Section titre={t('parametres.niveau.titre')} texte={t('parametres.niveau.texte')}>
        <ul className={styles.niveaux}>
          {NIVEAUX.map((niveau) => {
            const actuel = niveau === etat.niveau;
            return (
              <li key={niveau} className={styles.niveau} aria-current={actuel ? 'true' : undefined}>
                <p className={styles.niveauNom}>
                  {t(`parametres.niveau.${niveau}`)}
                  {actuel && <span className={styles.etiquette}>{t('parametres.niveau.actuel')}</span>}
                </p>
                <p>{t(`parametres.niveau.${niveau}.texte`)}</p>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
