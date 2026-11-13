/**
 * Les pièces visuelles communes à la V2 : l'image paysage d'un jeu (jamais une jaquette étirée),
 * les badges de sources, les pilules de tags, la pile d'avatars d'amis et le bouton « 11 h │ Jouer ».
 */
import { memo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Ami, JeuDetail, JeuResume, Source } from '../../contrat/types';
import { disponible } from '../artefact/images';
import { coeur } from '../coeur';
import { lancerLeJeu, tenter, useApplication } from '../etat/application';
import { useDetail } from '../etat/detail';
import { formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Avatar } from '../profil/Avatar';
import { Attente } from './Bouton';
import { useEtatDeLancement } from './BoutonJouer';
import { Icone } from './Icone';
import styles from './Visuels.module.css';

type Format = 'hero' | 'en_tete';

/** La meilleure image paysage disponible d'un jeu, selon le format voulu. null = aucune. */
export function imagePaysage(detail: JeuDetail | null, prefere: Format = 'en_tete'): string | null {
  if (detail === null) return null;
  const ordre = prefere === 'hero' ? [detail.hero, detail.en_tete] : [detail.en_tete, detail.hero];
  return ordre.find((u) => disponible(u)) ?? null;
}

/** Vrai si le jeu a une vraie image (jaquette ou image paysage). */
export function aUneImage(jeu: Pick<JeuResume, 'jaquette'>): boolean {
  return disponible(jeu.jaquette);
}

interface ProprietesImage {
  jeu: Pick<JeuResume, 'id' | 'titre' | 'jaquette' | 'couleur_dominante'>;
  /** Détail déjà lu par l'appelant : évite une seconde lecture. */
  detail?: JeuDetail | null;
  prefere?: Format;
  className?: string | undefined;
  prioritaire?: boolean;
}

/**
 * Image paysage d'un jeu. Sans image paysage, la jaquette (portrait 2:3) n'est JAMAIS étirée : elle est
 * floutée en fond et posée nette au milieu, comme une affiche. Sans rien, un aplat de la couleur du jeu.
 */
export function ImageDeJeu({ jeu, detail, prefere = 'en_tete', className = '', prioritaire = false }: ProprietesImage) {
  const [echec, setEchec] = useState(false);
  const paysage = echec ? null : imagePaysage(detail ?? null, prefere);
  const style = { '--couleur-carte': jeu.couleur_dominante ?? '#2a3550' } as CSSProperties;
  if (paysage !== null) {
    return (
      <span className={`${styles.image} ${className}`} style={style}>
        <img src={paysage} alt="" loading={prioritaire ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => setEchec(true)} />
      </span>
    );
  }
  return (
    <span className={`${styles.image} ${styles.affiche} ${className}`} style={style}>
      {disponible(jeu.jaquette) ? (
        <>
          <img className={styles.afficheFond} src={jeu.jaquette} alt="" loading="lazy" decoding="async" draggable={false} />
          <img className={styles.afficheNette} src={jeu.jaquette} alt="" loading="lazy" decoding="async" draggable={false} />
        </>
      ) : (
        <span className={styles.afficheTitre} aria-hidden="true">
          {jeu.titre}
        </span>
      )}
    </span>
  );
}

/** Variante qui lit elle-même le détail du jeu (pour une carte isolée). */
export const ImageDeJeuAuto = memo(function ImageDeJeuAuto(props: Omit<ProprietesImage, 'detail'>) {
  const { detail } = useDetail(props.jeu.id);
  return <ImageDeJeu {...props} detail={detail} />;
});

const LETTRES: Record<Source, string> = { steam: 'S', epic: 'E', gog: 'G', manuel: '+' };

/** Petits carrés noirs, un par source du jeu (Dribbble 08, en haut à gauche de l'image). */
export function BadgesSources({ sources }: { sources: Source[] }) {
  const { t } = useTexte();
  return (
    <span className={styles.badges}>
      {sources.map((s) => (
        <span key={s} className={styles.badge} data-source={s} title={t(`sources.${s}`)}>
          {s === 'manuel' ? <Icone nom="dossier" taille={14} /> : <span aria-hidden="true">{LETTRES[s]}</span>}
          <span className="hors-ecran">{t(`sources.${s}`)}</span>
        </span>
      ))}
    </span>
  );
}

/** Une pilule de tag avec son icône d'étiquette. */
export function PiluleTag({ children, petite = false }: { children: ReactNode; petite?: boolean }) {
  return (
    <span className={`${styles.tag} ${petite ? styles.tagPetit : ''}`}>
      {!petite && <Icone nom="etiquette" taille={14} />}
      {children}
    </span>
  );
}

/** Les noms des premiers tags d'un jeu. */
export function useNomsDeTags(ids: readonly number[], nombre: number): string[] {
  const tags = useApplication((a) => a.tags);
  return ids
    .map((id) => tags.get(id))
    .filter((n): n is string => n !== undefined)
    .slice(0, nombre);
}

/** Avatars qui se chevauchent, avec une pastille « +N » pour le reste. */
export function PileDAvatars({ amis, max = 4, taille = 34, reste }: { amis: Ami[]; max?: number; taille?: number; reste?: number }) {
  const montres = amis.slice(0, max);
  const plus = reste ?? amis.length - montres.length;
  return (
    <span className={styles.pile} style={{ '--taille': `${taille}px` } as CSSProperties}>
      {montres.map((ami) => (
        <span key={ami.steamid} className={styles.pileAvatar} title={ami.pseudo}>
          <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={taille} />
        </span>
      ))}
      {plus > 0 && <span className={`${styles.pilePlus} chiffres`}>+{plus}</span>}
    </span>
  );
}

/**
 * Le bouton bleu en deux parties : le temps de jeu, un trait, puis l'action (Jouer, Installer, En jeu).
 * Il remplace « $69.99 │ Purchase » de la référence.
 */
export function BoutonTempsJouer({ jeu, large = false, sansTemps = false }: { jeu: JeuResume; large?: boolean; sansTemps?: boolean }) {
  const { t, langue } = useTexte();
  const etat = useEtatDeLancement(jeu.id);
  const temps = jeu.temps.minutes_total > 0 ? formaterTempsDeJeu(jeu.temps.minutes_total, langue) : t('jeu.jamais_lance');
  const classe = `${styles.jouer} ${large ? styles.jouerLarge : ''}`;
  const tempsVisible = !sansTemps && (
    <>
      <span className={`${styles.jouerTemps} chiffres`}>{temps}</span>
      <span className={styles.jouerTrait} aria-hidden="true" />
    </>
  );
  if (!jeu.installe) {
    const appid = jeu.steam_appid;
    return (
      <button type="button" className={classe} data-aimant="" data-onde="" disabled={appid === null} onClick={() => appid !== null && void tenter(() => coeur.action_steam({ action: 'installer', steam_appid: appid }))}>
        {tempsVisible}
        <span className={styles.jouerAction}>
          <Icone nom="telechargement" taille={18} />
          {appid === null ? t('jeu.non_installe') : t('jeu.installer')}
        </span>
      </button>
    );
  }
  return (
    <button type="button" className={classe} data-aimant="" data-onde="" disabled={etat !== 'pret'} data-etat={etat} onClick={() => void lancerLeJeu(jeu.id)}>
      {tempsVisible}
      <span className={styles.jouerAction}>
        {etat === 'lancement' ? <Attente taille={18} /> : <Icone nom={etat === 'en_jeu' ? 'manette' : 'jouer'} taille={18} />}
        {etat === 'en_jeu' ? t('jeu.en_jeu') : etat === 'lancement' ? t('jeu.lancement') : t('jeu.jouer')}
      </span>
    </button>
  );
}

/** Un titre qui se lève mot à mot derrière un masque. Le texte reste entier pour les lecteurs d'écran. */
export function MotsQuiSeLevent({ texte }: { texte: string }) {
  return (
    <span className="v2-mots" aria-label={texte}>
      {texte.split(/\s+/).map((mot, i) => (
        <span key={`${i}-${mot}`} className="v2-mot" aria-hidden="true">
          <span style={{ '--i': i } as CSSProperties}>{mot}</span>{' '}
        </span>
      ))}
    </span>
  );
}

/** Titre de section avec un lien « Tout voir › » à droite (Dribbble 08). */
export function TitreDeSection({ id, titre, action }: { id?: string; titre: string; action?: ReactNode }) {
  return (
    <div className={styles.titreSection}>
      <h2 id={id}>{titre}</h2>
      {action}
    </div>
  );
}

export const classes = styles;

/** L'en-tête d'un écran : très grand titre fin, une ligne d'explication, des actions à droite. */
export function EnTeteDEcran({ titre, texte, actions, surTitre }: { titre: string; texte?: ReactNode; actions?: ReactNode; surTitre?: string }) {
  return (
    <header className={styles.entete}>
      <div className={styles.enteteTexte}>
        {surTitre !== undefined && <p className="etiquette">{surTitre}</p>}
        <h1 className={styles.enteteTitre}>{titre}</h1>
        {texte !== undefined && <p className={styles.enteteSous}>{texte}</p>}
      </div>
      {actions !== undefined && <div className={styles.enteteActions}>{actions}</div>}
    </header>
  );
}

/** Un groupe de pilules dont une seule est choisie. */
export function Choix<V extends string>({ nom, valeur, options, onChanger }: { nom: string; valeur: V; options: { valeur: V; libelle: string }[]; onChanger: (v: V) => void }) {
  return (
    <div className={styles.choix} role="group" aria-label={nom}>
      {options.map((o) => (
        <button key={o.valeur} type="button" aria-pressed={o.valeur === valeur} onClick={() => onChanger(o.valeur)}>
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
