import { disponible } from '../artefact/images';
import { useMemo, type CSSProperties } from 'react';
import type { JeuResume, TriBibliotheque } from '../../contrat/types';
import { Bouton, classeBouton } from '../composants/Bouton';
import { classeActionDeNote, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Menu } from '../composants/Menu';
import { coeur } from '../coeur';
import { modifierLAffichage, tenter, useApplication } from '../etat/application';
import { useMagasin } from '../etat/magasin';
import { filtreChoisi } from './filtre';
import { formaterNombre } from '../formats';
import type { CleDeTexte } from '../i18n';
import { useTexte } from '../i18n/react';
import { Lien, naviguer } from '../navigation';
import { BIBLIOTHEQUE } from '../navigation/routes';
import { Grille } from './Grille';
import { Liste } from './Liste';
import { aReprendre, compter, FILTRES, filtrer, trier, type Filtre } from './logique';
import { jeuEnScene, Scene } from './Scene';
import styles from './Bibliotheque.module.css';


/** Le nombre de jeux montrés sur l'accueil, avant « Tout voir ». */
const APERCU = 10;

const TRIS: TriBibliotheque[] = ['dernier_lancement', 'temps_de_jeu', 'titre', 'ajoute_le', 'date_sortie'];

/** Sens naturel de chaque tri : A avant Z, mais le plus récent et le plus joué d'abord. */
const ORDRE_NATUREL: Record<TriBibliotheque, 'croissant' | 'decroissant'> = {
  titre: 'croissant',
  dernier_lancement: 'decroissant',
  temps_de_jeu: 'decroissant',
  ajoute_le: 'decroissant',
  date_sortie: 'decroissant',
};

const NOMS_DE_FILTRE: Record<Filtre, CleDeTexte> = {
  tous: 'filtre.tous',
  installes: 'filtre.installes',
  favoris: 'filtre.favoris',
  jamais_lances: 'filtre.jamais_lances',
};

/** Aucun jeu du tout : on dit pourquoi et on propose quoi faire, plutôt qu'une grille vide. */
function BibliothequeVide({ steamInstalle, scanEnCours }: { steamInstalle: boolean; scanEnCours: boolean }) {
  const { t } = useTexte();
  return (
    <>
      <div className={styles.vide}>
        <Message
          centre
          icone="grille"
          titre={t('bibliotheque.vide.titre')}
          texte={steamInstalle ? t('bibliotheque.vide.texte') : t('bibliotheque.vide.texte_sans_steam')}
          actions={
            <>
              <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'ajout' }}>
                <Icone nom="plus" taille={18} />
                {t('bibliotheque.ajouter_un_jeu')}
              </Lien>
              <Lien className={classeBouton()} vers={{ ecran: 'parametres', section: 'bibliotheque' }}>
                {t('bibliotheque.vide.dossiers')}
              </Lien>
              <Bouton disabled={scanEnCours} onClick={() => void tenter(() => coeur.relancer_le_scan())}>
                <Icone nom="rafraichir" taille={18} />
                {t('bibliotheque.vide.analyser')}
              </Bouton>
            </>
          }
        />
      </div>
    </>
  );
}

export function Bibliotheque({ recherche, tout = false }: { recherche: string; tout?: boolean }) {
  const { t, tp, te, langue } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const etat = useApplication((a) => a.etat);
  const affichage = useApplication((a) => a.parametres?.affichage ?? null);
  const occupe = useApplication((a) => a.lancement !== null || (a.etat?.session_en_cours ?? null) !== null);
  const filtre = useMagasin(filtreChoisi, (f) => f);
  const choisi = useMagasin(jeuEnScene, (j) => j);

  const montrerMasques = affichage?.montrer_les_jeux_masques ?? false;
  const tri = affichage?.tri ?? 'dernier_lancement';
  const ordre = affichage?.ordre ?? 'decroissant';
  const vue = affichage?.vue ?? 'grille';

  // La vitrine est une affiche : seuls les jeux qui ont une image y passent (un ajout manuel sans visuel reste dans la grille).
  const recents = useMemo(() => (jeux === null ? [] : aReprendre(jeux.filter((j) => disponible(j.jaquette)), 12)), [jeux]);
  // Avec une recherche, les compteurs des filtres comptent les jeux trouvés, pas toute la bibliothèque.
  const trouves = useMemo(
    () => (jeux === null ? [] : filtrer(jeux, { filtre: 'tous', recherche, montrer_les_jeux_masques: montrerMasques })),
    [jeux, recherche, montrerMasques],
  );
  const compte = useMemo(() => compter(trouves, montrerMasques), [trouves, montrerMasques]);
  const visibles = useMemo(
    () => trier(filtrer(trouves, { filtre, recherche: '', montrer_les_jeux_masques: montrerMasques }), tri, ordre),
    [trouves, filtre, montrerMasques, tri, ordre],
  );

  if (jeux === null || etat === null) {
    return (
      <>
        <div className={styles.squelettes} role="status" aria-label={t('commun.chargement')}>
          {Array.from({ length: 18 }, (_, index) => (
            <Squelette key={index} style={{ aspectRatio: '2 / 3' }} />
          ))}
        </div>
      </>
    );
  }

  if (jeux.length === 0) return <BibliothequeVide steamInstalle={etat.steam_installe} scanEnCours={etat.scan.en_cours} />;

  const enScene = recents.find((jeu) => jeu.id === choisi) ?? recents[0] ?? null;
  // L'accueil : la vitrine, puis un aperçu de la collection. La page Bibliothèque : toute la collection, ses filtres et ses tris.
  const accueil = recherche === '' && !tout;
  const avecScene = accueil && enScene !== null;
  const titre = recherche === '' ? t('bibliotheque.tous_les_jeux') : t('bibliotheque.resultats_pour', { texte: recherche });
  const partielle = etat.jeux_possedes_erreur;

  const toutAfficher = () => {
    filtreChoisi.ecrire('tous');
    if (recherche !== '') naviguer({ ecran: 'bibliotheque', recherche: '' });
  };

  if (accueil) {
    const apercu = trier(filtrer(jeux, { filtre: 'tous', recherche: '', montrer_les_jeux_masques: false }), tri, ordre).slice(0, APERCU);
    return (
      <div style={{ '--taille-jaquette': `${affichage?.taille_jaquettes ?? 180}px` } as CSSProperties}>
        {avecScene && <Scene jeu={enScene} recents={recents} />}
        <div className={styles.apercuTete}>
          <h2 className="titre-section">{t('carmin.apercu.titre')}</h2>
          <Lien className={styles.apercuLien} vers={BIBLIOTHEQUE}>
            {t('carmin.apercu.tout_voir', { n: formaterNombre(compte.tous, langue) })}
            <Icone nom="chevron_droit" taille={16} />
          </Lien>
        </div>
        <Grille jeux={apercu} peutLancer={!occupe} nom={t('carmin.apercu.titre')} />
      </div>
    );
  }

  return (
    <div style={{ '--taille-jaquette': `${affichage?.taille_jaquettes ?? 180}px` } as CSSProperties}>
      <div className={styles.sousLaBarre} />
      {tout && (
        <header className={styles.entete}>
          <h1 className={styles.grandTitre}>{t('carmin.bibliotheque.titre')}</h1>
          <p className={styles.sousTitre}>{t('carmin.bibliotheque.texte', { n: formaterNombre(compte.tous, langue), installes: formaterNombre(compte.installes, langue) })}</p>
        </header>
      )}

      <div id="toute-la-bibliotheque" className={styles.outils}>
        <div className={styles.groupe}>
          <h2 className={tout && recherche === "" ? "hors-ecran" : "titre-section"}>{titre}</h2>
          <div className={styles.puces} role="group" aria-label={t('bibliotheque.filtres')}>
            {FILTRES.map((f) => (
              <Bouton key={f} aria-pressed={f === filtre} onClick={() => filtreChoisi.ecrire(f)}>
                <span>{t(NOMS_DE_FILTRE[f])}</span>
                <span className={`${styles.compteur} chiffres`}>{formaterNombre(compte[f], langue)}</span>
              </Bouton>
            ))}
            {recherche !== '' && (
              <Bouton onClick={() => naviguer({ ecran: 'bibliotheque', recherche: '' })}>
                <Icone nom="fermer" taille={16} />
                {t('bibliotheque.effacer_la_recherche')}
              </Bouton>
            )}
          </div>
        </div>
        <div className={styles.groupe} style={{ gap: 8 }}>
          <Menu
            classeDuBouton={classeBouton()}
            alignement="droite"
            contenu={
              <>
                <span className={styles.triPrefixe}>{t('tri.prefixe')}</span>
                <span>{t(`tri.${tri}`)}</span>
                <Icone nom="chevron_bas" taille={16} />
              </>
            }
            elements={TRIS.map((valeur) => ({
              cle: valeur,
              libelle: t(`tri.${valeur}`),
              coche: valeur === tri,
              action: () => void modifierLAffichage({ tri: valeur, ordre: ORDRE_NATUREL[valeur] }),
            }))}
          />
          <Bouton
            carre
            aria-label={ordre === 'croissant' ? t('tri.ordre_croissant') : t('tri.ordre_decroissant')}
            onClick={() => void modifierLAffichage({ ordre: ordre === 'croissant' ? 'decroissant' : 'croissant' })}
          >
            <Icone nom={ordre === 'croissant' ? 'tri_croissant' : 'tri_decroissant'} />
          </Bouton>
          <div className={styles.bascule} role="group" aria-label={t('bibliotheque.affichage')}>
            <button type="button" aria-label={t('bibliotheque.en_grille')} aria-pressed={vue === 'grille'} onClick={() => void modifierLAffichage({ vue: 'grille' })}>
              <Icone nom="grille" taille={18} />
            </button>
            <button type="button" aria-label={t('bibliotheque.en_liste')} aria-pressed={vue === 'liste'} onClick={() => void modifierLAffichage({ vue: 'liste' })}>
              <Icone nom="liste" taille={18} />
            </button>
          </div>
        </div>
      </div>

      {partielle !== null && (
        <div className={styles.note}>
          <Note
            icone={iconeDErreur(partielle)}
            action={
              <Lien className={classeActionDeNote} vers={{ ecran: 'parametres', section: 'steam' }}>
                {t('bibliotheque.partielle.action')}
              </Lien>
            }
          >
            {t('bibliotheque.partielle', { raison: te(partielle) })}
          </Note>
        </div>
      )}

      {/* Annoncé aux lecteurs d'écran à chaque changement de filtre ou de recherche. */}
      <p className="hors-ecran" role="status">
        {tp('bibliotheque.affiches', visibles.length)}
      </p>

      {visibles.length === 0 ? (
        <div className={styles.vide}>
          <Message
            icone="recherche"
            titre={t('bibliotheque.aucun_resultat.titre')}
            texte={recherche === '' ? t('bibliotheque.aucun_resultat.filtre') : t('bibliotheque.aucun_resultat.recherche', { texte: recherche })}
            actions={<Bouton onClick={toutAfficher}>{t('bibliotheque.tout_afficher')}</Bouton>}
          />
        </div>
      ) : vue === 'grille' ? (
        <Grille jeux={visibles} peutLancer={!occupe} nom={titre} />
      ) : (
        <Liste jeux={visibles} peutLancer={!occupe} nom={titre} />
      )}
    </div>
  );
}
