import { memo, useRef, type CSSProperties, type PointerEvent } from 'react';
import type { JeuResume } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { useFenetre } from '../composants/fenetre';
import { lancerLeJeu, useApplication } from '../etat/application';
import { formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { animationsActives, Lien } from '../navigation';
import { inclinaison } from './inclinaison';
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
  /** Colonne de la carte dans la grille : les cartes d'une rangée entrent de gauche à droite. */
  colonne: number;
}

/**
 * `memo` : quand un seul jeu change (favori, fin de session), seule sa carte est redessinée.
 * Cela tient parce que le magasin garde le même objet pour les jeux inchangés.
 */
const Carte = memo(function Carte({ jeu, rang, total, peutLancer, colonne }: ProprietesDeCarte) {
  const { t, langue } = useTexte();
  return (
    <li className={styles.carte} style={{ '--colonne': colonne } as CSSProperties} aria-posinset={rang} aria-setsize={total}>
      <Lien className={styles.carteLien} vers={{ ecran: 'jeu', id_jeu: jeu.id }} aria-label={jeu.installe ? jeu.titre : t('jeu.titre_non_installe', { titre: jeu.titre })}>
        <span className={styles.carteCadre}>
          <Jaquette jeu={jeu} prioritaire estomperSiAbsent className={styles.carteJaquette ?? ''} />
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
          <Icone nom="jouer" taille={20} />
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

  // La carte sous le pointeur penche vers lui et un reflet le suit. Un seul écouteur pour toute la grille.
  const penchee = useRef<HTMLElement | null>(null);
  const redresser = () => {
    for (const variable of ['--rx', '--ry', '--gx', '--gy']) penchee.current?.style.removeProperty(variable);
    penchee.current = null;
  };
  const pencher = (evenement: PointerEvent<HTMLUListElement>) => {
    if (evenement.pointerType !== 'mouse' || !animationsActives()) return;
    const carte = (evenement.target as HTMLElement).closest('li');
    if (carte !== penchee.current) redresser();
    if (carte === null) return;
    penchee.current = carte;
    const cadre = carte.getBoundingClientRect();
    const angle = inclinaison((evenement.clientX - cadre.left) / cadre.width, (evenement.clientY - cadre.top) / cadre.height);
    carte.style.setProperty('--rx', `${angle.rx}deg`);
    carte.style.setProperty('--ry', `${angle.ry}deg`);
    carte.style.setProperty('--gx', `${angle.gx}%`);
    carte.style.setProperty('--gy', `${angle.gy}%`);
  };

  return (
    <div ref={conteneur} className={styles.fenetre} style={{ height: fenetre.hauteurTotale }}>
      <ul
        className={styles.grille}
        aria-label={nom}
        onPointerMove={pencher}
        onPointerLeave={redresser}
        style={{ gridTemplateColumns: `repeat(${fenetre.colonnes}, minmax(0, 1fr))`, gap: ESPACE, transform: `translateY(${fenetre.decalage}px)` }}
      >
        {jeux.slice(fenetre.debut, fenetre.fin).map((jeu, index) => (
          <Carte key={jeu.id} jeu={jeu} rang={fenetre.debut + index + 1} total={jeux.length} peutLancer={peutLancer} colonne={(fenetre.debut + index) % fenetre.colonnes} />
        ))}
      </ul>
    </div>
  );
}
