/**
 * Les amis (V2) : d'abord ce qui se joue en ce moment, une bannière par jeu portée par l'art du jeu
 * (fond flouté + affiche), avec les avatars de ceux qui y jouent ; puis les amis en ligne en cartes de
 * verre ; puis les hors ligne, éteints.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import type { Ami } from '../../contrat/types';
import { disponible } from '../artefact/images';
import { aSignaler, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { EnTeteDEcran, ImageDeJeuAuto, PileDAvatars } from '../composants/Visuels';
import { coeur } from '../coeur';
import { tenter, useApplication } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDateRelative } from '../formats';
import { useTexte } from '../i18n/react';
import { naviguer } from '../navigation';
import { Avatar } from '../profil/Avatar';
import { filtrerLesAmis, repartirLesAmis, type Partie } from './logique';
import styles from './Amis.module.css';

function Actions({ ami }: { ami: Ami }) {
  const { t } = useTexte();
  return (
    <span className={styles.actions}>
      <button type="button" className={styles.rond} aria-label={`${t('amis.envoyer_un_message')} · ${ami.pseudo}`} title={t('amis.envoyer_un_message')} onClick={() => void tenter((c) => c.action_steam({ action: 'envoyer_un_message', steamid: ami.steamid }))}>
        <Icone nom="message" taille={17} />
      </button>
      <button type="button" className={styles.rond} aria-label={`${t('v2.voir_le_profil')} · ${ami.pseudo}`} title={t('v2.voir_le_profil')} onClick={() => void tenter((c) => c.action_steam({ action: 'ouvrir_le_profil', steamid: ami.steamid }))}>
        <Icone nom="lien_externe" taille={17} />
      </button>
    </span>
  );
}

function Banniere({ partie }: { partie: Partie }) {
  const { t, tp } = useTexte();
  const jeuLocal = useApplication((a) => (partie.jeu.id_jeu === null ? undefined : a.jeux?.find((j) => j.id === partie.jeu.id_jeu)));
  const id_jeu = partie.jeu.id_jeu;
  const appid = partie.jeu.steam_appid;
  const style = { '--couleur-carte': partie.jeu.couleur_dominante ?? '#2a3550' } as CSSProperties;
  return (
    <li className={styles.banniere} style={style}>
      <span className={styles.banniereArt} aria-hidden="true">
        {jeuLocal !== undefined ? (
          <ImageDeJeuAuto jeu={jeuLocal} prefere="hero" className={styles.banniereImage} />
        ) : disponible(partie.jeu.jaquette) ? (
          <span className={styles.banniereAffiche}>
            <img className={styles.banniereFlou} src={partie.jeu.jaquette} alt="" loading="lazy" />
            <img className={styles.banniereNette} src={partie.jeu.jaquette} alt="" loading="lazy" />
          </span>
        ) : null}
      </span>
      <div className={styles.banniereCorps}>
        <span className="etiquette">{id_jeu !== null ? t('amis.partie.possede') : appid !== null ? t('amis.partie.magasin') : t('amis.partie.hors_steam')}</span>
        <h3 className={styles.banniereTitre}>{partie.jeu.titre}</h3>
        <div className={styles.banniereBas}>
          <PileDAvatars amis={partie.amis} max={5} taille={36} />
          <span className={styles.banniereNoms}>{tp('fiche.amis_y_jouent', partie.amis.length)}</span>
          {id_jeu !== null ? (
            <button type="button" className={styles.rejoindre} onClick={() => naviguer({ ecran: 'jeu', id_jeu })}>
              {t('v2.rejoindre')}
              <Icone nom="chevron_droit" taille={16} />
            </button>
          ) : (
            appid !== null && (
              <button type="button" className={styles.rejoindre} onClick={() => void tenter((c) => c.action_steam({ action: 'voir_dans_le_magasin', steam_appid: appid }))}>
                {t('v2.page_magasin')}
                <Icone nom="lien_externe" taille={15} />
              </button>
            )
          )}
        </div>
      </div>
    </li>
  );
}

function CarteAmi({ ami }: { ami: Ami }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  const vu = ami.statut === 'hors_ligne' && ami.derniere_connexion !== null ? t('v2.vu', { quand: formaterDateRelative(ami.derniere_connexion, langue, maintenant).toLocaleLowerCase(langue) }) : null;
  return (
    <li className={styles.ami} data-statut={ami.statut}>
      <span className={styles.amiAvatar} data-statut={ami.statut}>
        <Avatar image={ami.avatar} pseudo={ami.pseudo} taille={46} />
      </span>
      <span className={styles.amiTexte}>
        <span className={styles.amiPseudo}>{ami.pseudo}</span>
        <span className={styles.amiStatut} data-statut={ami.statut}>
          {ami.statut === 'en_jeu' && ami.jeu_en_cours !== null ? t('v2.joue_a', { titre: ami.jeu_en_cours.titre }) : (vu ?? t(`amis.statut.${ami.statut}`))}
        </span>
      </span>
      <Actions ami={ami} />
    </li>
  );
}

export function EcranAmis() {
  const { t, tp, te, langue } = useTexte();
  const amis = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const [texte, setTexte] = useState('');
  const liste = useMemo(() => filtrerLesAmis(amis.donnees ?? [], texte), [amis.donnees, texte]);
  const repartition = useMemo(() => repartirLesAmis(liste, langue), [liste, langue]);
  const total = amis.donnees?.length ?? 0;
  const enJeu = repartition.parties.reduce((n, p) => n + p.amis.length, 0);

  return (
    <div className={styles.ecran}>
      <EnTeteDEcran
        titre={t('coque.amis')}
        texte={total > 0 ? `${tp('amis.nombre', total)} · ${tp('coque.amis_en_jeu', enJeu)}` : undefined}
        actions={
          total > 0 ? (
            <label className={styles.champ}>
              <Icone nom="recherche" taille={17} />
              <input type="search" value={texte} placeholder={t('amis.filtre.nom')} aria-label={t('amis.filtre.nom')} onChange={(e) => setTexte(e.target.value)} />
            </label>
          ) : undefined
        }
      />

      {amis.vue === 'chargement' && (
        <div className={styles.parties} role="status" aria-label={t('commun.chargement')}>
          <Squelette hauteur="200px" rayon="24px" />
          <Squelette hauteur="200px" rayon="24px" />
        </div>
      )}
      {amis.vue === 'erreur' && amis.erreur !== null && <ErreurPleine erreur={amis.erreur} reessayer={amis.reessayer} />}
      {amis.vue === 'vide' && <Message icone="amis" titre={t('amis.vide.titre')} texte={t('amis.vide.texte')} />}

      {amis.donnees !== null && amis.donnees.length > 0 && (
        <>
          {aSignaler(amis.erreur, true) && <Note icone={iconeDErreur(amis.erreur)}>{te(amis.erreur)}</Note>}
          {liste.length === 0 && <Message icone="recherche" titre={t('amis.filtre.aucun.titre')} texte={t('amis.filtre.aucun.texte', { texte })} />}

          {repartition.parties.length > 0 && (
            <section aria-labelledby="amis-parties">
              <h2 id="amis-parties" className={styles.titre}>
                {t('v2.en_train_de_jouer')}
                <span className="chiffres">{enJeu}</span>
              </h2>
              <ul className={`${styles.parties} cascade`}>
                {repartition.parties.map((p) => (
                  <Banniere key={p.cle} partie={p} />
                ))}
              </ul>
            </section>
          )}

          {repartition.connectes.length > 0 && (
            <section aria-labelledby="amis-en-ligne">
              <h2 id="amis-en-ligne" className={styles.titre}>
                {t('amis.groupe.en_ligne')}
                <span className="chiffres">{repartition.connectes.length}</span>
              </h2>
              <ul className={`${styles.grille} cascade`}>
                {repartition.connectes.map((a) => (
                  <CarteAmi key={a.steamid} ami={a} />
                ))}
              </ul>
            </section>
          )}

          {repartition.horsLigne.length > 0 && (
            <section aria-labelledby="amis-hors-ligne">
              <h2 id="amis-hors-ligne" className={styles.titre}>
                {t('amis.groupe.hors_ligne')}
                <span className="chiffres">{repartition.horsLigne.length}</span>
              </h2>
              <ul className={`${styles.grille} ${styles.eteints}`}>
                {repartition.horsLigne.map((a) => (
                  <CarteAmi key={a.steamid} ami={a} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
