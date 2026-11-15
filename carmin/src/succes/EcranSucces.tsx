import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ErreurApp, JeuResume, SuccesDuJeu } from '../../contrat/types';
import { Bouton, classeBouton } from '../composants/Bouton';
import { couleurDeJeu } from '../composants/couleur';
import { aSignaler, classeActionDeNote, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone, type NomDIcone } from '../composants/Icone';
import { NombreAnime } from '../composants/NombreAnime';
import { Page } from '../composants/Page';
import { suiviDeListe } from '../composants/pointeur';
import { coeur } from '../coeur';
import { erreur, vautUnNouvelEssai } from '../coeur/erreurs';
import { modifierLesParametres, useApplication } from '../etat/application';
import { useAmbiance } from '../etat/ambiance';
import { useDetail } from '../etat/detail';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { Medaille } from '../fiche/Medaille';
import { formaterDate, formaterDateComplete, formaterNombre, formaterPart, formaterPourcentage } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien, revenir } from '../navigation';
import { CarteSucces } from './CarteSucces';
import { estCache, FILTRES_SUCCES, filtrerSucces, ordonner, SEUIL_RARE, vitrine, type FiltreSucces } from './logique';
import styles from './EcranSucces.module.css';

/** Erreurs qui veulent dire « ce jeu n'a rien à montrer ici » : un constat calme, pas une alerte. */
const SANS_SUCCES = new Set<ErreurApp['code']>(['jeu_sans_succes', 'jeu_non_steam']);

const suiviDesCartes = suiviDeListe('[data-carte-succes]');
const suiviDeLaVitrine = suiviDeListe('[data-vitrine]');

/** La jauge : un grand anneau au dégradé du blason, qui se remplit en tournant pendant que le pourcentage compte. */
function Jauge({ succes }: { succes: SuccesDuJeu }) {
  const { t, tp, langue } = useTexte();
  const connue = succes.debloques !== null && succes.total > 0;
  const part = connue && succes.debloques !== null ? succes.debloques / succes.total : 1;
  return (
    <div className={styles.jauge} style={{ '--part': part } as CSSProperties} data-inconnue={connue ? undefined : ''}>
      <span className={styles.jaugeHalo} aria-hidden="true" />
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="succes-jauge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className={styles.arret1} />
            <stop offset="0.5" className={styles.arret2} />
            <stop offset="1" className={styles.arret3} />
          </linearGradient>
        </defs>
        <circle className={styles.graduations} cx="100" cy="100" r="94" pathLength="120" />
        <circle className={styles.jaugeFond} cx="100" cy="100" r="80" />
        {part > 0 && <circle className={styles.jaugePleine} cx="100" cy="100" r="80" pathLength="100" stroke="url(#succes-jauge)" />}
      </svg>
      <div className={styles.jaugeTexte}>
        {connue && succes.debloques !== null ? (
          <>
            <strong className="chiffres">
              <NombreAnime valeur={Math.round(part * 100)} format={(n) => formaterPourcentage(n, langue)} />
            </strong>
            <span>{t('succes.jauge')}</span>
            <span className={`chiffres ${styles.jaugeCompte}`}>
              {formaterNombre(succes.debloques, langue)} / {formaterNombre(succes.total, langue)}
            </span>
          </>
        ) : (
          <>
            <strong className="chiffres">
              <NombreAnime valeur={succes.total} format={(n) => formaterNombre(n, langue)} />
            </strong>
            <span>{tp('fiche.succes_nombre', succes.total, { n: '' }).trim()}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Compteur({ icone, valeur, libelle, rang }: { icone: NomDIcone; valeur: ReactNode; libelle: string; rang: number }) {
  return (
    <div className={styles.compteur} style={{ '--rang': rang } as CSSProperties}>
      <Medaille taille={44}>
        <Icone nom={icone} taille={18} />
      </Medaille>
      <div className={styles.compteurTexte}>
        <dt>{libelle}</dt>
        <dd className="chiffres">{valeur}</dd>
      </div>
    </div>
  );
}

/** L'en-tête : l'image du jeu en fond, le titre, les compteurs et la grande jauge. */
function Entete({ succes, jeu, hero, logo }: { succes: SuccesDuJeu | null; jeu: JeuResume | null; hero: string | null; logo: string | null }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const liste = succes?.liste ?? [];
  const debloques = liste.filter((s) => s.debloque === true);
  const connue = succes !== null && succes.debloques !== null;
  const rares = debloques.filter((s) => s.pct_mondial !== null && s.pct_mondial < SEUIL_RARE).length;
  const dernier = debloques.map((s) => s.debloque_le).filter((d): d is string => d !== null).sort().at(-1);
  const parts = liste.map((s) => s.pct_mondial).filter((p): p is number => p !== null);
  const moyenne = parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0) / parts.length;

  return (
    <header className={styles.entete}>
      {hero !== null && <img className={styles.fond} src={hero} alt="" decoding="async" />}
      <span className={styles.voile} aria-hidden="true" />
      <div className={styles.enteteCorps}>
        <div className={styles.enteteTexte}>
          <button type="button" className={classeBouton({ variante: 'voile' }, styles.retour)} onClick={revenir}>
            <Icone nom="retour" taille={18} />
            {t('commun.retour')}
          </button>
          {jeu !== null &&
            (logo !== null ? (
              <Lien className={styles.jeu} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
                <img className={styles.logo} src={logo} alt={jeu.titre} />
              </Lien>
            ) : (
              <Lien className={`${styles.jeu} ${styles.jeuTexte}`} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
                {jeu.titre}
              </Lien>
            ))}
          <h1 className={styles.titre}>{t('fiche.succes')}</h1>
          {succes !== null && (
            <dl className={styles.compteurs}>
              {connue ? (
                <>
                  <Compteur icone="trophee" rang={0} libelle={t('succes.compteur.debloques')} valeur={<NombreAnime valeur={debloques.length} format={(n) => formaterNombre(n, langue)} />} />
                  <Compteur icone="cadenas" rang={1} libelle={t('succes.compteur.restants')} valeur={<NombreAnime valeur={succes.total - debloques.length} format={(n) => formaterNombre(n, langue)} />} />
                  <Compteur icone="etoile" rang={2} libelle={t('succes.compteur.rares')} valeur={<NombreAnime valeur={rares} format={(n) => formaterNombre(n, langue)} />} />
                  {dernier !== undefined && <Compteur icone="horloge" rang={3} libelle={t('succes.compteur.dernier')} valeur={formaterDate(dernier, langue, maintenant)} />}
                </>
              ) : (
                <>
                  <Compteur icone="trophee" rang={0} libelle={t('succes.compteur.total')} valeur={<NombreAnime valeur={succes.total} format={(n) => formaterNombre(n, langue)} />} />
                  {moyenne !== null && <Compteur icone="amis" rang={1} libelle={t('succes.compteur.moyenne')} valeur={formaterPart(moyenne, langue)} />}
                </>
              )}
            </dl>
          )}
        </div>
        {succes !== null && succes.total > 0 && <Jauge succes={succes} />}
      </div>
    </header>
  );
}

/** La vitrine : trois grandes cartes holographiques, les succès les plus rares. */
function Vitrine({ succes, reveler }: { succes: SuccesDuJeu; reveler: boolean }) {
  const { t, langue } = useTexte();
  const { succes: choisis, defis } = vitrine(succes.liste, reveler);
  if (choisis.length === 0) return null;
  return (
    <section className={styles.vitrine} aria-labelledby="succes-vitrine">
      <div className={styles.vitrineTete}>
        <h2 id="succes-vitrine" className="titre-section">
          {t('succes.vitrine')}
        </h2>
        <p>{defis ? t('succes.vitrine.defis') : t('succes.vitrine.texte')}</p>
      </div>
      <ol className={styles.vitrineListe} {...suiviDeLaVitrine}>
        {choisis.map((s, rang) => (
          <li key={s.api_name} data-vitrine="" className={styles.trophee} data-acquis={s.debloque === true ? '' : undefined} style={{ '--rang': rang } as CSSProperties}>
            <span className={styles.rayons} aria-hidden="true" />
            <span className={styles.tropheeHolo} aria-hidden="true" />
            <span className={styles.rangTrophee} aria-hidden="true">
              {rang + 1}
            </span>
            <Medaille taille={104} eteinte={s.debloque !== true} className={styles.tropheeMedaille ?? ''}>
              <img src={s.debloque === true ? s.icone : s.icone_grise} alt="" loading="lazy" decoding="async" />
            </Medaille>
            <strong className={styles.tropheeNom}>{s.nom}</strong>
            {s.description !== null && <span className={styles.tropheeDescription}>{estCache(s, reveler) ? t('succes.secret_texte') : s.description}</span>}
            {s.pct_mondial !== null && (
              <span className={styles.tropheePart}>
                <strong className="chiffres">{formaterPart(s.pct_mondial, langue)}</strong> {t('succes.part_des_joueurs', { part: '' }).trim()}
              </span>
            )}
            {s.debloque_le !== null && <span className={styles.tropheeDate}>{t('succes.debloque_le', { date: formaterDateComplete(s.debloque_le, langue) })}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Les filtres en gélules : la gélule active prend le dégradé du blason. */
function Gelules({ valeur, options, onChanger, nom }: { valeur: FiltreSucces; options: { valeur: FiltreSucces; libelle: string }[]; onChanger: (v: FiltreSucces) => void; nom: string }) {
  return (
    <div className={styles.gelules} role="group" aria-label={nom}>
      {options.map((option) => (
        <button key={option.valeur} type="button" className={styles.gelule} aria-pressed={option.valeur === valeur} onClick={() => onChanger(option.valeur)}>
          {option.libelle}
        </button>
      ))}
    </div>
  );
}

function ListeDeSucces({ succes }: { succes: SuccesDuJeu }) {
  const { t, tp, te, langue } = useTexte();
  const reveler = useApplication((a) => a.parametres?.reveler_les_succes_secrets ?? false);
  const [filtre, setFiltre] = useState<FiltreSucces>('tous');

  const progressionConnue = succes.debloques !== null;
  // Sans progression, « débloqués » et « à débloquer » ne voudraient rien dire : le filtre disparaît.
  const filtreActif = progressionConnue ? filtre : 'tous';
  const ordonnes = ordonner(succes.liste);
  const affiches = filtrerSucces(ordonnes, filtreActif);
  const nombreDebloques = succes.liste.filter((s) => s.debloque === true).length;
  const secretsCaches = succes.liste.filter((s) => s.secret && s.debloque !== true).length;
  const nombres: Record<FiltreSucces, number> = { tous: succes.liste.length, debloques: nombreDebloques, a_debloquer: succes.liste.length - nombreDebloques };

  return (
    <>
      {succes.progression_erreur !== null && (
        <div className={styles.note}>
          <Note
            icone={iconeDErreur(succes.progression_erreur)}
            action={
              <Lien className={classeActionDeNote} vers={{ ecran: 'parametres', section: 'steam' }}>
                {t('bibliotheque.partielle.action')}
              </Lien>
            }
          >
            {t('fiche.progression_inconnue', { raison: te(succes.progression_erreur) })}
          </Note>
        </div>
      )}

      <Vitrine succes={succes} reveler={reveler} />

      <div className={styles.outils}>
        {progressionConnue ? (
          <Gelules
            nom={t('succes.filtres')}
            valeur={filtreActif}
            onChanger={setFiltre}
            options={FILTRES_SUCCES.map((valeur) => ({ valeur, libelle: t(`succes.filtre.${valeur}`, { n: formaterNombre(nombres[valeur], langue) }) }))}
          />
        ) : (
          <h2 className="titre-section">{t('succes.liste')}</h2>
        )}
        {secretsCaches > 0 && (
          <div className={styles.secrets}>
            <span>{reveler ? t('succes.secrets.aide_revelee') : t('succes.secrets.aide')}</span>
            <Bouton onClick={() => void modifierLesParametres((p) => ({ ...p, reveler_les_succes_secrets: !reveler }))}>
              <Icone nom={reveler ? 'oeil_barre' : 'oeil'} taille={18} />
              {reveler ? t('succes.secrets.cacher') : tp('succes.secrets.reveler', secretsCaches)}
            </Bouton>
          </div>
        )}
      </div>

      {affiches.length === 0 ? (
        <Message icone={filtreActif === 'a_debloquer' ? 'coche' : 'info'} titre={t(filtreActif === 'a_debloquer' ? 'succes.vide.a_debloquer' : 'succes.vide.debloques')} />
      ) : (
        // La clé rejoue la cascade d'entrée à chaque changement de filtre.
        <ul key={filtreActif} className={`cascade ${styles.liste}`} aria-label={t('succes.liste')} {...suiviDesCartes}>
          {affiches.map((s) => (
            <CarteSucces key={s.api_name} succes={s} reveler={reveler} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Tous les succès d'un jeu. Trois cas avant la liste : le jeu n'existe pas, les succès arrivent, ils n'existent pas. */
export function EcranSucces({ id_jeu }: { id_jeu: number }) {
  const { t, te } = useTexte();
  const { detail, erreur: erreurDuJeu } = useDetail(id_jeu);
  const succes = useReponse(() => coeur.succes_du_jeu(id_jeu), 'succes', id_jeu, `succes:${id_jeu}`);
  // Le magasin est plus frais que le détail (même raison que dans la fiche).
  const jeu = useApplication((a) => a.jeux?.find((j) => j.id === id_jeu)) ?? detail?.resume ?? null;
  useAmbiance(jeu?.couleur_dominante ?? null, detail?.hero ?? null);

  if (erreurDuJeu !== null) {
    return (
      <Page retour titre={t('fiche.succes')}>
        <ErreurPleine
          erreur={erreurDuJeu}
          actions={
            <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'bibliotheque', recherche: '' }}>
              {t('fiche.retour_bibliotheque')}
            </Lien>
          }
        />
      </Page>
    );
  }

  const donnees = succes.donnees;

  return (
    <div {...couleurDeJeu(jeu?.couleur_dominante ?? null)} className={styles.ecran}>
      <Entete succes={donnees} jeu={jeu} hero={detail?.hero ?? null} logo={detail?.logo ?? null} />
      <div className={styles.contenu}>
        {succes.vue === 'chargement' && (
          <div className={styles.squelettes} role="status" aria-label={t('commun.chargement')}>
            {Array.from({ length: 8 }, (_, i) => (
              <Squelette key={i} hauteur="94px" rayon="var(--rayon-l)" />
            ))}
          </div>
        )}
        {succes.vue === 'erreur' && succes.erreur !== null &&
          (SANS_SUCCES.has(succes.erreur.code) ? (
            <Message icone="info" titre={te(succes.erreur)} />
          ) : (
            <ErreurPleine erreur={succes.erreur} reessayer={succes.reessayer} />
          ))}
        {succes.vue === 'vide' && <Message icone="info" titre={te(erreur('jeu_sans_succes'))} />}
        {donnees !== null && donnees.liste.length > 0 && (
          <>
            {aSignaler(succes.erreur, true) && (
              <div className={styles.note}>
                <Note
                  icone={iconeDErreur(succes.erreur)}
                  action={
                    vautUnNouvelEssai(succes.erreur) && (
                      <button type="button" className={classeActionDeNote} onClick={succes.reessayer}>
                        {t('commun.reessayer')}
                      </button>
                    )
                  }
                >
                  {t('fiche.donnees_enregistrees', { raison: te(succes.erreur) })}
                </Note>
              </div>
            )}
            <ListeDeSucces succes={donnees} />
          </>
        )}
      </div>
    </div>
  );
}
