import type { CSSProperties, ReactNode } from 'react';
import type { ErreurApp } from '../../contrat/types';
import { vautUnNouvelEssai } from '../coeur/erreurs';
import { useTexte } from '../i18n/react';
import { Bouton } from './Bouton';
import { Icone, type NomDIcone } from './Icone';
import styles from './Etats.module.css';

interface ProprietesDeMessage {
  icone: NomDIcone;
  titre: string;
  texte?: string;
  /** Boutons ou liens proposés : toujours dire au joueur quoi faire ensuite. */
  actions?: ReactNode;
  centre?: boolean;
}

/** Écran vide ou écran d'erreur : une icône, un titre, une phrase, une action. */
export function Message({ icone, titre, texte, actions, centre = false }: ProprietesDeMessage) {
  return (
    <div className={`${styles.message} ${centre ? styles.centre : ''}`}>
      <span className={styles.pastille}>
        <Icone nom={icone} taille={26} />
      </span>
      <h2 className={styles.titre}>{titre}</h2>
      {texte !== undefined && <p className={styles.texte}>{texte}</p>}
      {actions !== undefined && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

const ICONES_D_ERREUR: Partial<Record<ErreurApp['code'], NomDIcone>> = {
  hors_ligne: 'hors_ligne',
  mode_jeu: 'manette',
  cle_absente: 'cle',
  cle_refusee: 'cle',
  profil_prive: 'cadenas',
  amis_prives: 'cadenas',
  quota_atteint: 'horloge',
  source_coupee: 'horloge',
  source_desactivee: 'reglages',
};

export function iconeDErreur(erreur: ErreurApp): NomDIcone {
  return ICONES_D_ERREUR[erreur.code] ?? 'alerte';
}

/**
 * Faut-il signaler cette erreur à côté d'un contenu ? Quand des données sont affichées et que la
 * cause est déjà dite par le bandeau du haut (pas de réseau, jeu en cours), une note de plus dans
 * chaque rubrique ne ferait que répéter. Sans données, la note explique pourquoi la rubrique est vide.
 */
export function aSignaler(erreur: ErreurApp | null, aDesDonnees: boolean): erreur is ErreurApp {
  if (erreur === null) return false;
  return !(aDesDonnees && (erreur.code === 'hors_ligne' || erreur.code === 'mode_jeu'));
}

interface ProprietesDErreur {
  erreur: ErreurApp;
  /** Présent = bouton « Réessayer », proposé seulement si réessayer a un sens pour cette erreur. */
  reessayer?: () => void;
  /** Action propre à l'écran (« Ajouter ma clé », « Ouvrir les paramètres »…). */
  actions?: ReactNode;
  centre?: boolean;
}

/** Écran d'erreur quand il n'y a rien d'autre à montrer. */
export function ErreurPleine({ erreur, reessayer, actions, centre = false }: ProprietesDErreur) {
  const { t, te } = useTexte();
  const peutReessayer = reessayer !== undefined && vautUnNouvelEssai(erreur);
  return (
    <div role="alert">
      <Message
        icone={iconeDErreur(erreur)}
        titre={te(erreur)}
        centre={centre}
        actions={
          (peutReessayer || actions !== undefined) && (
            <>
              {actions}
              {peutReessayer && (
                <Bouton onClick={reessayer}>
                  <Icone nom="rafraichir" taille={18} />
                  {t('commun.reessayer')}
                </Bouton>
              )}
            </>
          )
        }
      />
    </div>
  );
}

interface ProprietesDeNote {
  icone?: NomDIcone;
  children: ReactNode;
  action?: ReactNode;
}

/** Ligne discrète au-dessus d'un contenu : « tu vois des données enregistrées », « ajoute ta clé »… */
export function Note({ icone = 'info', children, action }: ProprietesDeNote) {
  return (
    <div className={styles.note} role="status">
      <Icone nom={icone} taille={18} />
      <span className={styles.noteTexte}>{children}</span>
      {action}
    </div>
  );
}

export const classeActionDeNote = styles.noteAction ?? '';

/** Bloc gris à la place d'un contenu qui arrive. Les dimensions viennent de l'appelant. */
export function Squelette({ largeur, hauteur, rayon, style }: { largeur?: string; hauteur?: string; rayon?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={styles.squelette} style={{ width: largeur, height: hauteur, borderRadius: rayon, ...style }} />;
}
