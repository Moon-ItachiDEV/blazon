import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Ami, ErreurApp, JeuResume } from '../../contrat/types';
import { Bouton, classeBouton } from '../composants/Bouton';
import { BoutonJouer } from '../composants/BoutonJouer';
import { couleurDeJeu } from '../composants/couleur';
import { aSignaler, classeActionDeNote, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Menu, type ElementDeMenu } from '../composants/Menu';
import { NombreAnime } from '../composants/NombreAnime';
import { Page } from '../composants/Page';
import { suiviDeListe } from '../composants/pointeur';
import { coeur } from '../coeur';
import { vautUnNouvelEssai } from '../coeur/erreurs';
import { ambiance, useAmbiance } from '../etat/ambiance';
import { tenter, useApplication } from '../etat/application';
import { useDetail } from '../etat/detail';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDateRelative, formaterNombre } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien, naviguer } from '../navigation';
import { useIndicateur } from '../parametres/indicateur';
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

/** Au-delà, les éléments n'attendent plus leur tour pour entrer : la fin d'une longue liste n'arrive pas une seconde après le début. */
const RANG_MAX = 14;
/** Dans la grande scène, la pile n'aligne pas plus d'avatars : les suivants sont résumés par « +n ». */
const PILE_MAX = 6;

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

/** L'avatar dans son anneau : néon au dégradé pour qui joue ou est en ligne, couleur du statut sinon. */
function Anneau({ ami, taille }: { ami: Ami; taille: number }) {
  return (
    <span className={styles.anneau} data-statut={ami.statut} style={{ '--taille': `${taille}px` } as CSSProperties}>
      <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={taille} />
    </span>
  );
}

/** La première lettre du titre, en très grand, quand un jeu n'a pas d'image. */
function initialeDe(titre: string): string {
  return [...titre.trim()][0]?.toLocaleUpperCase() ?? '';
}

/**
 * Le titre d'une partie et l'action qui compte : le lien vers sa fiche et le bouton Jouer si le jeu est
 * chez nous, sinon sa page dans le magasin Steam, sinon rien (un jeu hors Steam).
 */
function useLienDePartie(partie: Partie, jeu: JeuResume | undefined, grand: boolean, contenu: ReactNode) {
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
      action: jeu === undefined ? null : <BoutonJouer jeu={jeu} grand={grand} />,
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
        <Bouton variante="voile" grand={grand} onClick={voir}>
          <Icone nom="lien_externe" taille={grand ? 22 : 18} />
          {t('fiche.voir_dans_le_magasin')}
        </Bouton>
      ),
      fiche: null,
    };
  }
  return { etat: t('amis.partie.hors_steam'), lien: <span className={styles.lienDuJeu}>{contenu}</span>, action: null, fiche: null };
}

/** La scène suit le pointeur : l'image glisse un peu à l'opposé, la jaquette penche vers lui. */
const suiviDeLaScene = suiviDeListe('[data-scene]');
/** Les petites bannières aussi : un reflet suit le pointeur. */
const suiviDesBannieres = suiviDeListe('[data-banniere]');

/**
 * La pièce maîtresse : la partie qui rassemble le plus d'amis, en très grand. La grande image du jeu
 * dérive lentement, les amis s'empilent en avatars qui respirent, et le bouton Jouer est à portée.
 */
function Scene({ partie, jeu }: { partie: Partie; jeu: JeuResume | undefined }) {
  const { t, tp, langue } = useTexte();
  const { detail } = useDetail(partie.jeu.id_jeu);
  const [echecs, setEchecs] = useState<ReadonlySet<string>>(new Set());
  const echouer = (adresse: string) => setEchecs((avant) => new Set(avant).add(adresse));
  const { titre, jaquette, couleur_dominante: couleur } = partie.jeu;
  const valable = (adresse: string | null | undefined) => (adresse === null || adresse === undefined || echecs.has(adresse) ? null : adresse);
  const hero = valable(detail?.hero);
  const logo = valable(detail?.logo);
  const affiche = valable(jaquette);
  const fond = hero ?? affiche;
  const teinte = couleurDeJeu(couleur);
  const { etat, lien, action, fiche } = useLienDePartie(
    partie,
    jeu,
    true,
    logo !== null ? <img className={styles.logo} src={logo} alt={titre} draggable={false} onError={() => echouer(logo)} /> : titre,
  );
  const visibles = partie.amis.slice(0, PILE_MAX);
  const reste = partie.amis.length - visibles.length;

  return (
    <article
      {...teinte}
      className={styles.scene}
      data-scene=""
      style={teinte.style}
      onPointerEnter={() => couleur !== null && ambiance.ecrire(couleur)}
      {...suiviDeLaScene}
    >
      <div className={styles.sceneFond} aria-hidden="true">
        {fond !== null ? (
          <img
            className={styles.sceneImage}
            data-portrait={hero === null ? '' : undefined}
            src={fond}
            alt=""
            draggable={false}
            decoding="async"
            onError={() => echouer(fond)}
          />
        ) : (
          <span className={styles.sceneInitiale}>{initialeDe(titre)}</span>
        )}
      </div>
      <span className={styles.sceneVoile} aria-hidden="true" />
      <span className={styles.sceneLumiere} aria-hidden="true" />

      <div className={styles.sceneTexte}>
        <p className={styles.direct}>
          <span className={styles.pouls} aria-hidden="true" />
          {t('amis.salle.direct')}
          <span className={styles.directPoint} aria-hidden="true">
            ·
          </span>
          {tp('amis.salle.ensemble', partie.amis.length)}
        </p>
        <h3 className={styles.sceneTitre} data-logo={logo !== null ? '' : undefined}>
          {lien}
        </h3>
        <p className={styles.etat}>{etat}</p>

        <ul className={styles.pile}>
          {visibles.map((ami, index) => (
            <li key={ami.steamid} style={{ '--i': index } as CSSProperties}>
              <BoutonDAmi ami={ami} classe={styles.pileAmi}>
                <Anneau ami={ami} taille={56} />
                <span className={styles.pileNom}>{ami.pseudo}</span>
              </BoutonDAmi>
            </li>
          ))}
          {reste > 0 && (
            <li className={styles.pileReste} style={{ '--i': visibles.length } as CSSProperties}>
              +{reste}
            </li>
          )}
        </ul>
        {/* Les pseudos se lisent déjà sur les boutons : cette ligne ne sert qu'aux yeux. */}
        <p className={styles.noms} aria-hidden="true">
          {new Intl.ListFormat(langue, { type: 'conjunction' }).format(partie.amis.map((ami) => ami.pseudo))}
        </p>

        <div className={styles.sceneActions}>
          {action}
          {fiche !== null && (
            <Lien className={classeBouton({ variante: 'voile', grand: true })} vers={{ ecran: 'jeu', id_jeu: fiche }}>
              {t('amis.salle.voir_la_fiche')}
              <Icone nom="chevron_droit" taille={20} />
            </Lien>
          )}
        </div>
      </div>

      {affiche !== null && (
        <div className={styles.sceneAffiche} aria-hidden="true">
          <img src={affiche} alt="" width={300} height={450} draggable={false} decoding="async" />
          <span className={styles.sceneReflet} />
        </div>
      )}
    </article>
  );
}

/**
 * Une autre partie en cours : une bannière plus petite, la grande image du jeu derrière, sa jaquette,
 * le titre et les amis qui y jouent. Au survol, le fond de l'application prend la couleur du jeu.
 */
function Banniere({ partie, jeu, rang }: { partie: Partie; jeu: JeuResume | undefined; rang: number }) {
  const { t, tp } = useTexte();
  const { detail } = useDetail(partie.jeu.id_jeu);
  const [echecs, setEchecs] = useState<ReadonlySet<string>>(new Set());
  const echouer = (adresse: string) => setEchecs((avant) => new Set(avant).add(adresse));
  const { titre, jaquette, couleur_dominante: couleur } = partie.jeu;
  const valable = (adresse: string | null | undefined) => (adresse === null || adresse === undefined || echecs.has(adresse) ? null : adresse);
  const hero = valable(detail?.hero);
  const affiche = valable(jaquette);
  const fond = hero ?? affiche;
  const teinte = couleurDeJeu(couleur);
  const { etat, lien } = useLienDePartie(partie, jeu, false, titre);
  const eclairer = () => {
    if (couleur !== null) ambiance.ecrire(couleur);
  };

  return (
    <li
      {...teinte}
      className={styles.banniere}
      data-banniere=""
      style={{ ...teinte.style, '--rang': Math.min(rang, RANG_MAX) } as CSSProperties}
      onPointerEnter={eclairer}
      onFocus={eclairer}
    >
      <span className={styles.banniereFond} aria-hidden="true">
        {fond !== null ? (
          <img className={styles.banniereImage} data-portrait={hero === null ? '' : undefined} src={fond} alt="" loading="lazy" decoding="async" draggable={false} onError={() => echouer(fond)} />
        ) : (
          <span className={styles.sceneInitiale}>{initialeDe(titre)}</span>
        )}
      </span>
      <span className={styles.banniereVoile} aria-hidden="true" />
      <span className={styles.banniereReflet} aria-hidden="true" />

      <p className={styles.direct} data-petit="">
        <span className={styles.pouls} aria-hidden="true" />
        {partie.amis.length > 1 ? tp('amis.nombre', partie.amis.length) : t('amis.statut.en_jeu')}
      </p>

      <div className={styles.banniereBas}>
        {affiche !== null && hero !== null && (
          <span className={styles.vignette} aria-hidden="true">
            <img src={affiche} alt="" width={300} height={450} loading="lazy" decoding="async" draggable={false} />
          </span>
        )}
        <div className={styles.banniereTexte}>
          <h3 className={styles.banniereTitre}>{lien}</h3>
          <p className={styles.etat}>{etat}</p>
        </div>
      </div>

      <ul className={styles.joueurs}>
        {partie.amis.map((ami, index) => (
          <li key={ami.steamid} style={{ '--i': index } as CSSProperties}>
            <BoutonDAmi ami={ami} classe={styles.joueur}>
              <Anneau ami={ami} taille={28} />
              <span className={styles.joueurNom}>{ami.pseudo}</span>
            </BoutonDAmi>
          </li>
        ))}
      </ul>
    </li>
  );
}

function TitreDeGroupe({ id, cle, nombre, children }: { id: string; cle: CleDeGroupe; nombre: number; children?: ReactNode }) {
  const { t } = useTexte();
  return (
    <div className={styles.teteDeGroupe}>
      <h2 id={id} className={`titre-section ${styles.titreDeGroupe}`} data-groupe={cle}>
        {t(`amis.groupe.${cle}`)}
        <span className={`${styles.compte} chiffres`}>{nombre}</span>
      </h2>
      {children}
    </div>
  );
}

/** Ce qui se joue en ce moment : la partie la plus peuplée en grand, les autres en bannières. */
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
          <ul className={styles.bannieres} {...suiviDesBannieres}>
            {autres.map((partie, index) => (
              <Banniere key={partie.cle} partie={partie} jeu={jeuDe(partie)} rang={index} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Les amis connectés qui ne jouent pas : une rangée d'avatars à l'anneau néon, avec leur statut. */
function EnLigne({ amis, large }: { amis: Ami[]; large: boolean }) {
  const { t } = useTexte();
  const id = useId();
  return (
    <section className={styles.groupe} aria-labelledby={id}>
      <TitreDeGroupe id={id} cle="en_ligne" nombre={amis.length} />
      {/* Seuls à l'écran (filtre « En ligne »), les connectés prennent la place : de grands avatars. */}
      <ul className={styles.connectes} data-large={large ? '' : undefined}>
        {amis.map((ami, index) => (
          <li key={ami.steamid} style={{ '--rang': Math.min(index, RANG_MAX) } as CSSProperties}>
            <BoutonDAmi ami={ami} classe={styles.connecte}>
              <Anneau ami={ami} taille={large ? 104 : 64} />
              <span className={styles.connecteNom}>{ami.pseudo}</span>
              <span className={styles.connecteStatut} data-statut={ami.statut}>
                {t(`amis.statut.${ami.statut}`)}
              </span>
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
        {amis.map((ami, index) => (
          <li key={ami.steamid} style={{ '--rang': Math.min(index, RANG_MAX) } as CSSProperties}>
            <BoutonDAmi ami={ami} classe={styles.eteint}>
              <Anneau ami={ami} taille={32} />
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

/** Sous le titre : le total, puis combien d'amis dans chaque groupe. Ces pastilles donnent aussi la légende des anneaux. */
function Presence({ total, enJeu, enLigne, horsLigne }: { total: number; enJeu: number; enLigne: number; horsLigne: number }) {
  const { t, tp, langue } = useTexte();
  const nombre = (valeur: number) => formaterNombre(valeur, langue);
  const compteurs: [CleDeGroupe, number][] = [
    ['en_jeu', enJeu],
    ['en_ligne', enLigne],
    ['hors_ligne', horsLigne],
  ];
  return (
    <span className={styles.presence}>
      <span>{tp('amis.nombre', total)}</span>
      {compteurs.map(([cle, valeur]) => (
        <span key={cle} className={styles.compteur} data-groupe={cle}>
          <span className={`${styles.compteurNombre} chiffres`}>
            <NombreAnime valeur={valeur} format={nombre} />
          </span>
          {t(`amis.groupe.${cle}`)}
        </span>
      ))}
    </span>
  );
}

/** Les gélules qui choisissent ce que l'on voit : tout, ou un seul groupe. Une gélule de verre glisse sous le choix. */
function Filtres({ vue, comptes, onChanger }: { vue: Vue; comptes: Record<CleDeGroupe, number>; onChanger: (vue: Vue) => void }) {
  const { t, langue } = useTexte();
  const rangee = useIndicateur<HTMLDivElement>(vue);
  const options: [Vue, number][] = [
    ['tous', comptes.en_jeu + comptes.en_ligne + comptes.hors_ligne],
    ['en_jeu', comptes.en_jeu],
    ['en_ligne', comptes.en_ligne],
    ['hors_ligne', comptes.hors_ligne],
  ];
  return (
    <div ref={rangee} className={styles.gelules} role="group" aria-label={t('amis.filtre.vues')}>
      <span className={styles.geluleActive} aria-hidden="true" />
      {options.map(([cle, nombre]) => (
        <button
          key={cle}
          type="button"
          className={styles.gelule}
          data-groupe={cle}
          data-actif={cle === vue ? '' : undefined}
          aria-pressed={cle === vue}
          disabled={cle !== 'tous' && nombre === 0}
          onClick={() => onChanger(cle)}
        >
          {cle === 'tous' ? t('amis.filtre.tous') : t(`amis.groupe.${cle}`)}
          <span className={`${styles.geluleNombre} chiffres`}>{formaterNombre(nombre, langue)}</span>
        </button>
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
        <Icone nom="recherche" taille={20} />
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
  // Les compteurs du haut parlent de tous les amis ; les trois zones, de ceux que le filtre retient.
  const tous = useMemo(() => repartirLesAmis(donnees ?? [], langue), [donnees, langue]);
  const retenus = useMemo(() => filtrerLesAmis(donnees ?? [], recherche), [donnees, recherche]);
  const zones = useMemo(() => repartirLesAmis(retenus, langue), [retenus, langue]);
  const aucunResultat = donnees !== null && total > 0 && retenus.length === 0;

  // En arrivant, le fond prend la couleur de la partie la plus suivie.
  useAmbiance(tous.parties[0]?.jeu.couleur_dominante ?? null);

  const avecDonnees = amis.vue === 'donnees' && donnees !== null;
  const enJeu = tous.parties.reduce((somme, partie) => somme + partie.amis.length, 0);
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
      sousTitre={avecDonnees ? <Presence total={total} enJeu={enJeu} enLigne={tous.connectes.length} horsLigne={tous.horsLigne.length} /> : undefined}
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
          <Squelette rayon="var(--rayon-xl)" hauteur="400px" style={{ display: 'block' }} />
          <div className={styles.attenteRangee}>
            {[0, 1, 2, 3].map((n) => (
              <Squelette key={n} rayon="var(--rayon-l)" hauteur="220px" style={{ display: 'block' }} />
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
      {amis.vue === 'donnees' && montrer('en_ligne') && zones.connectes.length > 0 && <EnLigne amis={zones.connectes} large={vue === 'en_ligne'} />}
      {amis.vue === 'donnees' && montrer('hors_ligne') && zones.horsLigne.length > 0 && <HorsLigne amis={zones.horsLigne} />}
    </Page>
  );
}
