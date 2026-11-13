import { useState, type CSSProperties, type ReactNode } from 'react';
import type { ErreurApp, JeuResume, SuccesDuJeu } from '../../contrat/types';
import { Bouton, classeBouton } from '../composants/Bouton';
import { aSignaler, classeActionDeNote, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Page } from '../composants/Page';
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
import { Lien } from '../navigation';
import { CarteSucces } from './CarteSucces';
import { estCache, FILTRES_SUCCES, filtrerSucces, ordonner, SEUIL_RARE, vitrine, type FiltreSucces } from './logique';
import styles from './EcranSucces.module.css';

/** Erreurs qui veulent dire « ce jeu n'a rien à montrer ici » : un constat calme, pas une alerte. */
const SANS_SUCCES = new Set<ErreurApp['code']>(['jeu_sans_succes', 'jeu_non_steam']);

/** La jauge : un anneau fin, rempli à la part des succès débloqués. */
function Jauge({ succes }: { succes: SuccesDuJeu }) {
  const { langue } = useTexte();
  const connue = succes.debloques !== null && succes.total > 0;
  const part = connue && succes.debloques !== null ? succes.debloques / succes.total : 0;
  return (
    <div className={styles.jauge} style={{ '--part': part } as CSSProperties}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className={styles.jaugeFond} cx="60" cy="60" r="54" />
        {part > 0 && <circle className={styles.jaugePleine} cx="60" cy="60" r="54" pathLength="100" />}
      </svg>
      <strong className="chiffres">{connue ? formaterPourcentage(Math.round(part * 100), langue) : formaterNombre(succes.total, langue)}</strong>
    </div>
  );
}

function Compteur({ valeur, libelle }: { valeur: ReactNode; libelle: string }) {
  return (
    <div className={styles.compteur}>
      <dt>{libelle}</dt>
      <dd className="chiffres">{valeur}</dd>
    </div>
  );
}

/** Le bilan : la jauge, et quelques chiffres à côté. */
function Bilan({ succes }: { succes: SuccesDuJeu }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const debloques = succes.liste.filter((s) => s.debloque === true);
  const connue = succes.debloques !== null;
  const rares = debloques.filter((s) => s.pct_mondial !== null && s.pct_mondial < SEUIL_RARE).length;
  const dernier = debloques.map((s) => s.debloque_le).filter((d): d is string => d !== null).sort().at(-1);
  const parts = succes.liste.map((s) => s.pct_mondial).filter((p): p is number => p !== null);
  const moyenne = parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0) / parts.length;

  return (
    <div className={styles.bilan}>
      {succes.total > 0 && <Jauge succes={succes} />}
      <dl className={styles.compteurs}>
        {connue ? (
          <>
            <Compteur
              libelle={t('succes.compteur.debloques')}
              valeur={
                <>
                  {formaterNombre(debloques.length, langue)}
                  <small> / {formaterNombre(succes.total, langue)}</small>
                </>
              }
            />
            <Compteur libelle={t('succes.compteur.restants')} valeur={formaterNombre(succes.total - debloques.length, langue)} />
            <Compteur libelle={t('succes.compteur.rares')} valeur={formaterNombre(rares, langue)} />
            {dernier !== undefined && <Compteur libelle={t('succes.compteur.dernier')} valeur={formaterDate(dernier, langue, maintenant)} />}
          </>
        ) : (
          <>
            <Compteur libelle={t('succes.compteur.total')} valeur={formaterNombre(succes.total, langue)} />
            {moyenne !== null && <Compteur libelle={t('succes.compteur.moyenne')} valeur={formaterPart(moyenne, langue)} />}
          </>
        )}
      </dl>
    </div>
  );
}

/** La vitrine : les trois succès les plus rares, en cartes un peu plus grandes que celles de la liste. */
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
      <ol className={styles.vitrineListe}>
        {choisis.map((s) => (
          <li key={s.api_name} className={styles.trophee}>
            <Medaille taille={56} eteinte={s.debloque !== true}>
              <img src={s.debloque === true ? s.icone : s.icone_grise} alt="" loading="lazy" decoding="async" />
            </Medaille>
            <strong className={styles.tropheeNom}>{s.nom}</strong>
            {s.description !== null && <span className={styles.tropheeDescription}>{estCache(s, reveler) ? t('succes.secret_texte') : s.description}</span>}
            <span className={styles.tropheeBas}>
              {s.pct_mondial !== null && (
                <span className={styles.tropheePart}>
                  <strong className="chiffres">{formaterPart(s.pct_mondial, langue)}</strong> {t('succes.part_des_joueurs', { part: '' }).trim()}
                </span>
              )}
              {s.debloque_le !== null && <span className={styles.tropheeDate}>{t('succes.debloque_le', { date: formaterDateComplete(s.debloque_le, langue) })}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
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
          <div className={styles.filtres} role="group" aria-label={t('succes.filtres')}>
            {FILTRES_SUCCES.map((valeur) => (
              <Bouton key={valeur} aria-pressed={valeur === filtreActif} onClick={() => setFiltre(valeur)}>
                {t(`succes.filtre.${valeur}`, { n: formaterNombre(nombres[valeur], langue) })}
              </Bouton>
            ))}
          </div>
        ) : (
          <h2 className="titre-section">{t('succes.liste')}</h2>
        )}
        {secretsCaches > 0 && (
          <div className={styles.secrets}>
            <span>{reveler ? t('succes.secrets.aide_revelee') : t('succes.secrets.aide')}</span>
            <Bouton onClick={() => void modifierLesParametres((p) => ({ ...p, reveler_les_succes_secrets: !reveler }))}>
              <Icone nom={reveler ? 'oeil_barre' : 'oeil'} taille={16} />
              {reveler ? t('succes.secrets.cacher') : tp('succes.secrets.reveler', secretsCaches)}
            </Bouton>
          </div>
        )}
      </div>

      {affiches.length === 0 ? (
        <Message icone={filtreActif === 'a_debloquer' ? 'coche' : 'info'} titre={t(filtreActif === 'a_debloquer' ? 'succes.vide.a_debloquer' : 'succes.vide.debloques')} />
      ) : (
        <ul className={styles.liste} aria-label={t('succes.liste')}>
          {affiches.map((s) => (
            <CarteSucces key={s.api_name} succes={s} reveler={reveler} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Sous le titre : le nom du jeu, qui ramène à sa fiche. */
function LienDuJeu({ jeu }: { jeu: JeuResume }) {
  return (
    <Lien className={styles.jeu} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
      {jeu.titre}
    </Lien>
  );
}

/** Tous les succès d'un jeu. Trois cas avant la liste : le jeu n'existe pas, les succès arrivent, ils n'existent pas. */
export function EcranSucces({ id_jeu }: { id_jeu: number }) {
  const { t, te } = useTexte();
  const { detail, erreur: erreurDuJeu } = useDetail(id_jeu);
  const succes = useReponse(() => coeur.succes_du_jeu(id_jeu), 'succes', id_jeu, `succes:${id_jeu}`);
  // Le magasin est plus frais que le détail (même raison que dans la fiche).
  const jeu = useApplication((a) => a.jeux?.find((j) => j.id === id_jeu)) ?? detail?.resume ?? null;
  useAmbiance(jeu?.couleur_dominante ?? null);

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
    <Page retour titre={t('fiche.succes')} {...(jeu === null ? {} : { sousTitre: <LienDuJeu jeu={jeu} /> })}>
      {donnees !== null && donnees.liste.length > 0 && <Bilan succes={donnees} />}
      <div className={styles.contenu}>
        {succes.vue === 'chargement' && (
          <div className={styles.squelettes} role="status" aria-label={t('commun.chargement')}>
            {Array.from({ length: 8 }, (_, i) => (
              <Squelette key={i} hauteur="76px" rayon="var(--rayon-l)" />
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
    </Page>
  );
}
