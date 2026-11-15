import { memo, useRef, type CSSProperties } from 'react';
import type { JeuResume, Langue } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { useFenetre } from '../composants/fenetre';
import { lancerLeJeu } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { formaterDateRelative, formaterTaille, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import styles from './Bibliotheque.module.css';

/** Doit rester égale à la hauteur de `.ligne` dans la feuille de style. */
const HAUTEUR_DE_LIGNE = 64;

interface ProprietesDeLigne {
  jeu: JeuResume;
  rang: number;
  total: number;
  langue: Langue;
  maintenant: Date;
  peutLancer: boolean;
}

const Ligne = memo(function Ligne({ jeu, rang, total, langue, maintenant, peutLancer }: ProprietesDeLigne) {
  const { t } = useTexte();
  const sources = jeu.sources.map((source) => t(`sources.${source}`)).join(', ');
  return (
    <li className={`${styles.ligne} ${jeu.installe ? '' : styles.ligneAbsent}`} aria-posinset={rang} aria-setsize={total}>
      <Lien className={styles.ligneJeu} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
        <span className={styles.ligneIcone} style={{ '--couleur-jaquette': jeu.couleur_dominante ?? undefined } as CSSProperties} aria-hidden="true">
          {jeu.icone === null ? jeu.titre.charAt(0) : <img src={jeu.icone} alt="" width={40} height={40} loading="lazy" decoding="async" />}
        </span>
        <span style={{ minWidth: 0 }}>
          <span className={styles.ligneTitre} style={{ display: 'block' }}>
            {jeu.titre}
          </span>
          <span className={styles.ligneSous} style={{ display: 'block' }}>
            {jeu.installe ? sources : `${sources} · ${t('jeu.non_installe')}`}
          </span>
        </span>
      </Lien>
      <span className={`${styles.cellule} ${styles.secondaire}`}>
        {jeu.temps.dernier_lancement === null ? t('jeu.jamais_lance') : formaterDateRelative(jeu.temps.dernier_lancement, langue, maintenant)}
      </span>
      <span className={`${styles.cellule} ${styles.droite} chiffres`}>{jeu.temps.minutes_total > 0 ? formaterTempsDeJeu(jeu.temps.minutes_total, langue) : ''}</span>
      <span className={`${styles.cellule} ${styles.droite} ${styles.secondaire} chiffres`}>{jeu.taille_octets === null ? '' : formaterTaille(jeu.taille_octets, langue)}</span>
      {jeu.installe ? (
        <button type="button" className={styles.ligneJouer} disabled={!peutLancer} aria-label={t('jeu.jouer_a', { titre: jeu.titre })} onClick={() => void lancerLeJeu(jeu.id)}>
          <Icone nom="jouer" taille={18} />
        </button>
      ) : (
        <span />
      )}
    </li>
  );
});

export function Liste({ jeux, peutLancer, nom }: { jeux: JeuResume[]; peutLancer: boolean; nom: string }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const conteneur = useRef<HTMLDivElement>(null);
  const fenetre = useFenetre(conteneur, { nombre: jeux.length, largeurMin: null, espace: 0, hauteur: () => HAUTEUR_DE_LIGNE });
  return (
    <div className={styles.liste}>
      <div className={styles.listeEntete} aria-hidden="true">
        <span>{t('liste.jeu')}</span>
        <span className={styles.secondaire}>{t('liste.derniere_partie')}</span>
        <span className={styles.droite}>{t('liste.temps')}</span>
        <span className={`${styles.droite} ${styles.secondaire}`}>{t('liste.taille')}</span>
        <span />
      </div>
      <div ref={conteneur} style={{ height: fenetre.hauteurTotale }}>
        <ul aria-label={nom} style={{ transform: `translateY(${fenetre.decalage}px)` }}>
          {fenetre.colonnes > 0 &&
            jeux.slice(fenetre.debut, fenetre.fin).map((jeu, index) => (
              <Ligne key={jeu.id} jeu={jeu} rang={fenetre.debut + index + 1} total={jeux.length} langue={langue} maintenant={maintenant} peutLancer={peutLancer} />
            ))}
        </ul>
      </div>
    </div>
  );
}
