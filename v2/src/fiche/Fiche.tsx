/**
 * La fiche d'un jeu (V2) : le grand art en haut sur toute la largeur de la fenêtre, le logo centré
 * (Lethal Company), une rangée JOUER avec les statuts et deux grands chiffres en bleu ciel (Steam Redesign,
 * Assassin's Creed Odyssey), une bande de liens, puis des panneaux de verre poli : activité, amis qui y
 * jouent, à propos, captures, succès, sessions.
 */
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { Actualite, Capture, JeuDetail, Source } from '../../contrat/types';
import { LecteurDActualite } from '../actualites/Lecteur';
import { disponible } from '../artefact/images';
import { Bouton, classeBouton } from '../composants/Bouton';
import { Dialogue, Visionneuse } from '../composants/Dialogue';
import { aSignaler, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone, type NomDIcone } from '../composants/Icone';
import { Menu, type ElementDeMenu } from '../composants/Menu';
import { NombreAnime } from '../composants/NombreAnime';
import { BoutonTempsJouer, PileDAvatars, PiluleTag, MotsQuiSeLevent } from '../composants/Visuels';
import { coeur } from '../coeur';
import { useAmbiance } from '../etat/ambiance';
import { definirFavori, definirMasque, tenter, useApplication } from '../etat/application';
import { useDetail } from '../etat/detail';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDate, formaterDateComplete, formaterDateHeure, formaterDateRelative, formaterDureeDeSession, formaterNombre, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien, revenir } from '../navigation';
import { Avatar } from '../profil/Avatar';
import { CarteSucces } from '../succes/CarteSucces';
import { apercu } from '../succes/logique';
import { verdictDAvis } from './logique';
import styles from './Fiche.module.css';

const SANS_OBJET = new Set(['jeu_non_steam', 'jeu_sans_succes']);

function Statut({ icone, nom, valeur, jauge }: { icone: NomDIcone; nom: string; valeur: ReactNode; jauge?: number }) {
  return (
    <div className={styles.statut}>
      <span className={styles.statutIcone}>
        <Icone nom={icone} taille={22} />
      </span>
      <div className={styles.statutTexte}>
        <dt className={styles.statutNom}>{nom}</dt>
        <dd className={styles.statutValeur}>
          {valeur}
          {jauge !== undefined && (
            <span className={styles.jauge} aria-hidden="true">
              <span style={{ '--part': jauge } as CSSProperties} />
            </span>
          )}
        </dd>
      </div>
    </div>
  );
}

/** Les captures en grandes cartes arrondies : une large, deux étroites. Un clic les agrandit. */
function Captures({ captures, titre }: { captures: Capture[]; titre: string }) {
  const { t } = useTexte();
  const [ouverte, setOuverte] = useState<number | null>(null);
  const montrees = captures.slice(0, 3);
  const source = (c: Capture) => (disponible(c.pleine) ? c.pleine : c.miniature);
  return (
    <>
      <ul className={styles.captures} data-nombre={montrees.length}>
        {montrees.map((c, i) => (
          <li key={c.miniature}>
            <button type="button" className={styles.capture} aria-label={t('fiche.agrandir_la_capture', { n: i + 1 })} onClick={() => setOuverte(i)}>
              <img src={i === 0 ? source(c) : c.miniature} alt="" loading="lazy" decoding="async" />
              {i === montrees.length - 1 && captures.length > 3 && <span className={styles.captureReste}>+{captures.length - 3}</span>}
            </button>
          </li>
        ))}
      </ul>
      <Visionneuse images={captures.map((c, i) => ({ src: source(c), alt: t('fiche.capture', { n: i + 1, titre }) }))} ouverte={ouverte} onFermer={() => setOuverte(null)} />
    </>
  );
}

function FicheDuJeu({ detail }: { detail: JeuDetail }) {
  const { t, tp, te, langue } = useTexte();
  const maintenant = useMaintenant();
  const id_jeu = detail.resume.id;
  const jeu = useApplication((a) => a.jeux?.find((j) => j.id === id_jeu)) ?? detail.resume;
  const noms = useApplication((a) => a.tags);
  const reveler = useApplication((a) => a.parametres?.reveler_les_succes_secrets ?? false);
  const fiche = useReponse(() => coeur.fiche_du_jeu(id_jeu), 'fiche', id_jeu, `fiche:${id_jeu}`);
  const succes = useReponse(() => coeur.succes_du_jeu(id_jeu), 'succes', id_jeu, `succes:${id_jeu}`);
  const actualites = useReponse(() => coeur.actualites_du_jeu(id_jeu, 4, null), 'actualites', id_jeu, `actualites:${id_jeu}`);
  const amis = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const [source, setSource] = useState<Source | null>(null);
  const [annonce, setAnnonce] = useState<Actualite | null>(null);
  const [dialogue, setDialogue] = useState<'renommer' | 'retirer' | null>(null);
  const [nouveauTitre, setNouveauTitre] = useState(jeu.titre);

  const art = [detail.hero, detail.en_tete].find((u) => disponible(u)) ?? null;
  useAmbiance(jeu.couleur_dominante, art ?? (disponible(jeu.jaquette) ? jeu.jaquette : null));

  const magasin = fiche.donnees;
  const manuel = jeu.sources.includes('manuel');
  const installees = detail.sources.filter((s) => s.installe).map((s) => s.source);
  const sourceAffichee = source ?? installees[0] ?? null;
  const joueurs = (amis.donnees ?? []).filter((ami) => ami.statut === 'en_jeu' && ami.jeu_en_cours?.id_jeu === id_jeu);
  const enLigne = (amis.donnees ?? []).filter((ami) => ami.statut !== 'hors_ligne' && ami.statut !== 'en_jeu');
  const progression = succes.donnees ?? (jeu.succes === null ? null : { total: jeu.succes.total, debloques: jeu.succes.debloques });
  const verdict = jeu.avis === null ? null : verdictDAvis(jeu.avis.pct_positifs, jeu.avis.nombre);
  const tags: string[] = [];
  if (magasin?.acces_anticipe === true) tags.push(t('fiche.acces_anticipe'));
  for (const id of jeu.tags) {
    const nom = noms.get(id);
    if (nom !== undefined && tags.length < 6) tags.push(nom);
  }
  const derniers = succes.donnees === null ? [] : apercu(succes.donnees.liste, 4);

  // ── Autres actions
  const appid = jeu.steam_appid;
  const actions: ElementDeMenu[] = [];
  if (jeu.installe) actions.push({ cle: 'dossier', libelle: t('fiche.ouvrir_le_dossier'), icone: 'dossier', action: () => void tenter(() => coeur.ouvrir_le_dossier(id_jeu)) });
  if (appid !== null) actions.push({ cle: 'magasin', libelle: t('fiche.voir_dans_le_magasin'), icone: 'lien_externe', action: () => void tenter(() => coeur.action_steam({ action: 'voir_dans_le_magasin', steam_appid: appid })) });
  actions.push({ cle: 'masquer', libelle: jeu.masque ? t('fiche.ne_plus_masquer') : t('fiche.masquer'), icone: jeu.masque ? 'oeil' : 'oeil_barre', action: () => void definirMasque(id_jeu, !jeu.masque) });
  if (manuel) {
    actions.push({ cle: 'renommer', libelle: t('fiche.renommer'), icone: 'crayon', separe: true, action: () => setDialogue('renommer') });
    actions.push({ cle: 'retirer', libelle: t('fiche.retirer'), icone: 'poubelle', danger: true, action: () => setDialogue('retirer') });
  } else if (appid !== null && jeu.installe && jeu.sources.includes('steam')) {
    actions.push({ cle: 'desinstaller', libelle: t('fiche.desinstaller'), icone: 'poubelle', danger: true, separe: true, action: () => void tenter(() => coeur.action_steam({ action: 'desinstaller', steam_appid: appid })) });
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

  const logo = disponible(detail.logo) ? detail.logo : null;
  const quand = jeu.temps.dernier_lancement === null ? null : formaterDateRelative(jeu.temps.dernier_lancement, langue, maintenant);

  return (
    <div className={styles.fiche}>
      {/* ── Le grand art, sur toute la largeur */}
      <section className={styles.hero} aria-labelledby="fiche-titre" data-parallaxe="">
        <div className={styles.heroArt} aria-hidden="true" data-affiche={art === null ? '' : undefined}>
          {art !== null ? (
            <img src={art} alt="" fetchPriority="high" decoding="async" />
          ) : (
            disponible(jeu.jaquette) && (
              <>
                <img className={styles.heroFlou} src={jeu.jaquette} alt="" decoding="async" />
                <img className={styles.heroAffiche} src={jeu.jaquette} alt="" decoding="async" />
              </>
            )
          )}
        </div>
        <button type="button" className={styles.retour} onClick={revenir}>
          <Icone nom="retour" taille={18} />
          {t('commun.retour')}
        </button>
        <div className={styles.heroCentre}>
          {logo !== null ? (
            <h1 id="fiche-titre" className={styles.logo}>
              <img src={logo} alt={jeu.titre} decoding="async" />
            </h1>
          ) : (
            <h1 id="fiche-titre" className={styles.titre}>
              <MotsQuiSeLevent texte={jeu.titre} />
            </h1>
          )}
          {magasin !== null && magasin.developpeurs.length > 0 && <p className={styles.studio}>{magasin.developpeurs.join(' · ')}</p>}
        </div>
      </section>

      <div className={styles.corps}>
        {/* ── JOUER et les statuts */}
        <div className={`${styles.rangeeJouer} cascade`}>
          <div className={styles.jouer}>
            <BoutonTempsJouer jeu={jeu} sansTemps />
            {jeu.installe && installees.length > 1 && sourceAffichee !== null && (
              <Menu
                classeDuBouton={styles.rond ?? ''}
                nom={t('fiche.source_de_lancement', { source: t(`sources.${sourceAffichee}`) })}
                contenu={<Icone nom="chevron_bas" taille={18} />}
                elements={installees.map((s) => ({ cle: s, libelle: t(`sources.${s}`), coche: s === sourceAffichee, action: () => setSource(s) }))}
              />
            )}
          </div>
          <dl className={styles.statuts}>
            <Statut icone="horloge" nom={t('liste.temps')} valeur={<NombreAnime valeur={jeu.temps.minutes_total} format={(m) => (m > 0 ? formaterTempsDeJeu(Math.round(m), langue) : t('jeu.jamais_lance'))} />} />
            {quand !== null && <Statut icone="jouer" nom={t('tri.dernier_lancement')} valeur={quand} />}
          </dl>
          {(verdict !== null || (progression !== null && progression.total > 0)) && (
            <dl className={styles.grandsChiffres}>
              {jeu.avis !== null && verdict !== null && (
                <div className={styles.grandChiffre}>
                  <dt className="etiquette">
                    <Icone nom="avis" taille={16} /> {t('v2.avis_de_steam')}
                  </dt>
                  <dd>
                    <span className={`${styles.grandMot} texte-degrade`}>{t(`v2.avis.${verdict}`)}</span>
                    <span className={`${styles.grandDetail} chiffres`}>({formaterNombre(jeu.avis.nombre, langue)})</span>
                  </dd>
                </div>
              )}
              {progression !== null && progression.total > 0 && (
                <div className={styles.grandChiffre}>
                  <dt className="etiquette">
                    <Icone nom="trophee" taille={16} /> {t('fiche.succes')}
                  </dt>
                  <dd>
                    <span className={`${styles.grandMot} texte-degrade chiffres`}>
                      {progression.debloques === null ? formaterNombre(progression.total, langue) : <NombreAnime valeur={progression.debloques} format={(n) => `${Math.round(n)} / ${progression.total}`} />}
                    </span>
                    {progression.debloques !== null && (
                      <span className={styles.jaugeLarge} aria-hidden="true">
                        <span style={{ '--part': progression.debloques / progression.total } as CSSProperties} />
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* ── Bande de liens */}
        <nav className={`${styles.liens} verre-poli`} aria-label={t('v2.liens')}>
          {jeu.succes !== null && (
            <Lien className={styles.lien} vers={{ ecran: 'succes', id_jeu }}>
              <Icone nom="trophee" taille={17} />
              {t('fiche.succes')}
            </Lien>
          )}
          <Lien className={styles.lien} vers={{ ecran: 'actualites' }}>
            <Icone nom="journal" taille={17} />
            {t('coque.actualites')}
          </Lien>
          {jeu.installe && (
            <button type="button" className={styles.lien} onClick={() => void tenter(() => coeur.ouvrir_le_dossier(id_jeu))}>
              <Icone nom="dossier" taille={17} />
              {t('v2.dossier_local')}
            </button>
          )}
          {appid !== null && (
            <button type="button" className={styles.lien} onClick={() => void tenter(() => coeur.action_steam({ action: 'voir_dans_le_magasin', steam_appid: appid }))}>
              <Icone nom="lien_externe" taille={17} />
              {t('v2.page_magasin')}
            </button>
          )}
          <button type="button" className={styles.lien} aria-pressed={jeu.favori} onClick={() => void definirFavori(id_jeu, !jeu.favori)}>
            <Icone nom={jeu.favori ? 'etoile_pleine' : 'etoile'} taille={17} />
            {jeu.favori ? t('fiche.retirer_des_favoris') : t('fiche.ajouter_aux_favoris')}
          </button>
          <span className={styles.liensFin}>
            <Menu classeDuBouton={styles.rond ?? ''} nom={t('fiche.autres_actions')} alignement="droite" contenu={<Icone nom="autres" taille={20} />} elements={actions} />
          </span>
        </nav>

        <div className={styles.colonnes}>
          <div className={styles.principale}>
            {/* ── Captures */}
            {magasin !== null && magasin.captures.length > 0 && (
              <section aria-labelledby="fiche-captures">
                <h2 id="fiche-captures" className={styles.titreSection}>
                  {t('fiche.captures')}
                </h2>
                <Captures captures={magasin.captures} titre={jeu.titre} />
              </section>
            )}

            {/* ── Activité */}
            <section className={`${styles.panneau} verre-poli`} aria-labelledby="fiche-activite">
              <h2 id="fiche-activite" className={styles.titrePanneau}>
                {t('v2.activite')}
              </h2>
              {actualites.vue === 'chargement' && <Squelette hauteur="120px" rayon="16px" />}
              {actualites.donnees !== null && actualites.donnees.length > 0 ? (
                <ul className={styles.activite}>
                  {actualites.donnees.map((a) => (
                    <li key={a.id}>
                      <button type="button" className={styles.nouvelle} onClick={() => setAnnonce(a)}>
                        <span className={styles.nouvelleImage}>{disponible(a.image) ? <img src={a.image} alt="" loading="lazy" decoding="async" /> : <Icone nom="journal" taille={28} />}</span>
                        <span className={styles.nouvelleTexte}>
                          <span className="etiquette">
                            {t(`actualite.type.${a.type}`)} · {formaterDate(a.date, langue, maintenant)}
                          </span>
                          <span className={styles.nouvelleTitre}>{a.titre}</span>
                          <span className={styles.nouvelleResume}>{a.resume}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                actualites.vue !== 'chargement' && <p className={styles.discret}>{actualites.erreur?.code === 'jeu_non_steam' ? t('fiche.hors_steam') : t('fiche.aucune_actualite')}</p>
              )}
            </section>

            {/* ── Succès récents */}
            {derniers.length > 0 && (
              <section className={`${styles.panneau} verre-poli`} aria-labelledby="fiche-succes">
                <div className={styles.titreAvecLien}>
                  <h2 id="fiche-succes" className={styles.titrePanneau}>
                    {t('fiche.succes')}
                  </h2>
                  <Lien className={styles.voir} vers={{ ecran: 'succes', id_jeu }}>
                    {tp('fiche.voir_les_succes', progression?.total ?? derniers.length)}
                    <Icone nom="chevron_droit" taille={16} />
                  </Lien>
                </div>
                <ul className={styles.succes}>
                  {derniers.map((s) => (
                    <CarteSucces key={s.api_name} succes={s} reveler={reveler} compacte />
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className={styles.cote}>
            {/* ── Amis qui y jouent */}
            <section className={`${styles.panneau} verre-poli`} aria-labelledby="fiche-amis">
              <h2 id="fiche-amis" className={styles.titrePanneau}>
                {t('v2.fiche.amis')}
              </h2>
              {joueurs.length > 0 ? (
                <>
                  <p className={styles.phrase}>{tp('fiche.amis_y_jouent', joueurs.length)}</p>
                  <ul className={styles.amis}>
                    {joueurs.map((ami) => (
                      <li key={ami.steamid} className={styles.ami}>
                        <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={38} />
                        <span>{ami.pseudo}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className={styles.phrase}>{t('v2.fiche.amis_aucun')}</p>
              )}
              {enLigne.length > 0 && (
                <>
                  <p className={styles.phrase}>{tp('v2.amis_en_ligne', enLigne.length)}</p>
                  <PileDAvatars amis={enLigne} max={7} taille={34} />
                </>
              )}
            </section>

            {/* ── À propos (carte de verre de la référence 03) */}
            <section className={`${styles.panneau} verre-poli`} aria-labelledby="fiche-a-propos">
              <h2 id="fiche-a-propos" className={styles.titrePanneau}>
                {t('fiche.a_propos')}
              </h2>
              {fiche.vue === 'chargement' && <Squelette hauteur="80px" rayon="12px" />}
              {magasin !== null && (
                <p className={styles.description} lang={magasin.langue}>
                  {magasin.description_courte}
                </p>
              )}
              {aSignaler(fiche.erreur, magasin !== null) && !SANS_OBJET.has(fiche.erreur.code) && (
                <Note icone={iconeDErreur(fiche.erreur)}>{magasin === null ? t('fiche.presentation_indisponible', { raison: te(fiche.erreur) }) : t('fiche.donnees_enregistrees', { raison: te(fiche.erreur) })}</Note>
              )}
              {fiche.erreur?.code === 'jeu_non_steam' && <p className={styles.discret}>{t('fiche.hors_steam')}</p>}
              {tags.length > 0 && (
                <div className={styles.tags}>
                  {tags.map((nom) => (
                    <PiluleTag key={nom} petite>
                      {nom}
                    </PiluleTag>
                  ))}
                </div>
              )}
              <dl className={styles.infos}>
                {jeu.date_sortie !== null && (
                  <div>
                    <dt>
                      <Icone nom="calendrier" taille={16} /> {t('v2.sortie_le')}
                    </dt>
                    <dd>{formaterDateComplete(jeu.date_sortie, langue)}</dd>
                  </div>
                )}
                {magasin !== null && magasin.editeurs.length > 0 && (
                  <div>
                    <dt>{t('fiche.editeur')}</dt>
                    <dd>{magasin.editeurs.join(', ')}</dd>
                  </div>
                )}
                {jeu.modes.length > 0 && (
                  <div>
                    <dt>{t('fiche.modes')}</dt>
                    <dd>{jeu.modes.map((m) => t(`mode.${m}`)).join(', ')}</dd>
                  </div>
                )}
                {magasin !== null && magasin.joueurs_en_ligne !== null && (
                  <div>
                    <dt>{t('fiche.joueurs_en_ligne')}</dt>
                    <dd className="chiffres">{formaterNombre(magasin.joueurs_en_ligne, langue)}</dd>
                  </div>
                )}
                <div>
                  <dt>{t('tri.ajoute_le')}</dt>
                  <dd>{formaterDateComplete(jeu.ajoute_le, langue)}</dd>
                </div>
              </dl>
            </section>

            {/* ── Sessions */}
            <section className={`${styles.panneau} verre-poli`} aria-labelledby="fiche-sessions">
              <h2 id="fiche-sessions" className={styles.titrePanneau}>
                {t('fiche.sessions')}
              </h2>
              {detail.sessions_recentes.length === 0 ? (
                <p className={styles.discret}>{t('fiche.aucune_session')}</p>
              ) : (
                <ul className={styles.sessions}>
                  {detail.sessions_recentes.map((s) => (
                    <li key={s.id}>
                      <span>{formaterDateHeure(s.debut, langue, maintenant)}</span>
                      <span className={`${styles.sessionDuree} chiffres`}>{s.fin === null ? t('fiche.session_en_cours') : formaterDureeDeSession(s.duree_s, langue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      <LecteurDActualite actualite={annonce} jeu={jeu.titre} onFermer={() => setAnnonce(null)} />
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
        <form id="fiche-renommer" onSubmit={(e) => void renommer(e)}>
          <input className={styles.champ} aria-label={t('fiche.nouveau_titre')} value={nouveauTitre} maxLength={120} autoFocus onChange={(e) => setNouveauTitre(e.target.value)} />
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
      <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'bibliotheque', recherche: '', tout: true }}>
        {t('fiche.retour_bibliotheque')}
      </Lien>
    );
    return (
      <div className={styles.introuvable}>
        {erreur.code === 'introuvable' ? <Message icone="recherche" titre={t('fiche.introuvable.titre')} texte={t('fiche.introuvable.texte')} actions={retour} /> : <ErreurPleine erreur={erreur} actions={retour} />}
      </div>
    );
  }
  if (detail === null) {
    return (
      <div role="status" aria-label={t('commun.chargement')}>
        <Squelette hauteur="460px" rayon="0" style={{ display: 'block' }} />
      </div>
    );
  }
  return <FicheDuJeu detail={detail} />;
}
