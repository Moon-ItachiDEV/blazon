import { useMemo, type CSSProperties } from 'react';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { lancerLeJeu, useApplication } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { aReprendre } from '../bibliotheque/logique';
import { formaterDateRelative } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien, useRoute } from '../navigation';
import styles from './Recents.module.css';

const NOMBRE = 4;

/**
 * Le dock des derniers jeux, dans la barre latérale : une tuile arrondie par jeu, qui grossit sous la
 * main comme une icône de dock, son titre et quand il a été lancé. Le jeu ouvert porte un anneau
 * carmin ; au survol, un bouton rond le lance sans passer par la fiche.
 */
export function Recents() {
  const { t, langue } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const occupe = useApplication((a) => a.lancement !== null || (a.etat?.session_en_cours ?? null) !== null);
  const maintenant = useMaintenant();
  const route = useRoute();
  const ouvert = route.ecran === 'jeu' || route.ecran === 'succes' ? route.id_jeu : null;
  const recents = useMemo(() => (jeux === null ? [] : aReprendre(jeux, NOMBRE)), [jeux]);
  if (recents.length === 0) return null;

  return (
    <section className={styles.recents} aria-labelledby="laterale-recents">
      <h2 id="laterale-recents" className={styles.titre}>
        {t('carmin.recents')}
      </h2>
      <ul className={styles.liste}>
        {recents.map((jeu, rang) => (
          <li key={jeu.id} className={styles.ligne} style={{ '--rang': rang, '--couleur-jaquette': jeu.couleur_dominante ?? undefined } as CSSProperties} data-ouvert={jeu.id === ouvert ? '' : undefined}>
            <Lien className={styles.lien} vers={{ ecran: 'jeu', id_jeu: jeu.id }} aria-current={jeu.id === ouvert ? 'true' : undefined}>
              <span className={styles.tuile}>
                <Jaquette jeu={jeu} className={styles.image ?? ''} />
              </span>
              <span className={styles.texte}>
                <span className={styles.nom}>{jeu.titre}</span>
                <span className={styles.quand}>
                  {jeu.temps.dernier_lancement === null ? t('scene.tuile.jamais') : formaterDateRelative(jeu.temps.dernier_lancement, langue, maintenant)}
                </span>
              </span>
            </Lien>
            <button type="button" className={styles.jouer} disabled={occupe} aria-label={t('jeu.jouer_a', { titre: jeu.titre })} onClick={() => void lancerLeJeu(jeu.id)}>
              <Icone nom="jouer" taille={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
