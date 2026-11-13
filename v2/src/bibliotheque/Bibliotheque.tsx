/**
 * La bibliothèque de la V2 (Steam Library Redesign, For Honor) : une vue maître/détail.
 * À gauche, la liste compacte des jeux, groupée (Favoris, Installés, Tous) et fenêtrée (2 000 jeux).
 * À droite, le jeu choisi sur son art plein panneau. Un bouton bascule en grille de jaquettes.
 */
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { JeuResume, TriBibliotheque } from '../../contrat/types';
import { disponible } from '../artefact/images';
import { Bouton, classeBouton } from '../composants/Bouton';
import { Message, Squelette } from '../composants/Etats';
import { useFenetre } from '../composants/fenetre';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { Menu } from '../composants/Menu';
import { coeur } from '../coeur';
import { modifierLAffichage, tenter, useApplication } from '../etat/application';
import { creerMagasin, useMagasin } from '../etat/magasin';
import { formaterNombre, formaterTempsDeJeu } from '../formats';
import type { CleDeTexte } from '../i18n';
import { useTexte } from '../i18n/react';
import { Lien, naviguer } from '../navigation';
import { DetailDuJeu } from './DetailDuJeu';
import { filtreChoisi } from './filtre';
import { compter, FILTRES, filtrer, trier, type Filtre } from './logique';
import styles from './Bibliotheque.module.css';

const TRIS: TriBibliotheque[] = ['dernier_lancement', 'temps_de_jeu', 'titre', 'ajoute_le', 'date_sortie'];
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

/** Le jeu choisi dans la liste : retrouvé tel quel au retour d'une fiche. */
export const jeuChoisi = creerMagasin<number | null>(null);

/**
 * La vue de la bibliothèque. Elle s'ouvre toujours en maître/détail ; le bouton bascule en grille
 * (et l'enregistre dans l'affichage) jusqu'à ce qu'on revienne à la liste.
 */
const vueChoisie = creerMagasin<'liste' | 'grille'>('liste');

function choisirLaVue(vue: 'liste' | 'grille'): void {
  vueChoisie.ecrire(vue);
  void modifierLAffichage({ vue });
}

const HAUTEUR_LIGNE = 44;

type Entree = { type: 'groupe'; cle: string; nom: string; nombre: number } | { type: 'jeu'; cle: string; jeu: JeuResume };

const Ligne = memo(function Ligne({ jeu, choisi, onChoisir }: { jeu: JeuResume; choisi: boolean; onChoisir: (id: number) => void }) {
  const style = { '--couleur-jaquette': jeu.couleur_dominante ?? undefined } as CSSProperties;
  return (
    <button
      type="button"
      className={styles.ligne}
      aria-current={choisi ? 'true' : undefined}
      data-absent={jeu.installe ? undefined : ''}
      onClick={() => onChoisir(jeu.id)}
      onDoubleClick={() => naviguer({ ecran: 'jeu', id_jeu: jeu.id })}
    >
      <span className={styles.ligneIcone} style={style} aria-hidden="true">
        {disponible(jeu.icone) ? <img src={jeu.icone} alt="" width={24} height={24} loading="lazy" decoding="async" /> : jeu.titre.charAt(0)}
      </span>
      <span className={styles.ligneTitre}>{jeu.titre}</span>
      {jeu.favori && (
        <span className={styles.ligneFavori} aria-hidden="true">
          <Icone nom="etoile_pleine" taille={12} />
        </span>
      )}
    </button>
  );
});

function ListeDesJeux({ entrees, choisi, onChoisir, nom }: { entrees: Entree[]; choisi: number | null; onChoisir: (id: number) => void; nom: string }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const fenetre = useFenetre(conteneur, { nombre: entrees.length, largeurMin: null, espace: 0, hauteur: () => HAUTEUR_LIGNE });
  return (
    <div ref={conteneur} className={styles.fenetreListe} style={{ height: fenetre.hauteurTotale }}>
      <ul aria-label={nom} style={{ transform: `translateY(${fenetre.decalage}px)` }}>
        {fenetre.colonnes > 0 &&
          entrees.slice(fenetre.debut, fenetre.fin).map((e) =>
            e.type === 'groupe' ? (
              <li key={e.cle} className={styles.groupeTitre}>
                <span className="etiquette">{e.nom}</span>
                <span className={`${styles.groupeNombre} chiffres`}>{e.nombre}</span>
              </li>
            ) : (
              <li key={e.cle}>
                <Ligne jeu={e.jeu} choisi={e.jeu.id === choisi} onChoisir={onChoisir} />
              </li>
            ),
          )}
      </ul>
    </div>
  );
}

/** La grille de jaquettes, fenêtrée elle aussi. */
function GrilleDeJaquettes({ jeux, taille, nom }: { jeux: JeuResume[]; taille: number; nom: string }) {
  const { langue } = useTexte();
  const conteneur = useRef<HTMLDivElement>(null);
  const espace = 22;
  const fenetre = useFenetre(conteneur, { nombre: jeux.length, largeurMin: taille, espace, hauteur: (l) => l * 1.5 + 46 });
  return (
    <div ref={conteneur} style={{ height: fenetre.hauteurTotale }}>
      <ul
        aria-label={nom}
        className={styles.grille}
        style={{ transform: `translateY(${fenetre.decalage}px)`, gridTemplateColumns: `repeat(${Math.max(fenetre.colonnes, 1)}, minmax(0, 1fr))`, gap: espace } as CSSProperties}
      >
        {fenetre.colonnes > 0 &&
          jeux.slice(fenetre.debut, fenetre.fin).map((jeu) => (
            <li key={jeu.id} className={styles.carte}>
              <Lien vers={{ ecran: 'jeu', id_jeu: jeu.id }} className={styles.carteLien} data-envol="" data-incliner="">
                <Jaquette jeu={jeu} estomperSiAbsent className={styles.carteJaquette} />
                <span className={styles.carteTitre}>{jeu.titre}</span>
                <span className={`${styles.carteTemps} chiffres`}>{jeu.temps.minutes_total > 0 ? formaterTempsDeJeu(jeu.temps.minutes_total, langue) : '—'}</span>
              </Lien>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function Bibliotheque({ recherche }: { recherche: string; tout?: boolean }) {
  const { t, tp, langue } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const etat = useApplication((a) => a.etat);
  const affichage = useApplication((a) => a.parametres?.affichage ?? null);
  const filtre = useMagasin(filtreChoisi, (f) => f);
  const choisi = useMagasin(jeuChoisi, (c) => c);
  const [texte, setTexte] = useState(recherche);
  useEffect(() => setTexte(recherche), [recherche]);

  const montrerMasques = affichage?.montrer_les_jeux_masques ?? false;
  const tri = affichage?.tri ?? 'dernier_lancement';
  const ordre = affichage?.ordre ?? 'decroissant';
  const vue = useMagasin(vueChoisie, (v) => v);

  const trouves = useMemo(() => (jeux === null ? [] : filtrer(jeux, { filtre: 'tous', recherche: texte, montrer_les_jeux_masques: montrerMasques })), [jeux, texte, montrerMasques]);
  const compte = useMemo(() => compter(trouves, montrerMasques), [trouves, montrerMasques]);
  const visibles = useMemo(() => trier(filtrer(trouves, { filtre, recherche: '', montrer_les_jeux_masques: montrerMasques }), tri, ordre), [trouves, filtre, montrerMasques, tri, ordre]);

  // Les groupes de la liste : Favoris et Installés en tête quand le filtre est « Tous », puis tout.
  const entrees = useMemo<Entree[]>(() => {
    const groupe = (cle: string, nom: string, liste: JeuResume[]): Entree[] =>
      liste.length === 0 ? [] : [{ type: 'groupe', cle: `g-${cle}`, nom, nombre: liste.length }, ...liste.map((jeu): Entree => ({ type: 'jeu', cle: `${cle}-${jeu.id}`, jeu }))];
    if (filtre !== 'tous' || texte !== '') return groupe('f', t(NOMS_DE_FILTRE[filtre]), visibles);
    return [
      ...groupe('fav', t('filtre.favoris'), visibles.filter((j) => j.favori)),
      ...groupe('ins', t('filtre.installes'), visibles.filter((j) => j.installe && !j.favori)),
      ...groupe('tous', t('bibliotheque.tous_les_jeux'), visibles),
    ];
  }, [visibles, filtre, texte, t]);

  // Le jeu choisi par défaut : le dernier joué parmi ceux affichés.
  const choisiVisible = visibles.some((j) => j.id === choisi);
  useEffect(() => {
    if (choisiVisible || visibles.length === 0) return;
    const premier = [...visibles].filter((j) => j.temps.dernier_lancement !== null).sort((a, b) => (b.temps.dernier_lancement ?? '').localeCompare(a.temps.dernier_lancement ?? ''))[0] ?? visibles[0];
    if (premier !== undefined) jeuChoisi.ecrire(premier.id);
  }, [choisiVisible, visibles]);

  if (jeux === null || etat === null) {
    return (
      <div className={styles.biblio} role="status" aria-label={t('commun.chargement')}>
        <Squelette hauteur="100%" rayon="24px" />
        <Squelette hauteur="100%" rayon="24px" />
      </div>
    );
  }

  if (jeux.length === 0) {
    return (
      <div className={styles.vide}>
        <Message
          centre
          icone="grille"
          titre={t('bibliotheque.vide.titre')}
          texte={etat.steam_installe ? t('bibliotheque.vide.texte') : t('bibliotheque.vide.texte_sans_steam')}
          actions={
            <>
              <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'ajout' }}>
                <Icone nom="plus" taille={18} />
                {t('bibliotheque.ajouter_un_jeu')}
              </Lien>
              <Bouton disabled={etat.scan.en_cours} onClick={() => void tenter(() => coeur.relancer_le_scan())}>
                <Icone nom="rafraichir" taille={18} />
                {t('bibliotheque.vide.analyser')}
              </Bouton>
            </>
          }
        />
      </div>
    );
  }

  const nom = texte === '' ? t('bibliotheque.tous_les_jeux') : t('bibliotheque.resultats_pour', { texte });
  const outils = (
    <div className={styles.outils}>
      <div className={styles.filtres} role="group" aria-label={t('bibliotheque.filtres')}>
        {FILTRES.map((f) => (
          <button key={f} type="button" className={styles.filtre} aria-pressed={f === filtre} onClick={() => filtreChoisi.ecrire(f)}>
            {t(NOMS_DE_FILTRE[f])}
            <span className="chiffres">{formaterNombre(compte[f], langue)}</span>
          </button>
        ))}
      </div>
      <div className={styles.outilsDroite}>
        <Menu
          classeDuBouton={styles.outilBouton ?? ''}
          alignement="droite"
          nom={t('tri.prefixe')}
          contenu={
            <>
              <Icone nom={ordre === 'croissant' ? 'tri_croissant' : 'tri_decroissant'} taille={17} />
              <span className={styles.outilTexte}>{t(`tri.${tri}`)}</span>
            </>
          }
          elements={TRIS.map((valeur) => ({ cle: valeur, libelle: t(`tri.${valeur}`), coche: valeur === tri, action: () => void modifierLAffichage({ tri: valeur, ordre: ORDRE_NATUREL[valeur] }) }))}
        />
        <div className={styles.bascule} role="group" aria-label={t('bibliotheque.affichage')}>
          <button type="button" aria-label={t('bibliotheque.en_liste')} aria-pressed={vue === 'liste'} onClick={() => choisirLaVue('liste')}>
            <Icone nom="liste" taille={17} />
          </button>
          <button type="button" aria-label={t('bibliotheque.en_grille')} aria-pressed={vue === 'grille'} onClick={() => choisirLaVue('grille')}>
            <Icone nom="grille" taille={17} />
          </button>
        </div>
      </div>
    </div>
  );

  const champ = (
    <label className={styles.champ}>
      <Icone nom="recherche" taille={17} />
      <input type="search" value={texte} placeholder={t('v2.filtrer_la_liste')} aria-label={t('v2.filtrer_la_liste')} onChange={(e) => setTexte(e.target.value)} />
    </label>
  );

  const aucun = (
    <div className={styles.aucun}>
      <Message
        icone="recherche"
        titre={t('bibliotheque.aucun_resultat.titre')}
        texte={texte === '' ? t('bibliotheque.aucun_resultat.filtre') : t('bibliotheque.aucun_resultat.recherche', { texte })}
        actions={
          <Bouton
            onClick={() => {
              filtreChoisi.ecrire('tous');
              setTexte('');
            }}
          >
            {t('bibliotheque.tout_afficher')}
          </Bouton>
        }
      />
    </div>
  );

  if (vue === 'grille') {
    return (
      <div className={styles.pageGrille}>
        <header className={styles.enteteGrille}>
          <div>
            <h1 className={styles.grandTitre}>{t('coque.bibliotheque')}</h1>
            <p className={styles.sousTitre}>{t('carmin.bibliotheque.texte', { n: formaterNombre(compte.tous, langue), installes: formaterNombre(compte.installes, langue) })}</p>
          </div>
          {champ}
        </header>
        {outils}
        <p className="hors-ecran" role="status">
          {tp('bibliotheque.affiches', visibles.length)}
        </p>
        {visibles.length === 0 ? aucun : <GrilleDeJaquettes jeux={visibles} taille={affichage?.taille_jaquettes ?? 170} nom={nom} />}
      </div>
    );
  }

  return (
    <div className={styles.biblio}>
      <aside className={`${styles.maitre} verre-poli`}>
        <div className={styles.maitreHaut}>
          {champ}
          {outils}
        </div>
        <p className="hors-ecran" role="status">
          {tp('bibliotheque.affiches', visibles.length)}
        </p>
        <div className={styles.defileListe}>{visibles.length === 0 ? aucun : <ListeDesJeux entrees={entrees} choisi={choisi} onChoisir={(id) => jeuChoisi.ecrire(id)} nom={nom} />}</div>
      </aside>
      <section className={styles.detail} aria-live="polite">
        {choisi !== null && choisiVisible && <DetailDuJeu key={choisi} id_jeu={choisi} />}
      </section>
    </div>
  );
}
