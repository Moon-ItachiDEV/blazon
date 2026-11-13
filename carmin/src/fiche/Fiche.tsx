import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { Actualite, Ami, JeuDetail, Session, Source, Succes, SuccesDuJeu } from '../../contrat/types';
import { CarteActualite } from '../actualites/CarteActualite';
import { LecteurDActualite } from '../actualites/Lecteur';
import { ActionsDAffiche, Affiche, LigneDAffiche } from '../composants/Affiche';
import { Bouton, classeBouton } from '../composants/Bouton';
import { BoutonJouer } from '../composants/BoutonJouer';
import { Dialogue } from '../composants/Dialogue';
import { couleurDeJeu } from '../composants/couleur';
import { disponible } from '../artefact/images';
import { aSignaler, classeActionDeNote, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Menu, type ElementDeMenu } from '../composants/Menu';
import { gabaritDeTitre } from '../composants/titre';
import { coeur } from '../coeur';
import { vautUnNouvelEssai } from '../coeur/erreurs';
import { definirFavori, definirMasque, tenter, useApplication } from '../etat/application';
import { useDetail } from '../etat/detail';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import {
  formaterAnnee,
  formaterDate,
  formaterDateComplete,
  formaterDureeDeSession,
  formaterNombre,
  formaterPart,
  formaterPourcentage,
  formaterTaille,
  formaterTempsDeJeu,
} from '../formats';
import { useTexte } from '../i18n/react';
import { Lien, revenir } from '../navigation';
import { Avatar } from '../profil/Avatar';
import { CarteSucces } from '../succes/CarteSucces';
import { apercu, estCache } from '../succes/logique';
import { Frise } from './Frise';
import { Galerie } from './Galerie';
import { Medaille } from './Medaille';
import styles from './Fiche.module.css';

/** Erreurs qui veulent dire « cette rubrique n'existe pas pour ce jeu » : on la retire sans bruit. */
const SANS_OBJET = new Set(['jeu_non_steam', 'jeu_sans_succes']);

function BoutonRetour() {
  const { t } = useTexte();
  return (
    <button type="button" className={classeBouton({ variante: 'voile' }, styles.retour)} onClick={revenir}>
      <Icone nom="retour" taille={18} />
      {t('commun.retour')}
    </button>
  );
}

/** Le titre de la page : le logo du jeu, sinon son nom écrit en grand. */
function TitreDeFiche({ titre, logo }: { titre: string; logo: string | null }) {
  const [logoCasse, setLogoCasse] = useState(false);
  const enImage = logo !== null && !logoCasse;
  return (
    <h1 id="fiche-titre" className={styles.titre} data-logo={enImage ? '' : undefined} data-gabarit={enImage ? undefined : gabaritDeTitre(titre)}>
      {enImage ? <img className={styles.logo} src={logo} alt={titre} onError={() => setLogoCasse(true)} /> : <span className={styles.titreTexte}>{titre}</span>}
    </h1>
  );
}

/** Un chiffre du jeu : la valeur, son libellé dessous. */
function Chiffre({ valeur, libelle }: { valeur: ReactNode; libelle: string }) {
  return (
    <div className={styles.chiffre}>
      <dt>{libelle}</dt>
      <dd className="chiffres">{valeur}</dd>
    </div>
  );
}

function Rangee({ nom, valeur }: { nom: string; valeur: string }) {
  return (
    <div className={styles.rangee}>
      <dt>{nom}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}

/** Le prochain succès à portée : non débloqué, pas caché, le plus courant chez les joueurs. */
function prochainSucces(succes: SuccesDuJeu | null, reveler: boolean): Succes | null {
  if (succes === null || succes.debloques === null) return null;
  const restants = succes.liste.filter((s) => s.debloque !== true && !estCache(s, reveler));
  return restants.sort((a, b) => (b.pct_mondial ?? -1) - (a.pct_mondial ?? -1))[0] ?? null;
}

/**
 * L'encart, à droite de l'affiche : ce qui donne envie d'y retourner. Le prochain succès à portée,
 * la dernière partie, le temps joué ces deux semaines, les amis qui y jouent.
 */
function Encart({ prochain, tousDebloques, derniere, minutes2sem, joueurs, id_jeu }: { prochain: Succes | null; tousDebloques: boolean; derniere: Session | undefined; minutes2sem: number | null; joueurs: Ami[]; id_jeu: number }) {
  const { t, tp, langue } = useTexte();
  const maintenant = useMaintenant();
  const faits: { cle: string; nom: string; valeur: string }[] = [];
  if (derniere !== undefined) faits.push({ cle: 'derniere', nom: t('fiche.derniere_session'), valeur: `${formaterDate(derniere.debut, langue, maintenant)} · ${formaterDureeDeSession(derniere.duree_s, langue)}` });
  if (minutes2sem !== null && minutes2sem > 0) faits.push({ cle: '2sem', nom: t('fiche.deux_semaines'), valeur: formaterTempsDeJeu(minutes2sem, langue) });
  if (prochain === null && !tousDebloques && faits.length === 0 && joueurs.length === 0) return null;

  return (
    <aside className={styles.encart} aria-label={t('fiche.prochain_succes')}>
      {prochain !== null && (
        <Lien className={styles.encartSucces} vers={{ ecran: 'succes', id_jeu }}>
          <span className={styles.encartEtiquette}>{t('fiche.prochain_succes')}</span>
          <span className={styles.encartLigne}>
            {disponible(prochain.icone) ? (
              <img src={prochain.icone} alt="" width={48} height={48} className={styles.encartIcone} />
            ) : (
              <span className={`${styles.encartIcone} ${styles.encartIconeVide}`} aria-hidden="true">
                <Icone nom="trophee" taille={20} />
              </span>
            )}
            <span className={styles.encartTexte}>
              <strong>{prochain.nom}</strong>
              {prochain.description !== null && <span>{prochain.description}</span>}
            </span>
          </span>
          {prochain.pct_mondial !== null && (
            <span className={styles.encartPart}>
              <span className={styles.encartJauge} aria-hidden="true">
                <span style={{ transform: `scaleX(${prochain.pct_mondial / 100})` }} />
              </span>
              {t('fiche.prochain_succes.part', { part: formaterPart(prochain.pct_mondial, langue) })}
            </span>
          )}
        </Lien>
      )}
      {prochain === null && tousDebloques && (
        <p className={styles.encartComplet}>
          <Icone nom="trophee" taille={18} />
          {t('fiche.tous_debloques')}
        </p>
      )}
      {faits.length > 0 && (
        <dl className={styles.encartFaits}>
          {faits.map((fait) => (
            <div key={fait.cle}>
              <dt>{fait.nom}</dt>
              <dd>{fait.valeur}</dd>
            </div>
          ))}
        </dl>
      )}
      {joueurs.length > 0 && (
        <p className={styles.encartAmis}>
          <span className={styles.pile} aria-hidden="true">
            {joueurs.slice(0, 4).map((ami) => (
              <Avatar key={ami.steamid} image={ami.avatar} pseudo={ami.pseudo} taille={26} />
            ))}
          </span>
          {tp('fiche.amis_y_jouent', joueurs.length)}
        </p>
      )}
    </aside>
  );
}

/** L'aperçu des succès sur la fiche : un anneau de progression, une rangée d'icônes, quelques cartes. */
function ApercuDesSucces({ succes, reveler, id_jeu }: { succes: SuccesDuJeu; reveler: boolean; id_jeu: number }) {
  const { t, tp, te, langue } = useTexte();
  const choisis = apercu(succes.liste, 10);
  const part = succes.debloques === null || succes.total === 0 ? null : succes.debloques / succes.total;
  return (
    <>
      <div className={styles.vitrineSucces}>
        {part !== null && succes.debloques !== null && (
          <div className={styles.anneau} style={{ '--part': part } as CSSProperties}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className={styles.anneauFond} cx="60" cy="60" r="54" />
              {part > 0 && <circle className={styles.anneauPlein} cx="60" cy="60" r="54" pathLength="100" />}
            </svg>
            <span className={styles.anneauTexte}>
              <strong className="chiffres">{formaterPourcentage(Math.round(part * 100), langue)}</strong>
              <span className="chiffres">
                {succes.debloques}/{succes.total}
              </span>
            </span>
          </div>
        )}
        <div className={styles.medailles}>
          <p className={styles.medaillesTitre}>{t('fiche.medailles')}</p>
          <ul className={styles.rangMedailles}>
            {choisis.map((s) => {
              const cache = estCache(s, reveler);
              return (
                <li key={s.api_name} title={cache ? t('succes.secret') : s.nom}>
                  <Medaille taille={44} eteinte={s.debloque !== true}>
                    {cache ? <Icone nom="cadenas" taille={18} /> : <img src={s.debloque === true ? s.icone : s.icone_grise} alt="" loading="lazy" decoding="async" />}
                  </Medaille>
                  <span className="hors-ecran">{cache ? t('succes.secret') : s.nom}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {succes.progression_erreur !== null && (
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
      )}
      <ul className={styles.succes}>
        {apercu(succes.liste, 4).map((s) => (
          <CarteSucces key={s.api_name} succes={s} reveler={reveler} compacte />
        ))}
      </ul>
      <Lien className={styles.suite} vers={{ ecran: 'succes', id_jeu }}>
        {tp('fiche.voir_les_succes', succes.total)}
        <Icone nom="chevron_droit" taille={16} />
      </Lien>
    </>
  );
}

function FicheDuJeu({ detail }: { detail: JeuDetail }) {
  const { t, tp, te, langue } = useTexte();
  const maintenant = useMaintenant();
  const id_jeu = detail.resume.id;
  // Le magasin est à jour avant le détail (un favori s'y allume dès le clic) : on le préfère.
  const jeu = useApplication((a) => a.jeux?.find((j) => j.id === id_jeu)) ?? detail.resume;
  const noms = useApplication((a) => a.tags);
  const reveler = useApplication((a) => a.parametres?.reveler_les_succes_secrets ?? false);
  const fiche = useReponse(() => coeur.fiche_du_jeu(id_jeu), 'fiche', id_jeu, `fiche:${id_jeu}`);
  const succes = useReponse(() => coeur.succes_du_jeu(id_jeu), 'succes', id_jeu, `succes:${id_jeu}`);
  const actualites = useReponse(() => coeur.actualites_du_jeu(id_jeu, 3, null), 'actualites', id_jeu, `actualites:${id_jeu}`);
  const amis = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const [source, setSource] = useState<Source | null>(null);
  const [annonce, setAnnonce] = useState<Actualite | null>(null);
  const [dialogue, setDialogue] = useState<'renommer' | 'retirer' | null>(null);
  const [nouveauTitre, setNouveauTitre] = useState(jeu.titre);

  const liste = new Intl.ListFormat(langue, { type: 'conjunction' });
  const magasin = fiche.donnees;
  const manuel = jeu.sources.includes('manuel');
  const installees = detail.sources.filter((s) => s.installe).map((s) => s.source);
  const sourceAffichee = source ?? installees[0] ?? null;
  const joueurs = (amis.donnees ?? []).filter((ami) => ami.jeu_en_cours?.id_jeu === id_jeu);

  // ── Ligne sous le titre
  const ligne: string[] = [];
  const studio = magasin?.developpeurs[0];
  if (studio !== undefined) ligne.push(studio);
  if (magasin?.acces_anticipe === true) ligne.push(t('fiche.acces_anticipe'));
  if (jeu.date_sortie !== null) ligne.push(formaterAnnee(jeu.date_sortie));
  ligne.push(jeu.installe ? t('jeu.installe') : t('jeu.non_installe'));
  ligne.push(liste.format(jeu.sources.map((s) => t(`sources.${s}`))));

  // ── Chiffres
  const derniere = detail.sessions_recentes.find((s) => s.fin !== null);
  const progression = succes.donnees ?? (jeu.succes === null ? null : { total: jeu.succes.total, debloques: jeu.succes.debloques });
  const prochain = prochainSucces(succes.donnees, reveler);
  const tousDebloques = succes.donnees !== null && succes.donnees.debloques !== null && succes.donnees.total > 0 && succes.donnees.debloques === succes.donnees.total;

  const chiffres: ReactNode[] = [];
  chiffres.push(<Chiffre key="temps" valeur={formaterTempsDeJeu(jeu.temps.minutes_total, langue)} libelle={jeu.temps.origine === 'steam' ? t('fiche.temps.steam') : t('fiche.temps.local')} />);
  if (jeu.temps.dernier_lancement !== null) {
    chiffres.push(
      <Chiffre
        key="derniere"
        valeur={formaterDate(jeu.temps.dernier_lancement, langue, maintenant)}
        libelle={derniere === undefined ? t('fiche.derniere_partie') : t('fiche.derniere_partie_duree', { duree: formaterDureeDeSession(derniere.duree_s, langue) })}
      />,
    );
  }
  if (progression !== null && progression.total > 0) {
    chiffres.push(
      progression.debloques === null ? (
        <Chiffre key="succes" valeur={formaterNombre(progression.total, langue)} libelle={tp('fiche.succes_a_debloquer', progression.total)} />
      ) : (
        <Chiffre
          key="succes"
          valeur={
            <>
              {formaterNombre(progression.debloques, langue)}
              <small> / {formaterNombre(progression.total, langue)}</small>
            </>
          }
          libelle={t('fiche.succes_debloques', { part: formaterPourcentage((progression.debloques / progression.total) * 100, langue) })}
        />
      ),
    );
  }
  if (jeu.avis !== null && jeu.avis.score > 0) {
    chiffres.push(<Chiffre key="avis" valeur={formaterPourcentage(jeu.avis.pct_positifs, langue)} libelle={t('fiche.avis', { nombre: formaterNombre(jeu.avis.nombre, langue) })} />);
  }
  if (magasin !== null && magasin.joueurs_en_ligne !== null) {
    chiffres.push(<Chiffre key="joueurs" valeur={formaterNombre(magasin.joueurs_en_ligne, langue)} libelle={t('fiche.chiffre.joueurs')} />);
  } else if (jeu.taille_octets !== null) {
    chiffres.push(<Chiffre key="taille" valeur={formaterTaille(jeu.taille_octets, langue)} libelle={t('fiche.chiffre.taille')} />);
  } else {
    chiffres.push(<Chiffre key="ajoute" valeur={formaterAnnee(jeu.ajoute_le)} libelle={t('fiche.chiffre.ajoute')} />);
  }

  // ── Menu « autres actions »
  const appid = jeu.steam_appid;
  const actions: ElementDeMenu[] = [];
  if (jeu.installe) actions.push({ cle: 'dossier', libelle: t('fiche.ouvrir_le_dossier'), icone: 'dossier', action: () => void tenter(() => coeur.ouvrir_le_dossier(id_jeu)) });
  if (appid !== null) {
    actions.push({
      cle: 'magasin',
      libelle: t('fiche.voir_dans_le_magasin'),
      icone: 'lien_externe',
      action: () => void tenter(() => coeur.action_steam({ action: 'voir_dans_le_magasin', steam_appid: appid })),
    });
  }
  actions.push({
    cle: 'masquer',
    libelle: jeu.masque ? t('fiche.ne_plus_masquer') : t('fiche.masquer'),
    icone: jeu.masque ? 'oeil' : 'oeil_barre',
    action: () => void definirMasque(id_jeu, !jeu.masque),
  });
  if (manuel) {
    actions.push({ cle: 'renommer', libelle: t('fiche.renommer'), icone: 'crayon', separe: true, action: () => setDialogue('renommer') });
    actions.push({ cle: 'retirer', libelle: t('fiche.retirer'), icone: 'poubelle', danger: true, action: () => setDialogue('retirer') });
  } else if (appid !== null && jeu.installe && jeu.sources.includes('steam')) {
    actions.push({
      cle: 'desinstaller',
      libelle: t('fiche.desinstaller'),
      icone: 'poubelle',
      danger: true,
      separe: true,
      action: () => void tenter(() => coeur.action_steam({ action: 'desinstaller', steam_appid: appid })),
    });
  }

  const renommer = async (evenement: FormEvent) => {
    evenement.preventDefault();
    const titre = nouveauTitre.trim();
    if (titre === '' || titre === jeu.titre) return setDialogue(null);
    if (await tenter(() => coeur.renommer_un_jeu(id_jeu, titre))) setDialogue(null);
  };

  const retirer = async () => {
    if (await tenter(() => coeur.retirer_un_jeu_manuel(id_jeu))) revenir();
  };

  const langueDuJoueur = magasin?.langues.find((l) => l.code === langue);
  const prise_en_charge = langueDuJoueur === undefined ? [] : (['interface', 'audio', 'sous_titres'] as const).filter((cle) => langueDuJoueur[cle]).map((cle) => t(`fiche.langue.${cle}`));

  const encart = <Encart prochain={prochain} tousDebloques={tousDebloques} derniere={derniere} minutes2sem={jeu.temps.minutes_2sem} joueurs={joueurs} id_jeu={id_jeu} />;

  return (
    <div {...couleurDeJeu(jeu.couleur_dominante)} className={styles.fiche}>
      <Affiche className={styles.affiche ?? ''} couleur={jeu.couleur_dominante} image={detail.hero} haut={<BoutonRetour />} idDuTitre="fiche-titre" cle={id_jeu} cote={encart}>
        <TitreDeFiche titre={jeu.titre} logo={detail.logo} />
        <LigneDAffiche morceaux={ligne} />
        <ActionsDAffiche>
          <BoutonJouer jeu={jeu} source={source} grand />
          {jeu.installe && installees.length > 1 && sourceAffichee !== null && (
            <Menu
              classeDuBouton={classeBouton({ variante: 'voile', grand: true })}
              nom={t('fiche.source_de_lancement', { source: t(`sources.${sourceAffichee}`) })}
              contenu={
                <>
                  <span>{t('fiche.via', { source: t(`sources.${sourceAffichee}`) })}</span>
                  <Icone nom="chevron_bas" taille={16} />
                </>
              }
              elements={installees.map((s) => ({ cle: s, libelle: t(`sources.${s}`), coche: s === sourceAffichee, action: () => setSource(s) }))}
            />
          )}
          <Bouton
            variante="voile"
            grand
            carre
            aria-pressed={jeu.favori}
            aria-label={jeu.favori ? t('fiche.retirer_des_favoris') : t('fiche.ajouter_aux_favoris')}
            onClick={() => void definirFavori(id_jeu, !jeu.favori)}
          >
            <Icone nom={jeu.favori ? 'etoile_pleine' : 'etoile'} taille={20} />
          </Bouton>
          <Menu classeDuBouton={classeBouton({ variante: 'voile', grand: true, carre: true })} nom={t('fiche.autres_actions')} alignement="droite" contenu={<Icone nom="autres" taille={20} />} elements={actions} />
        </ActionsDAffiche>
      </Affiche>

      <dl className={styles.chiffres}>{chiffres}</dl>

      <div className={styles.colonnes}>
        <div className={styles.principale}>
          {/* ── Présentation */}
          <section className={styles.section} aria-labelledby="fiche-a-propos">
            <h2 id="fiche-a-propos" className="titre-section">
              {t('fiche.a_propos')}
            </h2>
            {fiche.vue === 'chargement' && (
              <>
                <Squelette hauteur="22px" style={{ maxWidth: 760, marginBottom: 10 }} />
                <Squelette hauteur="22px" style={{ maxWidth: 620 }} />
              </>
            )}
            {magasin !== null && (
              <p className={styles.description} lang={magasin.langue}>
                {magasin.description_courte}
              </p>
            )}
            {aSignaler(fiche.erreur, magasin !== null) && !SANS_OBJET.has(fiche.erreur.code) && (
              <Note
                icone={iconeDErreur(fiche.erreur)}
                action={
                  vautUnNouvelEssai(fiche.erreur) && (
                    <button type="button" className={classeActionDeNote} onClick={fiche.reessayer}>
                      {t('commun.reessayer')}
                    </button>
                  )
                }
              >
                {magasin === null ? t('fiche.presentation_indisponible', { raison: te(fiche.erreur) }) : t('fiche.donnees_enregistrees', { raison: te(fiche.erreur) })}
              </Note>
            )}
            {fiche.erreur?.code === 'jeu_non_steam' && <p className={styles.discret}>{t('fiche.hors_steam')}</p>}
            {jeu.tags.length > 0 && (
              <ul className={styles.tags} aria-label={t('fiche.tags')}>
                {jeu.tags.slice(0, 8).map((id) => {
                  const nom = noms.get(id);
                  return nom === undefined ? null : (
                    <li key={id} className={styles.tag}>
                      {nom}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Captures */}
          {magasin !== null && magasin.captures.length > 0 && (
            <section className={styles.section} aria-labelledby="fiche-captures">
              <h2 id="fiche-captures" className="titre-section">
                {t('fiche.captures')}
              </h2>
              <Galerie captures={magasin.captures} titre={jeu.titre} />
            </section>
          )}

          {/* ── Succès */}
          {!(succes.erreur !== null && SANS_OBJET.has(succes.erreur.code)) && (
            <section className={styles.section} aria-labelledby="fiche-succes">
              <div className={styles.enteteDeSection}>
                <h2 id="fiche-succes" className="titre-section">
                  {t('fiche.succes')}
                </h2>
                {succes.donnees !== null && (
                  <span className={styles.precision}>
                    {succes.donnees.debloques === null ? tp('fiche.succes_nombre', succes.donnees.total) : tp('succes.progression', succes.donnees.debloques, { total: succes.donnees.total })}
                  </span>
                )}
              </div>
              {succes.vue === 'chargement' && (
                <div className={styles.succes} style={{ marginTop: 0 }}>
                  <Squelette hauteur="76px" rayon="var(--rayon-l)" />
                  <Squelette hauteur="76px" rayon="var(--rayon-l)" />
                </div>
              )}
              {succes.donnees === null && succes.erreur !== null && (
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
                  {te(succes.erreur)}
                </Note>
              )}
              {succes.donnees !== null && <ApercuDesSucces succes={succes.donnees} reveler={reveler} id_jeu={id_jeu} />}
            </section>
          )}
        </div>

        <aside className={styles.laterale}>
          {/* ── Sessions */}
          <section className={styles.section} aria-labelledby="fiche-sessions">
            <h2 id="fiche-sessions" className="titre-section">
              {t('fiche.sessions')}
            </h2>
            {detail.sessions_recentes.length === 0 ? (
              <div className={styles.sansSession}>
                <Icone nom="manette" taille={20} />
                <p>{t('fiche.aucune_session')}</p>
              </div>
            ) : (
              <Frise sessions={detail.sessions_recentes} />
            )}
          </section>

          {/* ── Actualités */}
          {actualites.erreur?.code !== 'jeu_non_steam' && (
            <section className={styles.section} aria-labelledby="fiche-actualites">
              <h2 id="fiche-actualites" className="titre-section">
                {t('coque.actualites')}
              </h2>
              {actualites.vue === 'chargement' && <Squelette hauteur="76px" rayon="var(--rayon-l)" />}
              {actualites.vue === 'vide' && <p className={styles.discret}>{t('fiche.aucune_actualite')}</p>}
              {aSignaler(actualites.erreur, actualites.donnees !== null) && (
                <div style={{ marginBottom: actualites.donnees === null ? 0 : 10 }}>
                  <Note
                    icone={iconeDErreur(actualites.erreur)}
                    action={
                      vautUnNouvelEssai(actualites.erreur) && (
                        <button type="button" className={classeActionDeNote} onClick={actualites.reessayer}>
                          {t('commun.reessayer')}
                        </button>
                      )
                    }
                  >
                    {te(actualites.erreur)}
                  </Note>
                </div>
              )}
              {actualites.donnees !== null && actualites.donnees.length > 0 && (
                <div className={styles.actualites}>
                  {actualites.donnees.map((actualite) => (
                    <CarteActualite key={actualite.id} actualite={actualite} onOuvrir={setAnnonce} />
                  ))}
                </div>
              )}
              <LecteurDActualite actualite={annonce} onFermer={() => setAnnonce(null)} />
            </section>
          )}

          {/* ── Détails */}
          <section className={styles.section} aria-labelledby="fiche-details">
            <h2 id="fiche-details" className="titre-section">
              {t('fiche.details')}
            </h2>
            <dl className={styles.panneau}>
              {magasin !== null && magasin.developpeurs.length > 0 && <Rangee nom={t('fiche.developpeur')} valeur={magasin.developpeurs.join(', ')} />}
              {magasin !== null && magasin.editeurs.length > 0 && <Rangee nom={t('fiche.editeur')} valeur={magasin.editeurs.join(', ')} />}
              {jeu.date_sortie !== null && <Rangee nom={t('tri.date_sortie')} valeur={formaterDateComplete(jeu.date_sortie, langue)} />}
              {jeu.modes.length > 0 && <Rangee nom={t('fiche.modes')} valeur={jeu.modes.map((mode) => t(`mode.${mode}`)).join(', ')} />}
              {jeu.manette !== null && <Rangee nom={t('fiche.manette')} valeur={t(`manette.${jeu.manette}`)} />}
              {magasin !== null && <Rangee nom={t(`langue.${langue}`)} valeur={prise_en_charge.length === 0 ? t('fiche.langue.absente') : prise_en_charge.join(', ')} />}
              {magasin !== null && magasin.classification !== null && <Rangee nom={t('fiche.classification')} valeur={`${magasin.classification.organisme} ${magasin.classification.valeur}`} />}
              {magasin !== null && magasin.joueurs_en_ligne !== null && <Rangee nom={t('fiche.joueurs_en_ligne')} valeur={formaterNombre(magasin.joueurs_en_ligne, langue)} />}
              {jeu.taille_octets !== null && <Rangee nom={t('fiche.taille')} valeur={formaterTaille(jeu.taille_octets, langue)} />}
              <Rangee nom={t('tri.ajoute_le')} valeur={formaterDateComplete(jeu.ajoute_le, langue)} />
            </dl>
          </section>
        </aside>
      </div>

      <Dialogue
        ouvert={dialogue === 'renommer'}
        onFermer={() => setDialogue(null)}
        titre={t('fiche.renommer')}
        pied={
          <>
            <Bouton onClick={() => setDialogue(null)}>{t('commun.annuler')}</Bouton>
            <Bouton variante="principal" type="submit" form="fiche-renommer">
              {t('commun.enregistrer')}
            </Bouton>
          </>
        }
      >
        <form id="fiche-renommer" onSubmit={(evenement) => void renommer(evenement)}>
          <input className={styles.champ} aria-label={t('fiche.nouveau_titre')} value={nouveauTitre} maxLength={120} autoFocus onChange={(evenement) => setNouveauTitre(evenement.target.value)} />
        </form>
      </Dialogue>

      <Dialogue
        ouvert={dialogue === 'retirer'}
        onFermer={() => setDialogue(null)}
        titre={t('fiche.retirer.titre', { titre: jeu.titre })}
        pied={
          <>
            <Bouton onClick={() => setDialogue(null)}>{t('commun.annuler')}</Bouton>
            <Bouton variante="danger" onClick={() => void retirer()}>
              {t('fiche.retirer')}
            </Bouton>
          </>
        }
      >
        <p>{t('fiche.retirer.texte')}</p>
      </Dialogue>
    </div>
  );
}

/** La fiche d'un jeu. Trois cas avant d'afficher : le jeu n'existe pas, il arrive, il est là. */
export function Fiche({ id_jeu }: { id_jeu: number }) {
  const { t } = useTexte();
  const { detail, erreur } = useDetail(id_jeu);

  if (erreur !== null) {
    const retour = (
      <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'bibliotheque', recherche: '' }}>
        {t('fiche.retour_bibliotheque')}
      </Lien>
    );
    return (
      <div className={styles.introuvable}>
        {erreur.code === 'introuvable' ? (
          // Adresse d'un jeu retiré, masqué par la perte de la clé, ou jamais existé : on l'explique.
          <Message icone="recherche" titre={t('fiche.introuvable.titre')} texte={t('fiche.introuvable.texte')} actions={retour} />
        ) : (
          <ErreurPleine erreur={erreur} actions={retour} />
        )}
      </div>
    );
  }
  if (detail === null) {
    return (
      <div role="status" aria-label={t('commun.chargement')}>
        <Squelette hauteur="clamp(400px, 52vh, 540px)" rayon="0" style={{ display: 'block' }} />
      </div>
    );
  }
  return <FicheDuJeu detail={detail} />;
}
