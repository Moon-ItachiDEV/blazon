import { memo, useRef } from 'react';
import type { JeuResume } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { useFenetre } from '../composants/fenetre';
import { lancerLeJeu, useApplication } from '../etat/application';
import { formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import styles from './Bibliotheque.module.css';

/** Gouttière entre deux jaquettes : la grille respire. */
const ESPACE = 28;
/** Hauteur du titre et de la ligne d'état sous chaque jaquette. */
const LEGENDE = 56;

interface ProprietesDeCarte {
  jeu: JeuResume;
  /** Rang dans la liste complète, annoncé par les lecteurs d'écran (« 12 sur 1 980 »). */
  rang: number;
  total: number;
  /** Faux quand un jeu tourne ou se lance déjà. */
  peutLancer: boolean;
}

/**
 * `memo` : quand un seul jeu change (favori, fin de session), seule sa carte est redessinée.
 * Cela tient parce que le magasin garde le même objet pour les jeux inchangés.
 */
const Carte = memo(function Carte({ jeu, rang, total, peutLancer }: ProprietesDeCarte) {
  const { t, langue } = useTexte();
  return (
    <li className={styles.carte} aria-posinset={rang} aria-setsize={total}>
      <Lien className={styles.carteLien} vers={{ ecran: 'jeu', id_jeu: jeu.id }} aria-label={jeu.installe ? jeu.titre : t('jeu.titre_non_installe', { titre: jeu.titre })}>
        <span className={styles.carteCadre}>
          <Jaquette jeu={jeu} prioritaire className={styles.carteJaquette ?? ''} />
          {jeu.favori && (
            <span className={styles.favori} aria-hidden="true">
              <Icone nom="etoile_pleine" taille={14} />
            </span>
          )}
        </span>
        <span className={styles.carteLegende} aria-hidden="true">
          <span className={styles.carteTitre}>{jeu.titre}</span>
          <span className={styles.carteEtat} data-installe={jeu.installe ? '' : undefined}>
            {!jeu.installe
              ? t('jeu.non_installe')
              : jeu.temps.minutes_total > 0
                ? formaterTempsDeJeu(jeu.temps.minutes_total, langue)
                : t('scene.tuile.jamais')}
          </span>
        </span>
      </Lien>
      {jeu.installe && (
        <button type="button" className={styles.carteJouer} disabled={!peutLancer} aria-label={t('jeu.jouer_a', { titre: jeu.titre })} onClick={() => void lancerLeJeu(jeu.id)}>
          <Icone nom="jouer" taille={16} />
        </button>
      )}
    </li>
  );
});

export function Grille({ jeux, peutLancer, nom }: { jeux: JeuResume[]; peutLancer: boolean; nom: string }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const taille = useApplication((a) => a.parametres?.affichage.taille_jaquettes ?? 180);
  // Jaquette au format 2:3 (une fois et demie sa largeur), plus le titre et l'état dessous.
  const fenetre = useFenetre(conteneur, { nombre: jeux.length, largeurMin: taille, espace: ESPACE, hauteur: (largeur) => largeur * 1.5 + LEGENDE });

  return (
    <div ref={conteneur} className={styles.fenetre} style={{ height: fenetre.hauteurTotale }}>
      <ul
        className={styles.grille}
        aria-label={nom}
        style={{ gridTemplateColumns: `repeat(${fenetre.colonnes}, minmax(0, 1fr))`, gap: ESPACE, transform: `translateY(${fenetre.decalage}px)` }}
      >
        {jeux.slice(fenetre.debut, fenetre.fin).map((jeu, index) => (
          <Carte key={jeu.id} jeu={jeu} rang={fenetre.debut + index + 1} total={jeux.length} peutLancer={peutLancer} />
        ))}
      </ul>
    </div>
  );
}
