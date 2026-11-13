/**
 * Les actualités (V2) en magazine : une grande annonce à image posée sur un verre poli, trois annonces
 * à côté, puis le fil jour par jour en lignes larges (image, titre, résumé). Un ruban de jeux filtre le fil.
 */
import { useMemo, useRef, useState } from 'react';
import type { Actualite, JeuResume } from '../../contrat/types';
import { disponible } from '../artefact/images';
import { Attente, Bouton, classeBouton } from '../composants/Bouton';
import { aSignaler, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Choix, EnTeteDEcran, ImageDeJeuAuto } from '../composants/Visuels';
import { coeur } from '../coeur';
import { useAmbiance } from '../etat/ambiance';
import { useApplication } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDate, formaterDateRelative } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { LecteurDActualite } from './Lecteur';
import { choisirLaUne, compterParJeu, FILTRES_ACTUALITES, filtrerActualites, filtrerParJeu, regrouperParJour, type FiltreActualites } from './logique';
import styles from './EcranActualites.module.css';

const TAILLE_DE_PAGE = 20;

function Vignette({ actualite, jeu }: { actualite: Actualite; jeu: JeuResume | undefined }) {
  if (disponible(actualite.image)) return <img src={actualite.image} alt="" loading="lazy" decoding="async" />;
  if (jeu !== undefined) return <ImageDeJeuAuto jeu={jeu} className={styles.vignetteJeu} />;
  return <Icone nom="journal" taille={28} />;
}

export function EcranActualites() {
  const { t, te, langue } = useTexte();
  const maintenant = useMaintenant();
  const jeux = useApplication((a) => a.jeux);
  const [limite, setLimite] = useState(TAILLE_DE_PAGE);
  const [filtre, setFiltre] = useState<FiltreActualites>('toutes');
  const [jeuChoisi, setJeuChoisi] = useState<number | null>(null);
  const [ouverte, setOuverte] = useState<Actualite | null>(null);
  const limiteLue = useRef(TAILLE_DE_PAGE);
  const fil = useReponse(
    () =>
      coeur.fil_d_actualites(limite, null).then((r) => {
        limiteLue.current = limite;
        return r;
      }),
    'actualites',
    null,
    `fil:${limite}`,
  );
  const derniere = useRef<Actualite[]>([]);
  if (fil.donnees !== null) derniere.current = fil.donnees;
  const enChargementDeSuite = fil.donnees === null && fil.en_cours && limite > TAILLE_DE_PAGE;
  const annonces = fil.donnees ?? (limite > TAILLE_DE_PAGE ? derniere.current : null);

  const parId = useMemo(() => new Map<number, JeuResume>((jeux ?? []).map((j) => [j.id, j])), [jeux]);
  const ruban = useMemo(() => compterParJeu(annonces ?? []).filter((n) => parId.has(n.id_jeu)).slice(0, 12), [annonces, parId]);
  const visibles = useMemo(() => filtrerActualites(filtrerParJeu(annonces ?? [], jeuChoisi), filtre), [annonces, filtre, jeuChoisi]);
  const une = useMemo(() => choisirLaUne(visibles), [visibles]);
  const cote = useMemo(() => visibles.filter((a) => a !== une).slice(0, 3), [visibles, une]);
  const reste = useMemo(() => visibles.filter((a) => a !== une && !cote.includes(a)), [visibles, une, cote]);
  const groupes = useMemo(() => regrouperParJour(reste), [reste]);
  const jeuDeLaUne = une === undefined ? undefined : parId.get(une.id_jeu);
  useAmbiance(jeuDeLaUne?.couleur_dominante ?? null, une !== undefined && disponible(une.image) ? une.image : null);

  const finDuFil = fil.donnees !== null && fil.donnees.length < limiteLue.current;
  const peutAfficherPlus = annonces !== null && annonces.length > 0 && !finDuFil && (fil.donnees !== null || enChargementDeSuite);
  const erreur = fil.erreur;
  const reglages = erreur !== null && (erreur.code === 'source_coupee' || erreur.code === 'source_desactivee');

  return (
    <div className={styles.ecran}>
      <EnTeteDEcran
        titre={t('coque.actualites')}
        texte={t('actualites.perimetre')}
        actions={<Choix nom={t('actualites.filtres')} valeur={filtre} onChanger={setFiltre} options={FILTRES_ACTUALITES.map((valeur) => ({ valeur, libelle: t(`actualites.filtre.${valeur}`) }))} />}
      />

      {fil.vue === 'chargement' && annonces === null && (
        <div className={styles.tete} role="status" aria-label={t('commun.chargement')}>
          <Squelette hauteur="420px" rayon="24px" />
          <Squelette hauteur="420px" rayon="24px" />
        </div>
      )}
      {fil.vue === 'erreur' && erreur !== null && (
        <ErreurPleine
          erreur={erreur}
          reessayer={fil.reessayer}
          {...(reglages
            ? {
                actions: (
                  <Lien className={classeBouton({})} vers={{ ecran: 'parametres', section: 'donnees' }}>
                    {t('actualites.reglages_donnees')}
                  </Lien>
                ),
              }
            : {})}
        />
      )}
      {fil.vue === 'vide' && annonces !== null && annonces.length === 0 && <Message icone="journal" titre={t('actualites.vide')} texte={t('actualites.vide_texte')} />}

      {annonces !== null && annonces.length > 0 && (
        <>
          {aSignaler(erreur, true) && (
            <div className={styles.note}>
              <Note icone={iconeDErreur(erreur)}>{t('actualites.donnees_enregistrees', { raison: te(erreur) })}</Note>
            </div>
          )}

          {ruban.length > 1 && (
            <div className={styles.ruban} role="group" aria-label={t('actualites.par_jeu')}>
              <button type="button" className={styles.rubanTous} aria-pressed={jeuChoisi === null} onClick={() => setJeuChoisi(null)}>
                {t('actualites.par_jeu.tous')}
              </button>
              {ruban.map((n) => {
                const jeu = parId.get(n.id_jeu);
                if (jeu === undefined) return null;
                return (
                  <button key={n.id_jeu} type="button" className={styles.rubanJeu} aria-pressed={jeuChoisi === n.id_jeu} title={jeu.titre} onClick={() => setJeuChoisi(jeuChoisi === n.id_jeu ? null : n.id_jeu)}>
                    {disponible(jeu.jaquette) ? <img src={jeu.jaquette} alt="" loading="lazy" /> : <span>{jeu.titre.charAt(0)}</span>}
                    <span className={`${styles.rubanNombre} chiffres`}>{n.nombre}</span>
                    <span className="hors-ecran">{jeu.titre}</span>
                  </button>
                );
              })}
            </div>
          )}

          {une !== undefined && (
            <div className={styles.tete}>
              <button type="button" key={une.id} className={styles.une} onClick={() => setOuverte(une)}>
                <span className={styles.uneImage}>
                  <Vignette actualite={une} jeu={jeuDeLaUne} />
                </span>
                <span className={`${styles.uneVerre} verre-poli`}>
                  <span className="etiquette">
                    {jeuDeLaUne?.titre ?? ''} · {t(`actualite.type.${une.type}`)} · {formaterDate(une.date, langue, maintenant)}
                  </span>
                  <span className={styles.uneTitre}>{une.titre}</span>
                  <span className={styles.uneResume}>{une.resume}</span>
                  <span className={styles.uneLire}>
                    {t('actualites.lire')}
                    <Icone nom="chevron_droit" taille={16} />
                  </span>
                </span>
              </button>
              <ul className={`${styles.cote} verre-poli`}>
                <li className="etiquette">{t('actualites.aussi')}</li>
                {cote.map((a) => (
                  <li key={a.id}>
                    <button type="button" className={styles.coteLigne} onClick={() => setOuverte(a)}>
                      <span className={styles.coteImage}>
                        <Vignette actualite={a} jeu={parId.get(a.id_jeu)} />
                      </span>
                      <span className={styles.coteTexte}>
                        <span className={styles.coteJeu}>{parId.get(a.id_jeu)?.titre ?? ''}</span>
                        <span className={styles.coteTitre}>{a.titre}</span>
                        <span className={styles.coteDate}>{formaterDateRelative(a.date, langue, maintenant)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {visibles.length === 0 && <p className={styles.discret}>{t('actualites.filtre_vide')}</p>}

          {groupes.map((groupe) => (
            <section key={groupe.date} className={styles.jour} aria-label={formaterDateRelative(groupe.date, langue, maintenant)}>
              <h2 className={styles.jourTitre}>{formaterDateRelative(groupe.date, langue, maintenant)}</h2>
              <ul className={`${styles.liste} cascade`}>
                {groupe.annonces.map((a) => {
                  const jeu = parId.get(a.id_jeu);
                  return (
                    <li key={a.id}>
                      <button type="button" className={styles.ligne} onClick={() => setOuverte(a)}>
                        <span className={styles.ligneImage}>
                          <Vignette actualite={a} jeu={jeu} />
                        </span>
                        <span className={styles.ligneTexte}>
                          <span className="etiquette">
                            <span className={styles.ligneJeu}>{jeu?.titre ?? ''}</span> · {t(`actualite.type.${a.type}`)}
                          </span>
                          <span className={styles.ligneTitre}>{a.titre}</span>
                          <span className={styles.ligneResume}>{a.resume}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {peutAfficherPlus && (
            <div className={styles.suite}>
              <Bouton aria-disabled={enChargementDeSuite} onClick={() => !enChargementDeSuite && setLimite((l) => l + TAILLE_DE_PAGE)}>
                {enChargementDeSuite && <Attente />}
                {t('actualites.afficher_plus')}
              </Bouton>
            </div>
          )}
          {finDuFil && limite > TAILLE_DE_PAGE && <p className={styles.discret}>{t('actualites.fin')}</p>}
        </>
      )}

      <LecteurDActualite actualite={ouverte} {...(ouverte === null || parId.get(ouverte.id_jeu) === undefined ? {} : { jeu: parId.get(ouverte.id_jeu)?.titre ?? '' })} onFermer={() => setOuverte(null)} />
    </div>
  );
}
