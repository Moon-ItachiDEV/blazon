import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { ErreurApp, JeuResume, Source } from '../../contrat/types';
import { Bouton, classeBouton } from '../composants/Bouton';
import { aSignaler, classeActionDeNote, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Icone, type NomDIcone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { NombreAnime } from '../composants/NombreAnime';
import { Page } from '../composants/Page';
import { suiviDeListe } from '../composants/pointeur';
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

/** Un niveau tous les 100 h de jeu : un repère de joueur tiré du temps de jeu réel, expliqué à l'écran. */
const MINUTES_PAR_NIVEAU = 100 * 60;

function niveauDe(minutes: number): { niveau: number; progression: number; reste: number } {
  const dansLeNiveau = minutes % MINUTES_PAR_NIVEAU;
  return { niveau: Math.floor(minutes / MINUTES_PAR_NIVEAU) + 1, progression: dansLeNiveau / MINUTES_PAR_NIVEAU, reste: MINUTES_PAR_NIVEAU - dansLeNiveau };
}

/** Couleur de chaque source dans l'anneau : des teintes du thème, jamais d'orange. */
const COULEUR_DE_SOURCE: Record<Source, string> = {
  steam: 'var(--accent-3)',
  epic: 'var(--accent-2)',
  gog: 'var(--cyan)',
  ea: 'var(--accent)',
  manuel: 'var(--succes)',
};

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

// ───────────────────────────── Carte de joueur

interface ProprietesCarte {
  pseudo: string | null;
  avatar: string | null;
  steamid: string | null;
  plusieursComptes: boolean;
  jeux: JeuResume[] | null;
}

/**
 * L'en-tête du profil, comme une carte de joueur esport : la bannière des jeux les plus joués qui défile
 * lentement, l'avatar dans un anneau néon, le pseudo, le niveau (tiré du temps de jeu) et la part de la
 * bibliothèque déjà explorée.
 */
function CarteDeJoueur({ pseudo, avatar, steamid, plusieursComptes, jeux }: ProprietesCarte) {
  const { t, langue } = useTexte();
  const banniere = useMemo(() => (jeux === null ? [] : plusJoues(jeux, 14).filter((jeu) => jeu.jaquette !== null)), [jeux]);
  const chiffres = useMemo(() => (jeux === null ? null : calculerLesChiffres(jeux)), [jeux]);
  const niveau = chiffres === null ? null : niveauDe(chiffres.minutes_total);
  const lances = chiffres === null ? 0 : chiffres.jeux - chiffres.jamais_lances;
  const exploree = chiffres === null || chiffres.jeux === 0 ? 0 : (lances / chiffres.jeux) * 100;

  return (
    <div className={styles.carteJoueur}>
      {banniere.length > 0 && (
        <div className={styles.banniere} aria-hidden="true">
          {/* La liste est écrite deux fois : quand la première moitié est sortie, la boucle repart sans saut. */}
          <div className={styles.defile} style={{ '--nombre': banniere.length } as CSSProperties}>
            {[...banniere, ...banniere].map((jeu, i) => (
              <span key={`${jeu.id}-${i}`} className={styles.affichette}>
                <img src={jeu.jaquette ?? undefined} alt="" loading="lazy" decoding="async" draggable={false} />
              </span>
            ))}
          </div>
        </div>
      )}
      <div className={styles.voileJoueur} aria-hidden="true" />

      <div className={styles.anneau}>
        <Avatar image={avatar} pseudo={pseudo} taille={132} />
      </div>

      <div className={styles.identite}>
        <div className={styles.pilules}>
          {steamid !== null && (
            <span className={styles.pilule}>
              <span className={styles.enLigne} aria-hidden="true" />
              {t('profil.compte_steam')}
            </span>
          )}
          {niveau !== null && <span className={`${styles.pilule} ${styles.piluleNiveau}`}>{t('profil.niveau', { n: formaterNombre(niveau.niveau, langue) })}</span>}
        </div>
        <p className={pseudo === null ? styles.pseudoAbsent : styles.pseudo}>{pseudo ?? t('profil.pseudo_inconnu')}</p>
        {niveau !== null && (
          <div className={styles.niveau}>
            <span className={styles.jauge} aria-hidden="true">
              <span className={styles.plein} style={{ '--part': niveau.progression } as CSSProperties} />
            </span>
            <span className={styles.niveauTexte}>{t('profil.niveau.explication', { temps: formaterTempsDeJeu(niveau.reste, langue) })}</span>
          </div>
        )}
        {plusieursComptes && (
          <Lien className={classeBouton({ variante: 'texte' }, styles.changer)} vers={{ ecran: 'parametres', section: 'steam' }}>
            {t('profil.changer_de_compte')}
          </Lien>
        )}
      </div>

      {chiffres !== null && chiffres.jeux > 0 && (
        <div className={styles.exploree}>
          <Cadran part={exploree} taille={128}>
            <span className={`${styles.cadranValeur} chiffres`}>
              <NombreAnime valeur={exploree} format={(v) => formaterPourcentage(v, langue)} />
            </span>
          </Cadran>
          <p className={styles.exploreeTitre}>{t('profil.exploree')}</p>
          <p className={styles.exploreeDetail}>{t('profil.exploree.detail', { lances: formaterNombre(lances, langue), total: formaterNombre(chiffres.jeux, langue) })}</p>
        </div>
      )}
    </div>
  );
}

/** Un cadran circulaire qui se remplit au dégradé. Décoratif : la valeur est écrite au centre. */
function Cadran({ part, taille, children }: { part: number; taille: number; children: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.cadran} style={{ width: taille, height: taille }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-d`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a3102f" />
            <stop offset="0.5" stopColor="#e3173f" />
            <stop offset="1" stopColor="#ff3f86" />
          </linearGradient>
        </defs>
        <circle className={styles.cadranPiste} cx="50" cy="50" r="44" />
        <circle className={styles.cadranPlein} cx="50" cy="50" r="44" pathLength={100} stroke={`url(#${id}-d)`} style={{ '--part': Math.max(0.5, part) } as CSSProperties} />
      </svg>
      <div className={styles.cadranCentre}>{children}</div>
    </div>
  );
}

// ───────────────────────────── Médailles

interface Medaille {
  cle: string;
  icone: NomDIcone;
  valeur: ReactNode;
  libelle: string;
}

/** Une médaille ronde : son cercle se trace, l'icône surgit, le chiffre compte. */
function MedailleHexagonale({ medaille, rang }: { medaille: Medaille; rang: number }) {
  const id = useId();
  return (
    <div className={styles.medaille} data-medaille="" style={{ '--rang': rang } as CSSProperties}>
      <span className={styles.hexagone} aria-hidden="true">
        <svg viewBox="0 0 100 112">
          <defs>
            <linearGradient id={`${id}-t`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a3102f" />
              <stop offset="0.5" stopColor="#e3173f" />
              <stop offset="1" stopColor="#ff3f86" />
            </linearGradient>
          </defs>
          <circle className={styles.hexFond} cx="50" cy="56" r="46" />
          <circle className={styles.hexTrait} cx="50" cy="56" r="46" pathLength={1} stroke={`url(#${id}-t)`} transform="rotate(-90 50 56)" />
          <circle className={styles.hexInterieur} cx="50" cy="56" r="36" />
        </svg>
        <span className={styles.hexIcone}>
          <Icone nom={medaille.icone} taille={26} />
        </span>
      </span>
      <dt className={styles.medailleLibelle}>{medaille.libelle}</dt>
      <dd className={`${styles.medailleValeur} chiffres`}>{medaille.valeur}</dd>
    </div>
  );
}

function Medailles({ chiffres }: { chiffres: Chiffres }) {
  const { t, tp, langue } = useTexte();
  const suivi = useMemo(() => suiviDeListe('[data-medaille]'), []);
  const part = formaterPourcentage(chiffres.part_jamais_lances, langue);
  const nombre = (valeur: number) => formaterNombre(valeur, langue);
  const temps = (minutes: number) => formaterTempsDeJeu(minutes, langue);
  const medailles: Medaille[] = [
    { cle: 'jeux', icone: 'grille', valeur: <NombreAnime valeur={chiffres.jeux} format={nombre} />, libelle: tp('profil.chiffre.jeux', chiffres.jeux) },
    { cle: 'installes', icone: 'telechargement', valeur: <NombreAnime valeur={chiffres.installes} format={nombre} />, libelle: tp('profil.chiffre.installes', chiffres.installes) },
    { cle: 'temps', icone: 'horloge', valeur: <NombreAnime valeur={chiffres.minutes_total} format={temps} />, libelle: t('profil.chiffre.temps') },
    ...(chiffres.minutes_2sem === null ? [] : [{ cle: '2sem', icone: 'manette' as const, valeur: <NombreAnime valeur={chiffres.minutes_2sem} format={temps} />, libelle: t('profil.chiffre.temps_2sem') }]),
    { cle: 'jamais', icone: 'oeil_barre', valeur: <NombreAnime valeur={chiffres.jamais_lances} format={nombre} />, libelle: tp('profil.chiffre.jamais_lances', chiffres.jamais_lances, { part }) },
    ...(chiffres.succes_debloques === null ? [] : [{ cle: 'succes', icone: 'trophee' as const, valeur: <NombreAnime valeur={chiffres.succes_debloques} format={nombre} />, libelle: tp('profil.chiffre.succes', chiffres.succes_debloques) }]),
    { cle: 'favoris', icone: 'etoile', valeur: <NombreAnime valeur={chiffres.favoris} format={nombre} />, libelle: tp('profil.chiffre.favoris', chiffres.favoris) },
    ...(chiffres.installes > 0 ? [{ cle: 'taille', icone: 'dossier' as const, valeur: formaterTaille(chiffres.taille_installee, langue), libelle: t('profil.chiffre.taille') }] : []),
  ];
  return (
    <dl className={styles.medailles} data-nombre={medailles.length} {...suivi}>
      {medailles.map((medaille, i) => (
        <MedailleHexagonale key={medaille.cle} medaille={medaille} rang={i} />
      ))}
    </dl>
  );
}

// ───────────────────────────── Les plus joués

function Podium({ jeux, total }: { jeux: JeuResume[]; total: number }) {
  const { t, langue } = useTexte();
  const premiers = jeux.slice(0, 3);
  const suivants = jeux.slice(3);
  const maximum = jeux[0]?.temps.minutes_total ?? 1;
  return (
    <>
      <ol className={styles.podium}>
        {premiers.map((jeu, index) => (
          <li key={jeu.id} className={styles.marche} data-rang={index + 1}>
            <Lien className={styles.lienPodium} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
              <span className={styles.couronne} aria-hidden="true">
                {index === 0 && <span className={styles.halo} />}
                <Jaquette jeu={jeu} prioritaire className={styles.jaquettePodium ?? ''} />
              </span>
              <span className={styles.titrePodium}>{jeu.titre}</span>
              <span className={`${styles.tempsPodium} chiffres`}>{formaterTempsDeJeu(jeu.temps.minutes_total, langue)}</span>
              <span className={styles.partPodium}>{t('profil.plus_joues.part', { part: formaterPourcentage(total === 0 ? 0 : (jeu.temps.minutes_total / total) * 100, langue) })}</span>
              <span className={styles.socle}>
                <span className={`${styles.numero} chiffres`}>
                  <span aria-hidden="true">{index + 1}</span>
                  <span className="hors-ecran">{t('profil.plus_joues.rang', { n: index + 1 })}</span>
                </span>
              </span>
            </Lien>
          </li>
        ))}
      </ol>
      {suivants.length > 0 && (
        <ol className={styles.barres} start={4}>
          {suivants.map((jeu, index) => (
            <li key={jeu.id} style={{ '--rang': index } as CSSProperties}>
              <Lien className={styles.ligneBarre} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
                <span className={`${styles.rangBarre} chiffres`}>
                  <span aria-hidden="true">{index + 4}</span>
                  <span className="hors-ecran">{t('profil.plus_joues.rang', { n: index + 4 })}</span>
                </span>
                <Jaquette jeu={jeu} className={styles.miniature ?? ''} />
                <span className={styles.barreCorps}>
                  <span className={styles.barreHaut}>
                    <span className={styles.titreDuJeu}>{jeu.titre}</span>
                    <span className={`${styles.temps} chiffres`}>{formaterTempsDeJeu(jeu.temps.minutes_total, langue)}</span>
                  </span>
                  <span className={styles.piste} aria-hidden="true">
                    <span className={styles.barre} style={{ width: `${Math.max(3, (jeu.temps.minutes_total / maximum) * 100)}%` }} />
                  </span>
                </span>
              </Lien>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// ───────────────────────────── Sources

function AnneauDesSources({ sources, jeux }: { sources: PartDeSource[]; jeux: number }) {
  const { t, tp, langue } = useTexte();
  const somme = sources.reduce((s, part) => s + part.jeux, 0);
  // Une petite source resterait invisible : chaque arc a au moins 2 % du tour, les plus grosses cèdent la différence.
  const minimum = 2;
  const brutes = sources.map((s) => (somme === 0 ? 0 : (s.jeux / somme) * 100));
  const petites = brutes.reduce((s, p) => s + Math.max(0, minimum - p), 0);
  const grosses = brutes.filter((p) => p >= minimum).reduce((s, p) => s + p, 0);
  const arcs = brutes.map((p) => (p < minimum ? minimum : p - (grosses === 0 ? 0 : (petites * p) / grosses)));
  const ecart = sources.length > 1 ? 1.2 : 0;
  let debut = 0;
  return (
    <div className={styles.sourcesCorps}>
      <div className={styles.anneauSources}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className={styles.cadranPiste} cx="60" cy="60" r="48" />
          {sources.map((s, i) => {
            const arc = arcs[i] ?? 0;
            const style = { '--part': Math.max(0.4, arc - ecart), '--debut': `${(debut / 100) * 360}deg`, '--rang': i, stroke: COULEUR_DE_SOURCE[s.source] } as CSSProperties;
            debut += arc;
            return <circle key={s.source} className={styles.arc} cx="60" cy="60" r="48" pathLength={100} style={style} />;
          })}
        </svg>
        <div className={styles.anneauCentre}>
          <span className={`${styles.anneauNombre} chiffres`}>
            <NombreAnime valeur={jeux} format={(v) => formaterNombre(v, langue)} />
          </span>
          <span className={styles.anneauLibelle}>{tp('profil.sources.total', jeux)}</span>
        </div>
      </div>
      <dl className={`cascade ${styles.legende}`}>
        {sources.map((s) => (
          <div key={s.source} className={styles.source} style={{ '--couleur-source': COULEUR_DE_SOURCE[s.source] } as CSSProperties}>
            <dt>
              <span className={styles.pastille} aria-hidden="true" />
              {t(`sources.${s.source}`)}
            </dt>
            <dd className="chiffres">
              {formaterNombre(s.jeux, langue)}
              <span className={styles.partSource}>{formaterPourcentage(jeux === 0 ? 0 : (s.jeux / jeux) * 100, langue)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ───────────────────────────── Activité récente

function Frise({ jeux }: { jeux: JeuResume[] }) {
  const { t, langue } = useTexte();
  const maintenant = useMaintenant();
  if (jeux.length === 0) return <p className={styles.discret}>{t('profil.activite.aucune')}</p>;
  return (
    <div className={styles.frise}>
      <span className={styles.fil} aria-hidden="true" />
      <ol className={styles.etapes}>
        {jeux.map((jeu, i) => (
          <li key={jeu.id} className={styles.etape} style={{ '--rang': i } as CSSProperties}>
            <Lien className={styles.lienEtape} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
              <Jaquette jeu={jeu} className={styles.jaquetteEtape ?? ''} />
              <span className={styles.jalon} aria-hidden="true" />
              <span className={styles.quand}>{jeu.temps.dernier_lancement === null ? '' : formaterDateHeure(jeu.temps.dernier_lancement, langue, maintenant)}</span>
              <span className={styles.titreEtape}>{jeu.titre}</span>
              <span className={styles.totalEtape}>{t('profil.activite.total', { temps: formaterTempsDeJeu(jeu.temps.minutes_total, langue) })}</span>
            </Lien>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ───────────────────────────── L'écran

function Bibliotheque({ jeux }: { jeux: JeuResume[] }) {
  const { t, tp, langue } = useTexte();
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
        <h2 id="profil-chiffres" className={`titre-section ${styles.titreDeSection}`}>
          {t('profil.chiffres.titre')}
        </h2>
        <Medailles chiffres={chiffres} />
        {masques > 0 && <p className={styles.discret}>{tp('profil.masques', masques)}</p>}
      </section>

      <div className={styles.colonnes}>
        <section className={`${styles.panneau} ${styles.principale}`} aria-labelledby="profil-plus-joues">
          <h2 id="profil-plus-joues" className={`titre-section ${styles.titreDeSection}`}>
            {t('profil.plus_joues')}
          </h2>
          {premiers.length === 0 ? <p className={styles.discret}>{t('profil.plus_joues.aucun')}</p> : <Podium jeux={premiers} total={chiffres.minutes_total} />}
        </section>

        <div className={styles.laterale}>
          <section className={styles.panneau} aria-labelledby="profil-sources">
            <h2 id="profil-sources" className={`titre-section ${styles.titreDeSection}`}>
              {t('profil.sources.titre')}
            </h2>
            <AnneauDesSources sources={sources} jeux={chiffres.jeux} />
            <p className={styles.discret}>{t('profil.sources.texte')}</p>
          </section>
          {chiffres.minutes_2sem !== null && (
            <section className={styles.panneau} aria-labelledby="profil-deux-semaines">
              <h2 id="profil-deux-semaines" className={`titre-section ${styles.titreDeSection}`}>
                {t('profil.deux_semaines.titre')}
              </h2>
              {recemment.length === 0 ? (
                <p className={styles.discret}>{t('profil.deux_semaines.aucun')}</p>
              ) : (
                <ol className={styles.barres}>
                  {recemment.map((jeu, index) => (
                    <li key={jeu.id} style={{ '--rang': index } as CSSProperties}>
                      <Lien className={styles.ligneBarre} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
                        <Jaquette jeu={jeu} className={styles.miniature ?? ''} />
                        <span className={styles.barreCorps}>
                          <span className={styles.barreHaut}>
                            <span className={styles.titreDuJeu}>{jeu.titre}</span>
                            <span className={`${styles.temps} chiffres`}>{formaterTempsDeJeu(jeu.temps.minutes_2sem ?? 0, langue)}</span>
                          </span>
                          <span className={styles.piste} aria-hidden="true">
                            <span className={styles.barre} style={{ width: `${Math.max(3, ((jeu.temps.minutes_2sem ?? 0) / (recemment[0]?.temps.minutes_2sem ?? 1)) * 100)}%` }} />
                          </span>
                        </span>
                      </Lien>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </div>

      <section className={styles.bloc} aria-labelledby="profil-activite">
        <h2 id="profil-activite" className={`titre-section ${styles.titreDeSection}`}>
          {t('profil.activite.titre')}
        </h2>
        <Frise jeux={recents} />
      </section>
    </>
  );
}

function Chargement() {
  return (
    <div className={styles.medailles} aria-hidden="true">
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className={styles.medaille}>
          <Squelette hauteur="72px" largeur="64px" style={{ display: 'block' }} />
          <Squelette hauteur="16px" largeur="100px" style={{ display: 'block', marginTop: 8 }} />
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
        <div className={styles.carteJoueur} role="status" aria-label={t('commun.chargement')}>
          <Squelette largeur="132px" hauteur="132px" rayon="50%" />
          <Squelette largeur="220px" hauteur="36px" />
        </div>
      ) : (
        <CarteDeJoueur pseudo={pseudo} avatar={avatar} steamid={steamid} plusieursComptes={plusieursComptes} jeux={jeux} />
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
