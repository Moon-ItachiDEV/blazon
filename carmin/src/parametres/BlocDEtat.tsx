import type { ReactNode, Ref } from 'react';
import { Icone, type NomDIcone } from '../composants/Icone';
import type { Ton } from './logique';
import styles from './Parametres.module.css';

interface Proprietes {
  icone: NomDIcone;
  ton: Ton;
  titre: string;
  texte?: ReactNode;
  /** Pour y ramener le focus après une action qui fait disparaître le bouton cliqué. */
  refDuTitre?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}

/** Un état dit en clair : une icône colorée selon le ton, un titre, une phrase, puis la suite. */
export function BlocDEtat({ icone, ton, titre, texte, refDuTitre, children }: Proprietes) {
  return (
    <div className={`${styles.etat} ${styles[ton] ?? ''}`}>
      <span className={styles.etatIcone}>
        <Icone nom={icone} taille={18} />
      </span>
      <div className={styles.etatCorps}>
        <div>
          <h3 className={styles.etatTitre} ref={refDuTitre} tabIndex={refDuTitre === undefined ? undefined : -1}>
            {titre}
          </h3>
          {texte !== undefined && <p className={styles.etatTexte}>{texte}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
