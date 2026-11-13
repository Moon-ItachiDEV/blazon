import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icone, type NomDIcone } from './Icone';
import styles from './Menu.module.css';

export interface ElementDeMenu {
  cle: string;
  libelle: string;
  /** Défini = le menu est un choix parmi plusieurs (bouton radio). */
  coche?: boolean;
  icone?: NomDIcone;
  danger?: boolean;
  /** Trait de séparation au-dessus de cet élément. */
  separe?: boolean;
  action: () => void;
}

interface Proprietes {
  /** Classes du bouton qui ouvre le menu. */
  classeDuBouton: string;
  /** Nom lu par un lecteur d'écran quand le bouton ne contient pas de texte suffisant. */
  nom?: string;
  contenu: ReactNode;
  elements: ElementDeMenu[];
  alignement?: 'gauche' | 'droite';
}

export function Menu({ classeDuBouton, nom, contenu, elements, alignement = 'gauche' }: Proprietes) {
  // `useId` contient des caractères interdits dans un nom CSS : on ne garde que lettres et chiffres.
  const id = `menu-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ancre = `--${id}`;
  const panneau = useRef<HTMLDivElement>(null);

  const boutons = () => Array.from(panneau.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);

  const aLOuverture = (ouvert: boolean) => {
    if (!ouvert) return;
    const tous = boutons();
    (tous.find((b) => b.getAttribute('aria-checked') === 'true') ?? tous[0])?.focus();
  };

  const auClavier = (evenement: KeyboardEvent<HTMLDivElement>) => {
    const tous = boutons();
    const actuel = tous.indexOf(document.activeElement as HTMLButtonElement);
    const aller = (index: number) => {
      evenement.preventDefault();
      tous[(index + tous.length) % tous.length]?.focus();
    };
    if (evenement.key === 'ArrowDown') aller(actuel + 1);
    else if (evenement.key === 'ArrowUp') aller(actuel - 1);
    else if (evenement.key === 'Home') aller(0);
    else if (evenement.key === 'End') aller(tous.length - 1);
    else if (evenement.key === 'Tab') panneau.current?.hidePopover();
  };

  return (
    <>
      <button type="button" className={classeDuBouton} popoverTarget={id} aria-haspopup="menu" aria-label={nom} style={{ anchorName: ancre }}>
        {contenu}
      </button>
      <div
        ref={panneau}
        id={id}
        popover="auto"
        role="menu"
        aria-label={nom}
        className={`${styles.menu} ${alignement === 'droite' ? styles.aDroite : ''}`}
        style={{ positionAnchor: ancre }}
        onToggle={(evenement) => aLOuverture(evenement.newState === 'open')}
        onKeyDown={auClavier}
      >
        {elements.map((element) => (
          <div key={element.cle} role="none">
            {element.separe === true && <div className={styles.separateur} role="separator" />}
            <button
              type="button"
              role={element.coche === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={element.coche}
              tabIndex={-1}
              className={`${styles.element} ${element.danger === true ? styles.danger : ''}`}
              onClick={() => {
                panneau.current?.hidePopover();
                element.action();
              }}
            >
              {element.coche !== undefined && <span className={styles.coche}>{element.coche && <Icone nom="coche" taille={18} />}</span>}
              {element.icone !== undefined && <Icone nom={element.icone} taille={18} />}
              <span>{element.libelle}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
