import { useState, type CSSProperties, type ReactNode } from 'react';
import { useAmbiance } from '../etat/ambiance';
import { animationsActives } from '../navigation';
import { oublierLePointeur, suivreLePointeur } from './pointeur';
import { couleurDeJeu } from './couleur';
import { gabaritDeTitre } from './titre';
import styles from './Affiche.module.css';

interface Proprietes {
  /** Couleur dominante du jeu : fond de l'affiche tant que l'image n'est pas là, ou s'il n'y en a pas. */
  couleur: string | null;
  image: string | null;
  /** Vrai tant qu'on ne sait pas encore si le jeu a une image : l'affiche garde alors la précédente. */
  enAttente?: boolean;
  /** Ce qui occupe le haut de l'affiche (bouton Retour de la fiche). */
  haut?: ReactNode;
  /** Ce qui occupe le bas à droite (les dernières parties, dans la bibliothèque). */
  cote?: ReactNode;
  /** Identifiant du titre, pour nommer la section. */
  idDuTitre: string;
  /** Change quand le jeu change : le panneau d'informations rejoue son apparition. */
  cle: string | number;
  /** Classe ajoutée à la section (taille, marges, place dans une grille). */
  className?: string;
  children: ReactNode;
}

/** Une image de l'affiche. La première arrive en fondu ; les suivantes sont découvertes par un volet en biais. */
interface Couche {
  src: string;
  volet: boolean;
}

/**
 * Les braises : quelques points de lumière qui montent dans l'affiche. Leur place, leur taille et leur
 * rythme sont tirés de leur rang, pas du hasard : deux rendus donnent la même image.
 */
const BRAISES = Array.from({ length: 12 }, (_, rang) => ({
  x: (rang * 37 + 9) % 100,
  taille: 2 + ((rang * 7) % 4),
  retard: ((rang * 53) % 100) / 100,
  duree: 0.5 + ((rang * 29) % 50) / 100,
  derive: ((rang * 41) % 120) - 60,
}));

export function Affiche({ couleur, image, enAttente = false, haut, cote, idDuTitre, cle, className = '', children }: Proprietes) {
  useAmbiance(couleur, image);

  // On garde l'image précédente sous la nouvelle le temps du volet : l'affiche ne repasse jamais par un fond nu.
  const [couches, setCouches] = useState<Couche[]>(image === null ? [] : [{ src: image, volet: false }]);
  const derniere = couches[couches.length - 1];
  if (image !== null && image !== derniere?.src) {
    setCouches([...couches.slice(-1), { src: image, volet: couches.length > 0 }]);
  }

  return (
    <section
      className={`${styles.affiche} ${className}`}
      {...couleurDeJeu(couleur)}
      aria-labelledby={idDuTitre}
      // Parallaxe : l'image glisse à l'opposé du pointeur, le texte un peu avec lui, une lumière le suit.
      onPointerMove={(evenement) => {
        if (evenement.pointerType === 'mouse' && animationsActives()) suivreLePointeur(evenement.currentTarget, evenement.clientX, evenement.clientY);
      }}
      onPointerLeave={(evenement) => oublierLePointeur(evenement.currentTarget)}
    >
      {/* Sans image pour ce jeu, les anciennes s'éteignent et laissent voir sa couleur. */}
      <div className={styles.images} data-eteintes={image === null && !enAttente ? '' : undefined}>
        {couches.map((couche, rang) => (
          <img
            key={couche.src}
            className={styles.image}
            data-entree={couche.volet ? 'volet' : 'fondu'}
            src={couche.src}
            alt=""
            fetchPriority="high"
            decoding="async"
            onAnimationEnd={rang > 0 && rang === couches.length - 1 ? () => setCouches([couche]) : undefined}
          />
        ))}
      </div>
      <div className={styles.effets} aria-hidden="true">
        <span className={styles.faisceau} />
        <span className={styles.projecteur} />
        {BRAISES.map((braise) => (
          <span
            key={braise.x}
            className={styles.braise}
            style={{ '--x': braise.x, '--taille': `${braise.taille}px`, '--retard': braise.retard, '--duree': braise.duree, '--derive': `${braise.derive}px` } as CSSProperties}
          />
        ))}
        <span className={styles.reperes} />
      </div>
      <div className={styles.contenu}>
        <div className={styles.haut}>{haut}</div>
        <div className={styles.bas}>
          <div key={cle} className={styles.infos}>
            {children}
          </div>
          {cote !== undefined && <div className={styles.cote}>{cote}</div>}
        </div>
      </div>
    </section>
  );
}

/** Le logo du jeu s'il existe, sinon son titre écrit. Dans les deux cas, c'est le titre de la page. */
export function TitreDAffiche({ id, titre, logo }: { id: string; titre: string; logo: string | null }) {
  return (
    <h1 id={id} className={logo === null ? styles.titre : styles.titreEnImage} data-gabarit={logo === null ? gabaritDeTitre(titre) : undefined}>
      {logo === null ? titre : <img className={styles.logo} src={logo} alt={titre} />}
    </h1>
  );
}

/** Une ligne de faits courts (studio, année, source), séparés par une barre inclinée. */
export function LigneDAffiche({ morceaux }: { morceaux: string[] }) {
  return (
    <p className={styles.ligne}>
      {morceaux.map((morceau) => (
        <span key={morceau}>{morceau}</span>
      ))}
    </p>
  );
}

export interface TuileDAffiche {
  nom: string;
  valeur: ReactNode;
  /** De 0 à 1 : dessine une jauge sous la valeur (progression des succès). */
  jauge?: number;
}

/** Les chiffres du jeu, en tuiles posées sur l'image : temps de jeu, succès, dernière partie. */
export function TuilesDAffiche({ tuiles }: { tuiles: TuileDAffiche[] }) {
  return (
    <dl className={styles.tuiles}>
      {tuiles.map((tuile) => (
        <div key={tuile.nom} className={styles.tuile}>
          <dt>{tuile.nom}</dt>
          <dd className="chiffres">{tuile.valeur}</dd>
          {tuile.jauge !== undefined && (
            <span className={styles.jauge} aria-hidden="true">
              <span style={{ width: `${Math.round(Math.min(1, Math.max(0, tuile.jauge)) * 100)}%` }} />
            </span>
          )}
        </div>
      ))}
    </dl>
  );
}

export function ActionsDAffiche({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
