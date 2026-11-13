import type { Ami } from '../../contrat/types';
import { Icone } from '../composants/Icone';
import { creerMagasin, useMagasin } from '../etat/magasin';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { Avatar } from '../profil/Avatar';
import styles from './PanneauAmis.module.css';

/** Au-delà, les amis en ligne sont résumés en une ligne : le panneau reste un coup d'œil, pas une liste. */
const EN_LIGNE_MONTRES = 8;
/** Largeur de fenêtre à partir de laquelle le panneau s'ouvre de lui-même. */
const LARGEUR_OUVERTE = 1800;

const ouvert = creerMagasin<boolean>(typeof window !== 'undefined' && window.innerWidth >= LARGEUR_OUVERTE);

function Personne({ ami, reduit }: { ami: Ami; reduit: boolean }) {
  const { t } = useTexte();
  const jeu = ami.statut === 'en_jeu' ? ami.jeu_en_cours : null;
  const contenu = (
    <>
      <span className={styles.portrait} data-statut={ami.statut}>
        <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={36} />
      </span>
      <span className={reduit ? 'hors-ecran' : styles.texte}>
        <span className={styles.pseudo}>{ami.pseudo}</span>
        <span className={styles.activite} data-statut={ami.statut}>
          {jeu === null ? t(`amis.statut.${ami.statut}`) : jeu.titre}
        </span>
      </span>
    </>
  );
  // Un ami qui joue à un jeu de notre bibliothèque mène à la fiche de ce jeu.
  if (jeu !== null && jeu.id_jeu !== null) {
    return (
      <li>
        <Lien className={styles.personne} vers={{ ecran: 'jeu', id_jeu: jeu.id_jeu }} title={t('panneau_amis.joue_a', { pseudo: ami.pseudo, titre: jeu.titre })}>
          {contenu}
        </Lien>
      </li>
    );
  }
  return (
    <li className={styles.personne} title={reduit ? ami.pseudo : undefined}>
      {contenu}
    </li>
  );
}

/**
 * Le panneau d'amis, à droite de tous les écrans : qui joue et à quoi, qui est en ligne.
 * Réduit, il ne garde qu'une colonne d'avatars. La liste complète reste l'écran Amis.
 */
export function PanneauAmis({ amis }: { amis: Ami[] }) {
  const { t, tp } = useTexte();
  const estOuvert = useMagasin(ouvert, (o) => o);
  const enJeu = amis.filter((ami) => ami.statut === 'en_jeu');
  const enLigne = amis.filter((ami) => ami.statut === 'en_ligne');
  const montres = enLigne.slice(0, EN_LIGNE_MONTRES);
  const autres = enLigne.length - montres.length;

  return (
    <aside className={styles.panneau} data-etat={estOuvert ? 'ouvert' : 'reduit'} aria-label={t('panneau_amis.nom')}>
      <div className={styles.entete}>
        {estOuvert && <h2 className="titre-section">{t('coque.amis')}</h2>}
        <button
          type="button"
          className={styles.bascule}
          aria-expanded={estOuvert}
          aria-label={t(estOuvert ? 'panneau_amis.reduire' : 'panneau_amis.ouvrir')}
          title={t(estOuvert ? 'panneau_amis.reduire' : 'panneau_amis.ouvrir')}
          onClick={() => ouvert.ecrire((o) => !o)}
        >
          <Icone nom={estOuvert ? 'chevron_droit' : 'utilisateur'} taille={18} />
        </button>
      </div>

      {enJeu.length === 0 && enLigne.length === 0 && estOuvert && <p className={styles.vide}>{t('panneau_amis.personne')}</p>}

      {enJeu.length > 0 && (
        <section className={styles.groupe}>
          <h3 className={styles.nomDuGroupe}>
            <span className={estOuvert ? undefined : 'hors-ecran'}>{t('amis.groupe.en_jeu')}</span>
            <span className={`${styles.nombre} chiffres`}>{enJeu.length}</span>
          </h3>
          <ul className={`cascade ${styles.liste}`}>
            {enJeu.map((ami) => (
              <Personne key={ami.steamid} ami={ami} reduit={!estOuvert} />
            ))}
          </ul>
        </section>
      )}

      {montres.length > 0 && (
        <section className={styles.groupe}>
          <h3 className={styles.nomDuGroupe}>
            <span className={estOuvert ? undefined : 'hors-ecran'}>{t('amis.groupe.en_ligne')}</span>
            <span className={`${styles.nombre} chiffres`}>{enLigne.length}</span>
          </h3>
          <ul className={`cascade ${styles.liste}`}>
            {montres.map((ami) => (
              <Personne key={ami.steamid} ami={ami} reduit={!estOuvert} />
            ))}
          </ul>
          {autres > 0 && estOuvert && <p className={styles.autres}>{tp('panneau_amis.autres', autres)}</p>}
        </section>
      )}

      {estOuvert && (
        <Lien className={styles.tous} vers={{ ecran: 'amis' }}>
          {tp('panneau_amis.tous', amis.length)}
          <Icone nom="chevron_droit" taille={16} />
        </Lien>
      )}
    </aside>
  );
}
