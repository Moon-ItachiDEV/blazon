/**
 * Le profil (V2) : un en-tête sur l'art flouté du jeu le plus joué, avatar cerclé, pseudo et niveau ;
 * une rangée de grands chiffres en bleu ciel dégradé qui comptent ; puis les plus joués avec leurs jauges,
 * la part de chaque source et la bibliothèque explorée.
 */
import { useMemo, type CSSProperties } from 'react';
import { disponible } from '../artefact/images';
import { aSignaler, iconeDErreur, Message, Note } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { NombreAnime } from '../composants/NombreAnime';
import { ImageDeJeuAuto } from '../composants/Visuels';
import { coeur } from '../coeur';
import { useAmbiance } from '../etat/ambiance';
import { tenter, useApplication } from '../etat/application';
import { useReponse } from '../etat/ressource';
import { formaterNombre, formaterPourcentage, formaterTaille, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { Avatar } from './Avatar';
import { calculerLesChiffres, compterMasques, jeuxComptes, plusJoues, repartitionParSource } from './logique';
import styles from './Profil.module.css';

export function EcranProfil() {
  const { t, tp, te, langue } = useTexte();
  const profil = useReponse(() => coeur.profil(), 'profil', null, 'profil');
  const jeux = useApplication((a) => a.jeux);
  const etat = useApplication((a) => a.etat);
  const comptes = useMemo(() => jeuxComptes(jeux ?? []), [jeux]);
  const chiffres = useMemo(() => calculerLesChiffres(comptes), [comptes]);
  const sources = useMemo(() => repartitionParSource(comptes), [comptes]);
  const top = useMemo(() => plusJoues(comptes, 5), [comptes]);
  const masques = useMemo(() => compterMasques(jeux ?? []), [jeux]);
  const premier = top[0];
  useAmbiance(premier?.couleur_dominante ?? null, premier !== undefined && disponible(premier.jaquette) ? premier.jaquette : null);

  const pseudo = profil.donnees?.pseudo ?? null;
  const steamid = profil.donnees?.steamid ?? null;
  const heures = chiffres.minutes_total / 60;
  const niveau = Math.floor(heures / 100) + 1;
  const versSuivant = (heures % 100) / 100;
  const lances = chiffres.jeux - chiffres.jamais_lances;
  const nombre = (n: number) => formaterNombre(Math.round(n), langue);
  const max = premier?.temps.minutes_total ?? 1;

  if (jeux !== null && jeux.length === 0) return <Message icone="utilisateur" titre={t('profil.vide.titre')} texte={t('profil.vide.texte')} />;

  return (
    <div className={styles.ecran}>
      <header className={styles.entete}>
        <div className={styles.enteteArt} aria-hidden="true">
          {premier !== undefined && <ImageDeJeuAuto jeu={premier} prefere="hero" className={styles.enteteImage} />}
        </div>
        <div className={styles.identite}>
          <span className={styles.avatar}>
            <Avatar image={profil.donnees?.avatar ?? null} pseudo={pseudo} taille={112} />
          </span>
          <div className={styles.identiteTexte}>
            <span className={styles.statut}>
              <span className={styles.point} />
              {t('amis.statut.en_ligne')}
            </span>
            <h1 className={styles.pseudo}>{pseudo ?? t('profil.pseudo_inconnu')}</h1>
            <div className={styles.niveau}>
              <span className={styles.niveauBadge}>{t('profil.niveau', { n: niveau })}</span>
              <span className={styles.niveauJauge} aria-hidden="true">
                <span style={{ '--part': versSuivant } as CSSProperties} />
              </span>
              <span className={styles.niveauTexte}>{t('profil.niveau.explication', { temps: formaterTempsDeJeu(Math.round((1 - versSuivant) * 6000), langue) })}</span>
            </div>
          </div>
          {steamid !== null && (
            <button type="button" className={styles.boutonSteam} onClick={() => void tenter((c) => c.action_steam({ action: 'ouvrir_le_profil', steamid }))}>
              {t('profil.ouvrir_mon_profil')}
              <Icone nom="lien_externe" taille={16} />
            </button>
          )}
        </div>
      </header>

      {aSignaler(profil.erreur, profil.donnees !== null) && <Note icone={iconeDErreur(profil.erreur)}>{t('profil.indisponible', { raison: te(profil.erreur) })}</Note>}
      {etat?.jeux_possedes_erreur != null && <Note icone={iconeDErreur(etat.jeux_possedes_erreur)}>{t('profil.partielle', { raison: te(etat.jeux_possedes_erreur) })}</Note>}

      <dl className={`${styles.chiffres} verre-poli cascade`}>
        <div className={styles.chiffre}>
          <dd className="texte-degrade chiffres">
            <NombreAnime valeur={Math.floor(heures)} format={(n) => `${nombre(n)} h`} />
          </dd>
          <dt>{t('profil.chiffre.temps')}</dt>
        </div>
        <div className={styles.chiffre}>
          <dd className="texte-degrade chiffres">
            <NombreAnime valeur={chiffres.jeux} format={nombre} />
          </dd>
          <dt>{tp('profil.chiffre.jeux', chiffres.jeux)}</dt>
        </div>
        {chiffres.succes_debloques !== null && (
          <div className={styles.chiffre}>
            <dd className="texte-degrade chiffres">
              <NombreAnime valeur={chiffres.succes_debloques} format={nombre} />
            </dd>
            <dt>{tp('profil.chiffre.succes', chiffres.succes_debloques)}</dt>
          </div>
        )}
        <div className={styles.chiffre}>
          <dd className="texte-degrade chiffres">
            <NombreAnime valeur={chiffres.installes} format={nombre} />
          </dd>
          <dt>{tp('profil.chiffre.installes', chiffres.installes)}</dt>
        </div>
        <div className={styles.chiffre}>
          <dd className="texte-degrade chiffres">{formaterTaille(chiffres.taille_installee, langue)}</dd>
          <dt>{t('profil.chiffre.taille')}</dt>
        </div>
      </dl>

      <div className={styles.colonnes}>
        <section className={`${styles.panneau} verre-poli`} aria-labelledby="profil-plus-joues">
          <h2 id="profil-plus-joues" className={styles.titre}>
            {t('profil.plus_joues')}
          </h2>
          {top.length === 0 ? (
            <p className={styles.discret}>{t('profil.plus_joues.aucun')}</p>
          ) : (
            <ol className={styles.top}>
              {top.map((jeu, i) => (
                <li key={jeu.id}>
                  <Lien className={styles.topLigne} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
                    <span className={`${styles.rang} chiffres`}>{i + 1}</span>
                    <span className={styles.topImage}>
                      <ImageDeJeuAuto jeu={jeu} className={styles.topImageCadre} />
                    </span>
                    <span className={styles.topTexte}>
                      <span className={styles.topTitre}>{jeu.titre}</span>
                      <span className={styles.jauge} aria-hidden="true">
                        <span style={{ '--part': jeu.temps.minutes_total / max, '--i': i } as CSSProperties} />
                      </span>
                    </span>
                    <span className={`${styles.topTemps} chiffres`}>{formaterTempsDeJeu(jeu.temps.minutes_total, langue)}</span>
                  </Lien>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className={styles.cote}>
          <section className={`${styles.panneau} verre-poli`} aria-labelledby="profil-exploree">
            <h2 id="profil-exploree" className={styles.titre}>
              {t('profil.exploree')}
            </h2>
            <p className={`${styles.grand} texte-degrade chiffres`}>{formaterPourcentage(chiffres.jeux === 0 ? 0 : (lances / chiffres.jeux) * 100, langue)}</p>
            <span className={styles.jauge} aria-hidden="true">
              <span style={{ '--part': chiffres.jeux === 0 ? 0 : lances / chiffres.jeux } as CSSProperties} />
            </span>
            <p className={styles.discret}>{t('profil.exploree.detail', { lances: nombre(lances), total: nombre(chiffres.jeux) })}</p>
          </section>

          <section className={`${styles.panneau} verre-poli`} aria-labelledby="profil-sources">
            <h2 id="profil-sources" className={styles.titre}>
              {t('profil.sources.titre')}
            </h2>
            <ul className={styles.sources}>
              {sources.map((s, i) => (
                <li key={s.source}>
                  <span className={styles.sourceNom}>{t(`sources.${s.source}`)}</span>
                  <span className={styles.jauge} aria-hidden="true">
                    <span style={{ '--part': s.jeux / Math.max(1, sources[0]?.jeux ?? 1), '--i': i } as CSSProperties} />
                  </span>
                  <span className={`${styles.sourceNombre} chiffres`}>{nombre(s.jeux)}</span>
                </li>
              ))}
            </ul>
            <p className={styles.discret}>{t('profil.sources.texte')}</p>
            {masques > 0 && <p className={styles.discret}>{tp('profil.masques', masques)}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
