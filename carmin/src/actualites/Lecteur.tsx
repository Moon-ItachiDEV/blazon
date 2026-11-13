import type { MouseEvent } from 'react';
import type { Actualite } from '../../contrat/types';
import { Bouton } from '../composants/Bouton';
import { Dialogue } from '../composants/Dialogue';
import { Icone } from '../composants/Icone';
import { coeur } from '../coeur';
import { tenter } from '../etat/application';
import { useTexte } from '../i18n/react';
import { Etiquettes } from './CarteActualite';
import styles from './Actualites.module.css';

/**
 * Lecture d'une annonce dans l'application.
 *
 * Le HTML vient du cœur, qui l'a déjà nettoyé (liste blanche, règle §15) : c'est la seule raison
 * pour laquelle `dangerouslySetInnerHTML` est acceptable ici. Deuxième barrière : un clic sur un
 * lien de l'annonce ne navigue jamais dans l'application, il est confié au navigateur par le cœur.
 */
export function LecteurDActualite({ actualite, jeu, onFermer }: { actualite: Actualite | null; jeu?: string; onFermer: () => void }) {
  const { t } = useTexte();

  const auClic = (evenement: MouseEvent<HTMLDivElement>) => {
    const lien = (evenement.target as HTMLElement).closest('a');
    if (lien === null) return;
    evenement.preventDefault();
    const adresse = lien.getAttribute('href');
    if (adresse !== null) void tenter(() => coeur.ouvrir_un_lien(adresse));
  };

  return (
    <Dialogue
      large
      ouvert={actualite !== null}
      onFermer={onFermer}
      titre={actualite?.titre ?? ''}
      pied={
        actualite !== null && (
          <Bouton onClick={() => void tenter(() => coeur.ouvrir_un_lien(actualite.url))}>
            <Icone nom="lien_externe" taille={18} />
            {t('actualite.ouvrir_l_origine')}
          </Bouton>
        )
      }
    >
      {actualite !== null && (
        <>
          <Etiquettes actualite={actualite} {...(jeu === undefined ? {} : { jeu })} />
          {actualite.image !== null && <img className={styles.image} src={actualite.image} alt="" />}
          <div className={styles.texte} lang={actualite.langue === 'autre' ? undefined : actualite.langue} onClick={auClic} dangerouslySetInnerHTML={{ __html: actualite.html_sur }} />
        </>
      )}
    </Dialogue>
  );
}
