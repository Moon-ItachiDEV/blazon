import { useEffect, useMemo, useState } from 'react';
import type { ErreurApp, JeuResume } from '../../contrat/types';
import { Bouton, classeBouton } from '../composants/Bouton';
import { aSignaler, classeActionDeNote, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { Page } from '../composants/Page';
import { coeur } from '../coeur';
import { vautUnNouvelEssai } from '../coeur/erreurs';
import { signaler, tenter, useApplication } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDateHeure, formaterNombre, formaterPourcentage, formaterTaille, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { Avatar } from './Avatar';
import { calculerLesChiffres, compterMasques, jeuxComptes, plusJoues, repartitionParSource, type Chiffres, type PartDeSource } from './logique';
import styles from './Profil.module.css';

/** Erreurs que le joueur règle dans la section Steam des paramètres (clé) ou dans Steam (confidentialité). */
const SE_REGLE_DANS_STEAM = new Set<ErreurApp['code']>(['cle_absente', 'cle_refusee', 'profil_prive']);

/** Les derniers jeux lancés, du plus récent au plus ancien. */
function derniersLances(jeux: readonly JeuResume[], nombre: number): JeuResume[] {
  return jeuxComptes(jeux)
    .filter((jeu) => jeu.temps.dernier_lancement !== null)
    .sort((a, b) => (b.temps.dernier_lancement ?? '').localeCompare(a.temps.dernier_lancement ?? '') || a.id - b.id)
    .slice(0, nombre);
}

/** Les jeux les plus joués ces deux dernières semaines, d'après Steam. */
function plusJouesCesDeuxSemaines(jeux: readonly JeuResume[], nombre: number): JeuResume[] {
  return jeuxComptes(jeux)
    .filter((jeu) => (jeu.temps.minutes_2sem ?? 0) > 0)
    .sort((a, b) => (b.temps.minutes_2sem ?? 0) - (a.temps.minutes_2sem ?? 0) || a.titre_tri.localeCompare(b.titre_tri))
    .slice(0, nombre);
}

function LienVersLesReglages() {
  const { t } = useTexte();
  return (
    <Lien className={classeActionDeNote} vers={{ ecran: 'parametres', section: 'steam' }}>
      {t('bibliotheque.partielle.action')}
    </Lien>
  );
}

// ───────────────────────────── Le joueur

/** Qui est là : l'avatar, le pseudo, et le lien pour suivre un autre compte quand le PC en connaît plusieurs. */
function Identite({ pseudo, avatar, steamid, plusieursComptes }: { pseudo: string | null; avatar: string | null; steamid: string | null; plusieursComptes: boolean }) {
  const { t } = useTexte();
  return (
    <div className={styles.identite}>
      <Avatar image={avatar} pseudo={pseudo} taille={72} />
      <div className={styles.identiteTexte}>
        <p className={pseudo === null ? styles.pseudoAbsent : styles.pseudo}>{pseudo ?? t('profil.pseudo_inconnu')}</p>
        <p className={styles.compte}>
          {steamid !== null && <span>{t('profil.compte_steam')}</span>}
          {plusieursComptes && (
            <Lien className={styles.changer} vers={{ ecran: 'parametres', section: 'steam' }}>
              {t('profil.changer_de_compte')}
            </Lien>
          )}
        </p>
      </div>
    </div>
  );
}

// ───────────────────────────── Les chiffres

/** La bibliothèque en chiffres : la valeur, puis ce qu'elle compte. Ni icône ni cadre. */
function LesChiffres({ chiffres }: { chiffres: Chiffres }) {
  const { t, tp, langue } = useTexte();
  const part = formaterPourcentage(chiffres.part_jamais_lances, langue);
  const nombre = (valeur: number) => formaterNombre(valeur, langue);
  const temps = (minutes: number) => formaterTempsDeJeu(minutes, langue);
  const lignes: { cle: string; valeur: string; libelle: string }[] = [
    { cle: 'jeux', valeur: nombre(chiffres.jeux), libelle: tp('profil.chiffre.jeux', chiffres.jeux) },
    { cle: 'installes', valeur: nombre(chiffres.installes), libelle: tp('profil.chiffre.installes', chiffres.installes) },
    { cle: 'temps', valeur: temps(chiffres.minutes_total), libelle: t('profil.chiffre.temps') },
    ...(chiffres.minutes_2sem === null ? [] : [{ cle: '2sem', valeur: temps(chiffres.minutes_2sem), libelle: t('profil.chiffre.temps_2sem') }]),
    { cle: 'jamais', valeur: nombre(chiffres.jamais_lances), libelle: tp('profil.chiffre.jamais_lances', chiffres.jamais_lances, { part }) },
    ...(chiffres.succes_debloques === null ? [] : [{ cle: 'succes', valeur: nombre(chiffres.succes_debloques), libelle: tp('profil.chiffre.succes', chiffres.succes_debloques) }]),
    { cle: 'favoris', valeur: nombre(chiffres.favoris), libelle: tp('profil.chiffre.favoris', chiffres.favoris) },
    ...(chiffres.installes > 0 ? [{ cle: 'taille', valeur: formaterTaille(chiffres.taille_installee, langue), libelle: t('profil.chiffre.taille') }] : []),
  ];
  return (
    <dl className={styles.chiffres}>
      {lignes.map((ligne) => (
        <div key={ligne.cle} className={styles.chiffre}>
          <dt>{ligne.libelle}</dt>
          <dd className="chiffres">{ligne.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

// ───────────────────────────── Les classements

/** Une ligne de classement : le jeu, son temps, et une barre fine qui le compare au premier. */
function LigneDeJeu({ jeu, minutes, maximum, rang }: { jeu: JeuResume; minutes: number; maximum: number; rang?: number }) {
  const { t, langue } = useTexte();
  return (
    <li>
      <Lien className={styles.ligne} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
        {rang !== undefined && (
          <span className={`${styles.rang} chiffres`}>
            <span aria-hidden="true">{rang}</span>
            <span className="hors-ecran">{t('profil.plus_joues.rang', { n: rang })}</span>
          </span>
        )}
        <Jaquette jeu={jeu} className={styles.miniature ?? ''} />
        <span className={styles.ligneCorps}>
          <span className={styles.ligneHaut}>
            <span className={styles.ligneNom}>{jeu.titre}</span>
            <span className={`${styles.ligneValeur} chiffres`}>{formaterTempsDeJeu(minutes, langue)}</span>
          </span>
          <Barre part={maximum === 0 ? 0 : minutes / maximum} />
        </span>
      </Lien>
    </li>
  );
}

/** Décorative : la valeur est écrite juste au-dessus. Jamais vide, pour que la ligne garde sa barre. */
function Barre({ part }: { part: number }) {
  return (
    <span className={styles.piste} aria-hidden="true">
      <span className={styles.barre} style={{ width: `${Math.min(100, Math.max(2, part * 100))}%` }} />
    </span>
  );
}

/** Combien de jeux viennent de chaque magasin : une ligne par source, comme les classements d'à côté. */
function Sources({ sources, jeux }: { sources: PartDeSource[]; jeux: number }) {
  const { t, langue } = useTexte();
  const maximum = sources.reduce((plus, part) => Math.max(plus, part.jeux), 0);
  return (
    <dl className={styles.sources}>
      {sources.map((s) => (
        <div key={s.source} className={styles.source}>
          <dt>{t(`sources.${s.source}`)}</dt>
          <dd className="chiffres">
            {formaterNombre(s.jeux, langue)}
            <span className={styles.partSource}>{formaterPourcentage(jeux === 0 ? 0 : (s.jeux / jeux) * 100, langue)}</span>
          </dd>
          <Barre part={maximum === 0 ? 0 : s.jeux / maximum} />
        </div>
      ))}
    </dl>
  );
}

// ───────────────────────────── Activité récente

/** Les derniers jeux lancés : leur jaquette, puis quand et combien de temps au total. */
function Activite({ jeux }: { jeux: JeuResume[] }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  if (jeux.length === 0) return <p className={styles.discret}>{t('profil.activite.aucune')}</p>;
  return (
    <ol className={styles.activite}>
      {jeux.map((jeu) => (
        <li key={jeu.id}>
          <Lien className={styles.etape} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
            <Jaquette jeu={jeu} className={styles.etapeJaquette ?? ''} />
            <span className={styles.etapeTitre}>{jeu.titre}</span>
            <span className={styles.etapeDetail}>{jeu.temps.dernier_lancement === null ? '' : formaterDateHeure(jeu.temps.dernier_lancement, langue, maintenant)}</span>
            <span className={styles.etapeDetail}>{t('profil.activite.total', { temps: formaterTempsDeJeu(jeu.temps.minutes_total, langue) })}</span>
          </Lien>
        </li>
      ))}
    </ol>
  );
}

// ───────────────────────────── L'écran

function Bibliotheque({ jeux }: { jeux: JeuResume[] }) {
  const { t, tp } = useTexte();
  const chiffres = useMemo(() => calculerLesChiffres(jeux), [jeux]);
  const premiers = useMemo(() => plusJoues(jeux, 8), [jeux]);
  const sources = useMemo(() => repartitionParSource(jeux), [jeux]);
  const recents = useMemo(() => derniersLances(jeux, 8), [jeux]);
  const recemment = useMemo(() => plusJouesCesDeuxSemaines(jeux, 4), [jeux]);
  const masques = compterMasques(jeux);

  if (chiffres.jeux === 0) {
    return jeux.length === 0 ? (
      <Message
        icone="grille"
        titre={t('profil.vide.titre')}
        texte={t('profil.vide.texte')}
        actions={
          <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'ajout' }}>
            {t('bibliotheque.ajouter_un_jeu')}
          </Lien>
        }
      />
    ) : (
      <Message icone="oeil_barre" titre={t('profil.tout_masque.titre')} texte={t('profil.tout_masque.texte')} />
    );
  }

  return (
    <>
      <section className={styles.bloc} aria-labelledby="profil-chiffres">
        <h2 id="profil-chiffres" className="hors-ecran">
          {t('profil.chiffres.titre')}
        </h2>
        <LesChiffres chiffres={chiffres} />
        {masques > 0 && <p className={styles.discret}>{tp('profil.masques', masques)}</p>}
      </section>

      <div className={styles.colonnes}>
        <section className={styles.principale} aria-labelledby="profil-plus-joues">
          <h2 id="profil-plus-joues" className={`titre-section ${styles.titreDeSection}`}>
            {t('profil.plus_joues')}
          </h2>
          {premiers.length === 0 ? (
            <p className={styles.discret}>{t('profil.plus_joues.aucun')}</p>
          ) : (
            <ol className={styles.lignes}>
              {premiers.map((jeu, index) => (
                <LigneDeJeu key={jeu.id} jeu={jeu} minutes={jeu.temps.minutes_total} maximum={premiers[0]?.temps.minutes_total ?? 0} rang={index + 1} />
              ))}
            </ol>
          )}
        </section>

        <div className={styles.laterale}>
          {chiffres.minutes_2sem !== null && (
            <section aria-labelledby="profil-deux-semaines">
              <h2 id="profil-deux-semaines" className={`titre-section ${styles.titreDeSection}`}>
                {t('profil.deux_semaines.titre')}
              </h2>
              {recemment.length === 0 ? (
                <p className={styles.discret}>{t('profil.deux_semaines.aucun')}</p>
              ) : (
                <ol className={styles.lignes}>
                  {recemment.map((jeu) => (
                    <LigneDeJeu key={jeu.id} jeu={jeu} minutes={jeu.temps.minutes_2sem ?? 0} maximum={recemment[0]?.temps.minutes_2sem ?? 0} />
                  ))}
                </ol>
              )}
            </section>
          )}
          <section aria-labelledby="profil-sources">
            <h2 id="profil-sources" className={`titre-section ${styles.titreDeSection}`}>
              {t('profil.sources.titre')}
            </h2>
            <Sources sources={sources} jeux={chiffres.jeux} />
            {sources.length > 1 && <p className={styles.discret}>{t('profil.sources.texte')}</p>}
          </section>
        </div>
      </div>

      <section className={styles.bloc} aria-labelledby="profil-activite">
        <h2 id="profil-activite" className={`titre-section ${styles.titreDeSection}`}>
          {t('profil.activite.titre')}
        </h2>
        <Activite jeux={recents} />
      </section>
    </>
  );
}

function Chargement() {
  return (
    <div className={styles.chiffres} aria-hidden="true">
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className={styles.chiffre}>
          <Squelette hauteur="14px" largeur="120px" style={{ display: 'block', marginTop: 8 }} />
          <Squelette hauteur="30px" largeur="90px" style={{ display: 'block' }} />
        </div>
      ))}
    </div>
  );
}

export function EcranProfil() {
  const { t, te } = useTexte();
  const profil = useReponse(() => coeur.profil(), 'profil', null, 'profil');
  const jeux = useApplication((a) => a.jeux);
  const partielle = useApplication((a) => a.etat?.jeux_possedes_erreur ?? null);

  // Le compte suivi se choisit dans Paramètres > Steam : ici, un simple lien quand le PC en connaît plusieurs.
  // `comptes_steam` n'est pas une `Reponse` : une promesse simple, relue quand le profil change de compte.
  const [plusieursComptes, setPlusieursComptes] = useState(false);
  const steamid = profil.donnees?.steamid ?? null;
  useEffect(() => {
    let actif = true;
    coeur
      .comptes_steam()
      .then((liste) => {
        if (actif) setPlusieursComptes(liste.length > 1);
      })
      .catch(signaler);
    return () => {
      actif = false;
    };
  }, [steamid]);

  const pseudo = profil.donnees?.pseudo ?? null;
  const avatar = profil.donnees?.avatar ?? null;
  // Quand la bibliothèque est partielle, sa note dit déjà pourquoi (clé, profil privé) : pas deux notes pour la même cause.
  const erreurDeProfil: ErreurApp | null = partielle === null && aSignaler(profil.erreur, profil.donnees !== null) ? profil.erreur : null;

  return (
    <Page
      titre={t('coque.profil')}
      actions={
        steamid !== null && (
          <Bouton onClick={() => void tenter((c) => c.action_steam({ action: 'ouvrir_le_profil', steamid }))}>
            {t('profil.ouvrir_mon_profil')}
            <Icone nom="lien_externe" taille={16} />
          </Bouton>
        )
      }
    >
      {profil.vue === 'chargement' ? (
        <div className={styles.identite} role="status" aria-label={t('commun.chargement')}>
          <Squelette largeur="72px" hauteur="72px" rayon="50%" />
          <Squelette largeur="200px" hauteur="30px" />
        </div>
      ) : (
        <Identite pseudo={pseudo} avatar={avatar} steamid={steamid} plusieursComptes={plusieursComptes} />
      )}

      <div className={styles.notes}>
        {erreurDeProfil !== null && (
          <Note
            icone={iconeDErreur(erreurDeProfil)}
            action={
              vautUnNouvelEssai(erreurDeProfil) ? (
                <button type="button" className={classeActionDeNote} onClick={profil.reessayer}>
                  {t('commun.reessayer')}
                </button>
              ) : (
                // Le quota du jour ne se règle nulle part : la phrase suffit, sans bouton.
                SE_REGLE_DANS_STEAM.has(erreurDeProfil.code) && <LienVersLesReglages />
              )
            }
          >
            {t(profil.donnees === null ? 'profil.indisponible' : 'fiche.donnees_enregistrees', { raison: te(erreurDeProfil) })}
          </Note>
        )}
        {partielle !== null && jeux !== null && (
          <Note icone={iconeDErreur(partielle)} action={<LienVersLesReglages />}>
            {t('profil.partielle', { raison: te(partielle) })}
          </Note>
        )}
      </div>

      {jeux === null ? (
        <div role="status" aria-label={t('commun.chargement')}>
          <Chargement />
        </div>
      ) : (
        <Bibliotheque jeux={jeux} />
      )}
    </Page>
  );
}
