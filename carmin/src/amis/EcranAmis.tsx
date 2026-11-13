import { useId, useMemo, useState, type ReactNode } from 'react';
import type { Ami, ErreurApp, JeuResume } from '../../contrat/types';
import { Bouton, classeBouton } from '../composants/Bouton';
import { BoutonJouer } from '../composants/BoutonJouer';
import { couleurDeJeu } from '../composants/couleur';
import { aSignaler, classeActionDeNote, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Menu, type ElementDeMenu } from '../composants/Menu';
import { Page } from '../composants/Page';
import { coeur } from '../coeur';
import { vautUnNouvelEssai } from '../coeur/erreurs';
import { useAmbiance } from '../etat/ambiance';
import { tenter, useApplication } from '../etat/application';
import { useDetail } from '../etat/detail';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDateRelative, formaterNombre } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien, naviguer } from '../navigation';
import { Avatar } from '../profil/Avatar';
import { filtrerLesAmis, repartirLesAmis, SEUIL_DU_FILTRE, type CleDeGroupe, type Partie } from './logique';
import styles from './Amis.module.css';

/** Erreurs que le joueur règle lui-même, côté clé ou côté confidentialité Steam : on lui dit quoi faire. */
const CODES_A_REGLER = ['cle_absente', 'cle_refusee', 'profil_prive', 'amis_prives'] as const;
type CodeARegler = (typeof CODES_A_REGLER)[number];

function estARegler(erreur: ErreurApp): erreur is ErreurApp & { code: CodeARegler } {
  return (CODES_A_REGLER as readonly string[]).includes(erreur.code);
}

/** La confidentialité se change dans Steam, pas ici : après l'avoir fait, le joueur doit pouvoir relire sans quitter l'écran. */
const PEUT_REESSAYER = new Set<string>(['profil_prive', 'amis_prives']);

type Vue = 'tous' | CleDeGroupe;

/**
 * Ce que l'on peut faire avec un ami : lui écrire, voir son profil, et rejoindre son jeu du regard
 * (sa fiche chez nous, sinon sa page dans le magasin). Un clic sur un ami ouvre ce menu, où qu'il soit sur l'écran.
 */
function useActions(ami: Ami): ElementDeMenu[] {
  const { t } = useTexte();
  const actions: ElementDeMenu[] = [
    { cle: 'message', libelle: t('amis.envoyer_un_message'), icone: 'message', action: () => void tenter((c) => c.action_steam({ action: 'envoyer_un_message', steamid: ami.steamid })) },
    { cle: 'profil', libelle: t('amis.voir_le_profil'), icone: 'utilisateur', action: () => void tenter((c) => c.action_steam({ action: 'ouvrir_le_profil', steamid: ami.steamid })) },
  ];
  const jeu = ami.statut === 'en_jeu' ? ami.jeu_en_cours : null;
  if (jeu === null) return actions;
  const { id_jeu, steam_appid, titre } = jeu;
  if (id_jeu !== null) {
    actions.push({ cle: 'fiche', libelle: t('amis.partie.voir_la_fiche', { titre }), icone: 'manette', separe: true, action: () => naviguer({ ecran: 'jeu', id_jeu }) });
  } else if (steam_appid !== null) {
    actions.push({
      cle: 'magasin',
      libelle: t('amis.partie.voir_dans_le_magasin', { titre }),
      icone: 'lien_externe',
      separe: true,
      action: () => void tenter((c) => c.action_steam({ action: 'voir_dans_le_magasin', steam_appid })),
    });
  }
  return actions;
}

/** Un ami, sous n'importe quelle forme : le bouton ouvre le menu de ses actions. */
function BoutonDAmi({ ami, classe, children }: { ami: Ami; classe: string | undefined; children: ReactNode }) {
  return <Menu classeDuBouton={classe ?? ''} contenu={children} elements={useActions(ami)} />;
}

/** La première lettre du titre, en grand, quand un jeu n'a aucune image. */
function initialeDe(titre: string): string {
  return [...titre.trim()][0]?.toLocaleUpperCase() ?? '';
}

/**
 * Le titre d'une partie et l'action qui compte : le lien vers sa fiche et le bouton Jouer si le jeu est
 * chez nous, sinon sa page dans le magasin Steam, sinon rien (un jeu hors Steam).
 */
function useLienDePartie(partie: Partie, jeu: JeuResume | undefined, contenu: ReactNode) {
  const { t } = useTexte();
  const { titre, id_jeu, steam_appid } = partie.jeu;
  if (id_jeu !== null) {
    return {
      etat: jeu?.installe === true ? t('jeu.installe') : t('amis.partie.possede'),
      lien: (
        <Lien className={styles.lienDuJeu} vers={{ ecran: 'jeu', id_jeu }}>
          {contenu}
        </Lien>
      ),
      action: jeu === undefined ? null : <BoutonJouer jeu={jeu} />,
      fiche: id_jeu,
    };
  }
  if (steam_appid !== null) {
    const voir = () => void tenter((c) => c.action_steam({ action: 'voir_dans_le_magasin', steam_appid }));
    return {
      etat: t('amis.partie.magasin'),
      lien: (
        <button type="button" className={styles.lienDuJeu} aria-label={t('amis.partie.voir_dans_le_magasin', { titre })} onClick={voir}>
          {contenu}
        </button>
      ),
      action: (
        <Bouton variante="voile" onClick={voir}>
          <Icone nom="lien_externe" taille={18} />
          {t('fiche.voir_dans_le_magasin')}
        </Bouton>
      ),
      fiche: null,
    };
  }
  return { etat: t('amis.partie.hors_steam'), lien: <span className={styles.lienDuJeu}>{contenu}</span>, action: null, fiche: null };
}

/** Les images d'un jeu qui n'ont pas chargé sont oubliées : l'écran passe à la suivante (grande image, jaquette, initiale). */
function useImagesDePartie(partie: Partie) {
  const { detail } = useDetail(partie.jeu.id_jeu);
  const [echecs, setEchecs] = useState<ReadonlySet<string>>(new Set());
  const echouer = (adresse: string) => setEchecs((avant) => new Set(avant).add(adresse));
  const valable = (adresse: string | null | undefined) => (adresse === null || adresse === undefined || echecs.has(adresse) ? null : adresse);
  return { hero: valable(detail?.hero), logo: valable(detail?.logo), affiche: valable(partie.jeu.jaquette), echouer };
}

/** Les amis d'une partie : une pastille par ami, son avatar et son pseudo. Tous y sont, la rangée passe à la ligne. */
function Joueurs({ amis }: { amis: readonly Ami[] }) {
  return (
    <ul className={styles.joueurs}>
      {amis.map((ami) => (
        <li key={ami.steamid}>
          <BoutonDAmi ami={ami} classe={styles.joueur}>
            <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={24} />
            <span className={styles.joueurNom}>{ami.pseudo}</span>
          </BoutonDAmi>
        </li>
      ))}
    </ul>
  );
}

/**
 * La partie qui rassemble le plus d'amis, en grand : l'image du jeu, son titre, les amis qui y jouent
 * et le bouton Jouer. Rien n'y bouge.
 */
function Scene({ partie, jeu }: { partie: Partie; jeu: JeuResume | undefined }) {
  const { t, tp } = useTexte();
  const { hero, logo, affiche, echouer } = useImagesDePartie(partie);
  const { titre, couleur_dominante: couleur } = partie.jeu;
  const { etat, lien, action, fiche } = useLienDePartie(
    partie,
    jeu,
    logo !== null ? <img className={styles.logo} src={logo} alt={titre} draggable={false} onError={() => echouer(logo)} /> : titre,
  );

  return (
    <article {...couleurDeJeu(couleur)} className={styles.scene}>
      {hero !== null && (
        <div className={styles.sceneFond} aria-hidden="true">
          <img src={hero} alt="" draggable={false} decoding="async" onError={() => echouer(hero)} />
        </div>
      )}

      <div className={styles.sceneTexte}>
        <p className={styles.faits}>
          <span className={styles.direct}>{t('amis.salle.direct')}</span>
          <span>{tp('amis.salle.ensemble', partie.amis.length)}</span>
          <span>{etat}</span>
        </p>
        <h3 className={styles.sceneTitre}>{lien}</h3>
        <Joueurs amis={partie.amis} />
        <div className={styles.sceneActions}>
          {action}
          {fiche !== null && (
            <Lien className={classeBouton({ variante: 'voile' })} vers={{ ecran: 'jeu', id_jeu: fiche }}>
              {t('amis.salle.voir_la_fiche')}
              <Icone nom="chevron_droit" taille={18} />
            </Lien>
          )}
        </div>
      </div>

      {/* Sans grande image, la jaquette tient lieu de visuel, à droite. */}
      {hero === null && affiche !== null && (
        <span className={styles.sceneJaquette} aria-hidden="true">
          <img src={affiche} alt="" width={300} height={450} draggable={false} decoding="async" onError={() => echouer(affiche)} />
        </span>
      )}
    </article>
  );
}

/**
 * Une autre partie en cours : une carte, l'image du jeu en haut, puis son titre et les amis qui y jouent.
 * Toute la carte mène au jeu ; chaque ami garde son propre bouton.
 */
function CarteDePartie({ partie, jeu }: { partie: Partie; jeu: JeuResume | undefined }) {
  const { hero, affiche, echouer } = useImagesDePartie(partie);
  const { titre, couleur_dominante: couleur } = partie.jeu;
  const { etat, lien } = useLienDePartie(partie, jeu, titre);

  return (
    <li {...couleurDeJeu(couleur)} className={styles.partie}>
      <span className={styles.partieVisuel} aria-hidden="true">
        {hero !== null ? (
          <img className={styles.partieImage} src={hero} alt="" loading="lazy" decoding="async" draggable={false} onError={() => echouer(hero)} />
        ) : affiche !== null ? (
          <img className={styles.partieJaquette} src={affiche} alt="" width={300} height={450} loading="lazy" decoding="async" draggable={false} onError={() => echouer(affiche)} />
        ) : (
          <span className={styles.partieInitiale}>{initialeDe(titre)}</span>
        )}
      </span>
      <div className={styles.partieCorps}>
        <h3 className={styles.partieTitre}>{lien}</h3>
        <p className={styles.etat}>{etat}</p>
        <Joueurs amis={partie.amis} />
      </div>
    </li>
  );
}

function TitreDeGroupe({ id, cle, nombre }: { id: string; cle: CleDeGroupe; nombre: number }) {
  const { t, langue } = useTexte();
  return (
    <h2 id={id} className={`titre-section ${styles.titreDeGroupe}`}>
      {t(`amis.groupe.${cle}`)}
      <span className={`${styles.compte} chiffres`}>{formaterNombre(nombre, langue)}</span>
    </h2>
  );
}

/** Ce qui se joue en ce moment : la partie la plus peuplée en grand, les autres en cartes. */
function Salle({ parties, jeux }: { parties: Partie[]; jeux: ReadonlyMap<number, JeuResume> }) {
  const { t } = useTexte();
  const id = useId();
  const [premiere, ...autres] = parties;
  const joueurs = parties.reduce((total, partie) => total + partie.amis.length, 0);
  const jeuDe = (partie: Partie) => (partie.jeu.id_jeu === null ? undefined : jeux.get(partie.jeu.id_jeu));
  if (premiere === undefined) return null;
  return (
    <section className={styles.groupe} aria-labelledby={id}>
      <TitreDeGroupe id={id} cle="en_jeu" nombre={joueurs} />
      <Scene key={premiere.cle} partie={premiere} jeu={jeuDe(premiere)} />
      {autres.length > 0 && (
        <>
          <h3 className={styles.sousTitre}>{t('amis.salle.autres')}</h3>
          <ul className={styles.parties}>
            {autres.map((partie) => (
              <CarteDePartie key={partie.cle} partie={partie} jeu={jeuDe(partie)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Les amis connectés qui ne jouent pas : leur avatar, une pastille pour leur statut, leur pseudo. */
function EnLigne({ amis }: { amis: Ami[] }) {
  const { t } = useTexte();
  const id = useId();
  return (
    <section className={styles.groupe} aria-labelledby={id}>
      <TitreDeGroupe id={id} cle="en_ligne" nombre={amis.length} />
      <ul className={styles.connectes}>
        {amis.map((ami) => (
          <li key={ami.steamid}>
            <BoutonDAmi ami={ami} classe={styles.connecte}>
              <span className={styles.portrait} data-statut={ami.statut}>
                <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={56} />
              </span>
              <span className={styles.connecteNom}>{ami.pseudo}</span>
              <span className={styles.connecteStatut}>{t(`amis.statut.${ami.statut}`)}</span>
            </BoutonDAmi>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Les amis hors ligne : en sourdine, sans couleur, avec la date de leur dernière connexion. */
function HorsLigne({ amis }: { amis: Ami[] }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const id = useId();
  return (
    <section className={styles.groupe} aria-labelledby={id}>
      <TitreDeGroupe id={id} cle="hors_ligne" nombre={amis.length} />
      <ul className={styles.eteints}>
        {amis.map((ami) => (
          <li key={ami.steamid}>
            <BoutonDAmi ami={ami} classe={styles.eteint}>
              <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={32} />
              <span className={styles.eteintTexte}>
                <span className={styles.eteintNom}>{ami.pseudo}</span>
                {/* « Hier » au milieu d'une phrase prend une minuscule : « Vu hier ». */}
                {ami.derniere_connexion !== null && (
                  <span className={styles.vu}>{t('amis.vu', { quand: formaterDateRelative(ami.derniere_connexion, langue, maintenant).toLocaleLowerCase(langue) })}</span>
                )}
              </span>
            </BoutonDAmi>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Les pastilles qui choisissent ce que l'on voit : tout, ou un seul groupe. Chacune porte son compte. */
function Filtres({ vue, comptes, onChanger }: { vue: Vue; comptes: Record<CleDeGroupe, number>; onChanger: (vue: Vue) => void }) {
  const { t, langue } = useTexte();
  const options: [Vue, number][] = [
    ['tous', comptes.en_jeu + comptes.en_ligne + comptes.hors_ligne],
    ['en_jeu', comptes.en_jeu],
    ['en_ligne', comptes.en_ligne],
    ['hors_ligne', comptes.hors_ligne],
  ];
  return (
    <div className={styles.filtres} role="group" aria-label={t('amis.filtre.vues')}>
      {options.map(([cle, nombre]) => (
        <Bouton key={cle} aria-pressed={cle === vue} disabled={cle !== 'tous' && nombre === 0} onClick={() => onChanger(cle)}>
          <span>{cle === 'tous' ? t('amis.filtre.tous') : t(`amis.groupe.${cle}`)}</span>
          <span className={`${styles.nombre} chiffres`}>{formaterNombre(nombre, langue)}</span>
        </Bouton>
      ))}
    </div>
  );
}

/** Le champ qui filtre par pseudo ou par jeu, et l'annonce du nombre de résultats pour les lecteurs d'écran. */
function ChampDeFiltre({ texte, onChanger, annonce }: { texte: string; onChanger: (texte: string) => void; annonce: string }) {
  const { t } = useTexte();
  return (
    <div className={styles.filtre} role="search">
      <span className={styles.loupe}>
        <Icone nom="recherche" taille={18} />
      </span>
      <input
        type="search"
        className={styles.champ}
        value={texte}
        placeholder={t('amis.filtre.nom')}
        aria-label={t('amis.filtre.nom')}
        autoComplete="off"
        spellCheck={false}
        onChange={(evenement) => onChanger(evenement.target.value)}
      />
      <p className="hors-ecran" role="status">
        {annonce}
      </p>
    </div>
  );
}

function ErreurSansAmis({ erreur, reessayer }: { erreur: ErreurApp; reessayer: () => void }) {
  const { t, te } = useTexte();
  if (!estARegler(erreur)) return <ErreurPleine erreur={erreur} reessayer={reessayer} />;
  return (
    <div role="alert">
      <Message
        icone={iconeDErreur(erreur)}
        titre={te(erreur)}
        texte={t(`amis.erreur.${erreur.code}`)}
        actions={
          <>
            <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'parametres', section: 'steam' }}>
              {t('bibliotheque.partielle.action')}
            </Lien>
            {PEUT_REESSAYER.has(erreur.code) && (
              <Bouton onClick={reessayer}>
                <Icone nom="rafraichir" taille={18} />
                {t('commun.reessayer')}
              </Bouton>
            )}
          </>
        }
      />
    </div>
  );
}

function NoteDAmis({ erreur, reessayer }: { erreur: ErreurApp; reessayer: () => void }) {
  const { t, te } = useTexte();
  return (
    <div className={styles.note}>
      <Note
        icone={iconeDErreur(erreur)}
        action={
          vautUnNouvelEssai(erreur) && (
            <button type="button" className={classeActionDeNote} onClick={reessayer}>
              {t('commun.reessayer')}
            </button>
          )
        }
      >
        {t('fiche.donnees_enregistrees', { raison: te(erreur) })}
      </Note>
    </div>
  );
}

export function EcranAmis() {
  const { t, tp, langue } = useTexte();
  const amis = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const jeux = useApplication((a) => a.jeux);
  const [texte, setTexte] = useState('');
  const [choix, setChoix] = useState<Vue>('tous');

  const jeuxParId = useMemo(() => new Map((jeux ?? []).map((jeu) => [jeu.id, jeu])), [jeux]);
  const donnees = amis.donnees;
  const total = donnees?.length ?? 0;
  const filtreVisible = total > SEUIL_DU_FILTRE;
  // Le champ disparaît si la liste redescend sous le seuil : un texte caché ne doit plus filtrer.
  const recherche = filtreVisible ? texte : '';
  // L'ambiance vient de tous les amis ; les trois zones et leurs comptes, de ceux que le filtre retient.
  const tous = useMemo(() => repartirLesAmis(donnees ?? [], langue), [donnees, langue]);
  const retenus = useMemo(() => filtrerLesAmis(donnees ?? [], recherche), [donnees, recherche]);
  const zones = useMemo(() => repartirLesAmis(retenus, langue), [retenus, langue]);
  const aucunResultat = donnees !== null && total > 0 && retenus.length === 0;

  // En arrivant, le fond prend la couleur de la partie la plus suivie.
  useAmbiance(tous.parties[0]?.jeu.couleur_dominante ?? null);

  const avecDonnees = amis.vue === 'donnees' && donnees !== null;
  const comptes: Record<CleDeGroupe, number> = {
    en_jeu: zones.parties.reduce((somme, partie) => somme + partie.amis.length, 0),
    en_ligne: zones.connectes.length,
    hors_ligne: zones.horsLigne.length,
  };
  // Un groupe choisi que le filtre de texte a vidé : on revient à tout, plutôt qu'à un écran vide.
  const vue: Vue = choix !== 'tous' && comptes[choix] === 0 ? 'tous' : choix;
  const montrer = (cle: CleDeGroupe) => vue === 'tous' || vue === cle;

  return (
    <Page
      titre={t('coque.amis')}
      sousTitre={avecDonnees ? tp('amis.nombre', total) : undefined}
      actions={
        avecDonnees && !aucunResultat ? (
          <>
            <Filtres vue={vue} comptes={comptes} onChanger={setChoix} />
            {filtreVisible && <ChampDeFiltre texte={texte} onChanger={setTexte} annonce={recherche.trim() === '' ? '' : tp('amis.filtre.resultats', retenus.length)} />}
          </>
        ) : avecDonnees && filtreVisible ? (
          <ChampDeFiltre texte={texte} onChanger={setTexte} annonce={tp('amis.filtre.resultats', retenus.length)} />
        ) : undefined
      }
    >
      {amis.vue === 'chargement' && (
        <div role="status" aria-label={t('commun.chargement')} className={styles.attente}>
          <Squelette rayon="var(--rayon-xl)" hauteur="320px" style={{ display: 'block' }} />
          <div className={styles.attenteRangee}>
            {[0, 1, 2, 3].map((n) => (
              <Squelette key={n} rayon="var(--rayon-l)" hauteur="230px" style={{ display: 'block' }} />
            ))}
          </div>
        </div>
      )}

      {amis.vue === 'erreur' && amis.erreur !== null && <ErreurSansAmis erreur={amis.erreur} reessayer={amis.reessayer} />}

      {amis.vue === 'vide' && (
        <>
          {aSignaler(amis.erreur, true) && <NoteDAmis erreur={amis.erreur} reessayer={amis.reessayer} />}
          <Message icone="amis" titre={t('amis.vide.titre')} texte={t('amis.vide.texte')} />
        </>
      )}

      {amis.vue === 'donnees' && aSignaler(amis.erreur, true) && <NoteDAmis erreur={amis.erreur} reessayer={amis.reessayer} />}

      {amis.vue === 'donnees' && aucunResultat && (
        <Message
          icone="recherche"
          titre={t('amis.filtre.aucun.titre')}
          texte={t('amis.filtre.aucun.texte', { texte: texte.trim() })}
          actions={<Bouton onClick={() => setTexte('')}>{t('amis.filtre.effacer')}</Bouton>}
        />
      )}

      {/* Les zones sont des enfants directs de la page : chacune entre à son tour. */}
      {amis.vue === 'donnees' && montrer('en_jeu') && zones.parties.length > 0 && <Salle parties={zones.parties} jeux={jeuxParId} />}
      {amis.vue === 'donnees' && montrer('en_ligne') && zones.connectes.length > 0 && <EnLigne amis={zones.connectes} />}
      {amis.vue === 'donnees' && montrer('hors_ligne') && zones.horsLigne.length > 0 && <HorsLigne amis={zones.horsLigne} />}
    </Page>
  );
}
