import { useEffect, useMemo, useRef, useState } from 'react';
import type { Langue, ResultatTestCle } from '../../contrat/types';
import { Attente, Bouton } from '../composants/Bouton';
import { Marque } from '../composants/Marque';
import { Decor } from '../coque/Decor';
import { Note } from '../composants/Etats';
import { Segments } from '../composants/Formulaire';
import { Icone, type NomDIcone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { coeur } from '../coeur';
import { modifierLesParametres, tenter, useApplication } from '../etat/application';
import { formaterNombre } from '../formats';
import { traduire, type CleDeTexte } from '../i18n';
import { useTexte } from '../i18n/react';
import { ACCUEIL, naviguer } from '../navigation';
import { FormulaireDeCle } from '../steam/FormulaireDeCle';
import {
  actionSuivante,
  cleAuRecapitulatif,
  dernieresJaquettes,
  ETAPES,
  etapePrecedente,
  etapeSuivante,
  fautIlAnnoncer,
  lireLeScan,
  numeroDEtape,
  statutsDesSources,
  type Annonce,
  type CleAuRecapitulatif,
  type Etape,
  type LectureDuScan,
  type Progression,
  type StatutDeSource,
} from './logique';
import styles from './PremierLancement.module.css';

const TITRES: Record<Etape, CleDeTexte> = {
  bienvenue: 'accueil.bienvenue.titre',
  analyse: 'accueil.analyse.titre',
  cle: 'accueil.cle.titre',
  fin: 'accueil.fin.titre',
};

/** Nombre de jaquettes montrées pendant le scan : une rangée, pour que l'étape tienne sans défiler. */
const JAQUETTES = 8;

/**
 * Le scan vu par l'accueil. La dernière progression reçue est gardée : elle couvre le court
 * instant entre la fin du scan et la relecture de l'état (voir `lireLeScan`).
 */
function useScan(): LectureDuScan {
  const direct = useApplication((a) => a.scan);
  const scan = useApplication((a) => a.etat?.scan ?? null);
  const [dernierVu, setDernierVu] = useState<Progression | null>(null);
  useEffect(() => {
    if (direct !== null) setDernierVu(direct);
  }, [direct]);
  // Un nouveau scan terminé remet la mémoire à zéro, pour qu'un scan relancé reparte de rien.
  useEffect(() => {
    if (scan !== null && !scan.en_cours) setDernierVu(null);
  }, [scan]);
  return lireLeScan(scan, direct, dernierVu);
}

// ───────────────────────────── Étape 1 : bienvenue ─────────────────────────────

function EtapeBienvenue({ scan }: { scan: LectureDuScan }) {
  const { t, langue } = useTexte();
  // Chaque langue est écrite dans sa propre langue : on la reconnaît même sans lire l'autre.
  const options: { valeur: Langue; libelle: string }[] = [
    { valeur: 'fr', libelle: traduire('fr', 'langue.fr') },
    { valeur: 'en', libelle: traduire('en', 'langue.en') },
  ];
  return (
    <>
      <p className={styles.chapeau}>{t('accueil.bienvenue.texte', { nom: t('app.nom') })}</p>
      <div className={styles.bloc}>
        <p className={styles.nomDeReglage} aria-hidden="true">
          {t('accueil.bienvenue.langue')}
        </p>
        <Segments nom={t('accueil.bienvenue.langue')} valeur={langue} options={options} onChanger={(choix) => void modifierLesParametres((p) => ({ ...p, langue: choix }))} />
        <p className={styles.aide}>{t('accueil.bienvenue.langue_aide')}</p>
      </div>
      {scan.phase !== 'termine' && (
        <p className={styles.ligneDiscrete}>
          <Attente taille={16} />
          {t('accueil.bienvenue.analyse')}
        </p>
      )}
    </>
  );
}

// ───────────────────────────── Étape 2 : analyse du PC ─────────────────────────────

const ICONES_DE_STATUT: Partial<Record<StatutDeSource, NomDIcone>> = { fini: 'coche', absent: 'fermer' };

/** Annonce de temps en temps où en est le scan, sans lire chaque jeu trouvé. */
function useAnnonceDuScan(scan: LectureDuScan): string {
  const { t, tp } = useTexte();
  const [annonce, setAnnonce] = useState('');
  const precedente = useRef<Annonce | null>(null);
  useEffect(() => {
    const maintenant = Date.now();
    if (!fautIlAnnoncer(precedente.current, scan, maintenant)) return;
    precedente.current = { phase: scan.phase, source: scan.source, instant_ms: maintenant };
    if (scan.phase === 'termine') setAnnonce(tp('accueil.analyse.annonce_fin', scan.jeux_trouves));
    else if (scan.source === null) setAnnonce(t('accueil.analyse.demarrage'));
    else setAnnonce(tp('accueil.analyse.annonce', scan.jeux_trouves, { source: t(`sources.${scan.source}`) }));
  }, [scan, t, tp]);
  return annonce;
}

function EtapeAnalyse({ scan, steamInstalle }: { scan: LectureDuScan; steamInstalle: boolean }) {
  const { t, tp, langue } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const jaquettes = useMemo(() => dernieresJaquettes(jeux, JAQUETTES), [jeux]);
  const annonce = useAnnonceDuScan(scan);
  const statuts = statutsDesSources(scan, steamInstalle);
  const aucun = scan.phase === 'termine' && scan.jeux_trouves === 0;

  const ligneDEtat =
    scan.phase === 'termine' ? t('accueil.analyse.termine') : scan.source === null ? t('accueil.analyse.demarrage') : t('accueil.analyse.en_cours', { source: t(`sources.${scan.source}`) });

  return (
    <>
      <p className={styles.chapeau}>{t('accueil.analyse.texte', { nom: t('app.nom') })}</p>
      {!steamInstalle && (
        <div className={styles.bloc}>
          <Note icone="info">{t('accueil.analyse.sans_steam')}</Note>
        </div>
      )}

      <div className={styles.compteur}>
        <span className={`${styles.nombre} chiffres`}>{formaterNombre(scan.jeux_trouves, langue)}</span>
        <span className={styles.nombreLibelle}>{tp('accueil.analyse.trouves', scan.jeux_trouves)}</span>
      </div>
      <p className={styles.ligneDEtat}>
        {scan.phase === 'termine' ? <Icone nom="coche" taille={18} /> : <Attente taille={18} />}
        {ligneDEtat}
      </p>

      <ul className={styles.sources} aria-label={t('accueil.analyse.sources')}>
        {statuts.map(({ source, statut }) => {
          const icone = ICONES_DE_STATUT[statut];
          return (
            <li key={source} className={styles.source} data-statut={statut}>
              <span className={styles.sourcePastille} aria-hidden="true">
                {statut === 'en_cours' ? <Attente taille={16} /> : icone !== undefined ? <Icone nom={icone} taille={16} /> : null}
              </span>
              <span className={styles.sourceNom}>{t(`sources.${source}`)}</span>
              <span className={styles.sourceStatut}>{t(`accueil.analyse.statut.${statut}`)}</span>
            </li>
          );
        })}
      </ul>

      {aucun ? (
        // Le compteur dit déjà « 0 » : un encadré court suffit, sans grand message qui pousserait la suite hors de l'écran.
        <div className={styles.aucun}>
          <h2 className="titre-section">{t('accueil.analyse.aucun.titre')}</h2>
          <p>{t('accueil.analyse.aucun.texte')}</p>
        </div>
      ) : (
        <ul className={styles.mosaique} aria-label={t('accueil.analyse.derniers')}>
          {jaquettes.map((jeu) => (
            <li key={jeu.id} className={styles.vignette}>
              <Jaquette jeu={jeu} prioritaire />
              <span className="hors-ecran">{jeu.titre}</span>
            </li>
          ))}
          {/* Places encore vides : la rangée se remplit sous les yeux du joueur au lieu de sauter. */}
          {Array.from({ length: Math.max(0, JAQUETTES - jaquettes.length) }, (_, index) => (
            <li key={`vide-${index}`} className={styles.place} aria-hidden="true" />
          ))}
        </ul>
      )}

      {scan.phase !== 'termine' && <p className={styles.aide}>{t('accueil.analyse.arriere_plan')}</p>}
      <div className="hors-ecran" role="status" aria-live="polite">
        {annonce}
      </div>
    </>
  );
}

// ───────────────────────────── Étape 3 : clé Steam ─────────────────────────────

interface ProprietesDeCle {
  cle: CleAuRecapitulatif;
  verdict: ResultatTestCle | null;
  enLigne: boolean;
  formulaireVisible: boolean;
  onVerdict: (verdict: ResultatTestCle) => void;
  onChanger: () => void;
}

function EtapeCle({ cle, verdict, enLigne, formulaireVisible, onVerdict, onChanger }: ProprietesDeCle) {
  const { t } = useTexte();
  const confirmation = useRef<HTMLHeadingElement>(null);
  const formulaire = useRef<HTMLDivElement>(null);
  /**
   * Après un verdict, le bouton qui avait le focus disparaît ou vient d'être désactivé. Le focus va
   * sur la confirmation si la clé est prise, sinon dans le champ, relié au message d'erreur.
   * Un compteur plutôt qu'un booléen : deux refus de suite doivent replacer le focus deux fois.
   */
  const [demandesDeFocus, setDemandesDeFocus] = useState(0);
  useEffect(() => {
    if (demandesDeFocus === 0) return;
    if (formulaireVisible) formulaire.current?.querySelector('input')?.focus();
    else confirmation.current?.focus();
  }, [demandesDeFocus, formulaireVisible]);

  return (
    <>
      <p className={styles.chapeau}>{t('accueil.cle.texte', { nom: t('app.nom') })}</p>
      <dl className={styles.niveaux}>
        <div className={styles.niveau}>
          <dt className="titre-section">{t('accueil.cle.sans')}</dt>
          <dd>{t('accueil.cle.sans_texte')}</dd>
        </div>
        <div className={`${styles.niveau} ${styles.niveauAvec}`}>
          <dt className="titre-section">{t('accueil.cle.avec')}</dt>
          <dd>{t('accueil.cle.avec_texte')}</dd>
        </div>
      </dl>
      <p className={styles.ligneDiscrete}>
        <Icone nom="cadenas" taille={18} />
        {t('accueil.cle.locale')}
      </p>

      {formulaireVisible ? (
        <div ref={formulaire} className={styles.formulaire}>
          {!enLigne && (
            <div className={styles.bloc}>
              <Note icone="hors_ligne">{t('accueil.cle.hors_ligne')}</Note>
            </div>
          )}
          <FormulaireDeCle
            onResultat={(resultat) => {
              setDemandesDeFocus((n) => n + 1);
              onVerdict(resultat);
            }}
          />
          {verdict?.etat === 'refusee' && <p className={styles.aide}>{t('accueil.cle.refusee')}</p>}
        </div>
      ) : (
        <div className={styles.verdict} data-etat={cle.etat}>
          <span className={styles.verdictPastille} aria-hidden="true">
            <Icone nom={cle.etat === 'valide' ? 'coche' : 'horloge'} taille={22} />
          </span>
          <div className={styles.verdictCorps}>
            <h2 ref={confirmation} tabIndex={-1} className={`titre-section ${styles.focusDeTitre}`}>
              {cle.etat === 'valide' ? t('accueil.cle.acceptee') : t('accueil.cle.non_verifiee')}
            </h2>
            {cle.etat === 'valide' ? (
              <p>
                {cle.pseudo !== null && <strong className={styles.pseudo}>{t('accueil.cle.acceptee_pour', { pseudo: cle.pseudo })} </strong>}
                {t('accueil.cle.acceptee_texte')}
              </p>
            ) : (
              <p>{t('cle.non_verifiee')}</p>
            )}
            <button
              type="button"
              className={styles.lienTexte}
              onClick={() => {
                // Le bouton disparaît avec la confirmation : le focus passe au champ de la clé.
                setDemandesDeFocus((n) => n + 1);
                onChanger();
              }}
            >
              {t('accueil.cle.changer')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ───────────────────────────── Étape 4 : terminer ─────────────────────────────

function EtapeFin({ scan, cle }: { scan: LectureDuScan; cle: CleAuRecapitulatif }) {
  const { t, tp, langue } = useTexte();
  const jeux =
    scan.phase !== 'termine'
      ? tp('accueil.fin.jeux_en_cours', scan.jeux_trouves)
      : scan.jeux_trouves === 0
        ? t('accueil.fin.aucun_jeu')
        : tp('accueil.fin.jeux', scan.jeux_trouves);
  const texteDeCle =
    cle.etat === 'valide'
      ? cle.pseudo === null
        ? t('accueil.fin.cle_valide')
        : t('accueil.fin.cle_valide_pour', { pseudo: cle.pseudo })
      : cle.etat === 'non_verifiee'
        ? t('accueil.fin.cle_non_verifiee')
        : t('accueil.fin.sans_cle');
  const lignes: { icone: NomDIcone; texte: string; bonne: boolean }[] = [
    { icone: 'grille', texte: jeux, bonne: scan.phase === 'termine' && scan.jeux_trouves > 0 },
    { icone: 'cle', texte: texteDeCle, bonne: cle.etat === 'valide' },
    { icone: 'reglages', texte: t('accueil.fin.langue', { langue: traduire(langue, `langue.${langue}`) }), bonne: true },
  ];
  return (
    <>
      <p className={styles.chapeau}>{t('accueil.fin.texte', { nom: t('app.nom') })}</p>
      <ul className={styles.recapitulatif} aria-label={t('accueil.fin.recapitulatif')}>
        {lignes.map((ligne) => (
          <li key={ligne.icone} className={styles.ligneDeRecap} data-bonne={ligne.bonne}>
            <span className={styles.recapPastille} aria-hidden="true">
              <Icone nom={ligne.icone} taille={20} />
            </span>
            <span>{ligne.texte}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ───────────────────────────── L'accueil ─────────────────────────────

const LIBELLES_D_ACTION = {
  commencer: 'accueil.commencer',
  continuer: 'accueil.continuer',
  plus_tard: 'accueil.plus_tard',
  continuer_sans_cle: 'accueil.continuer_sans_cle',
  ouvrir: 'accueil.ouvrir',
} as const satisfies Record<string, CleDeTexte>;

/**
 * L'accueil de la première ouverture, en plein écran : quatre étapes, toutes passables.
 * Le scan du PC a démarré tout seul ; on le montre en direct, sans jamais obliger à l'attendre.
 * Terminer prévient le cœur, qui passe `premier_lancement` à faux : l'application affiche alors
 * la bibliothèque d'elle-même.
 */
export function PremierLancement() {
  const { t } = useTexte();
  const etat = useApplication((a) => a.etat);
  const scan = useScan();
  const [etape, setEtape] = useState<Etape>('bienvenue');
  const [verdict, setVerdict] = useState<ResultatTestCle | null>(null);
  const [changerDeCle, setChangerDeCle] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const titre = useRef<HTMLHeadingElement>(null);

  // À chaque étape, le focus part du titre : un lecteur d'écran le lit, Tab mène au contenu.
  useEffect(() => {
    titre.current?.focus();
  }, [etape]);

  const cle = cleAuRecapitulatif(verdict, etat?.cle ?? 'absente');
  const formulaireVisible = cle.etat === 'sans' || changerDeCle;
  const suite = actionSuivante(etape, cle, verdict, formulaireVisible);
  const precedente = etapePrecedente(etape);
  const numero = numeroDEtape(etape);

  const aller = (cible: Etape) => {
    window.scrollTo(0, 0);
    setEtape(cible);
  };

  const terminer = async () => {
    if (envoi) return;
    setEnvoi(true);
    // L'accueil a pu s'ouvrir sur une autre adresse : on arrive toujours sur la bibliothèque.
    naviguer(ACCUEIL, { remplacer: true });
    // En cas de réussite, l'accueil disparaît : il n'y a rien à remettre en place.
    if (!(await tenter(() => coeur.terminer_premier_lancement()))) setEnvoi(false);
  };

  const avancer = () => {
    const suivante = etapeSuivante(etape);
    if (suivante === null) void terminer();
    else aller(suivante);
  };

  return (
    <div className={styles.accueil}>
      <Decor />
      <header className={styles.entete}>
        <div className={styles.rail}>
          <Marque />
          <div className={styles.progression}>
            <p className={`${styles.compteDEtapes} chiffres`}>{t('accueil.etape_sur', { n: numero, total: ETAPES.length })}</p>
            <ol className={styles.pas} aria-label={t('accueil.progression')}>
              {ETAPES.map((e, index) => {
                const position = index + 1 < numero ? 'fait' : index + 1 === numero ? 'courant' : 'a_venir';
                return (
                  <li key={e} className={styles.unPas} data-position={position} aria-current={position === 'courant' ? 'step' : undefined}>
                    <span className={styles.barre} aria-hidden="true" />
                    <span className={styles.nomDuPas}>
                      {t(`accueil.etape.${e}`)}
                      {position === 'fait' && <span className="hors-ecran">, {t('accueil.etape_finie')}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </header>

      <main className={styles.corps}>
        {/* `key` : chaque étape repart de zéro et rejoue son entrée (durée nulle sans animations). */}
        <section key={etape} className={`${styles.rail} ${styles.etape}`} aria-labelledby="accueil-titre">
          <h1 id="accueil-titre" ref={titre} tabIndex={-1} className={`${styles.titre} ${styles.focusDeTitre}`}>
            {t(TITRES[etape], { nom: t('app.nom') })}
          </h1>
          {etape === 'bienvenue' && <EtapeBienvenue scan={scan} />}
          {etape === 'analyse' && <EtapeAnalyse scan={scan} steamInstalle={etat?.steam_installe ?? true} />}
          {etape === 'cle' && (
            <EtapeCle
              cle={cle}
              verdict={verdict}
              enLigne={etat?.en_ligne ?? true}
              formulaireVisible={formulaireVisible}
              onVerdict={(resultat) => {
                setVerdict(resultat);
                if (resultat.etat !== 'refusee') setChangerDeCle(false);
              }}
              onChanger={() => {
                setVerdict(null);
                setChangerDeCle(true);
              }}
            />
          )}
          {etape === 'fin' && <EtapeFin scan={scan} cle={cle} />}
        </section>
      </main>

      <footer className={styles.pied}>
        <div className={`${styles.rail} ${styles.piedRail}`}>
          {precedente !== null ? (
            <Bouton onClick={() => aller(precedente)} disabled={envoi}>
              <Icone nom="retour" taille={18} />
              {t('commun.retour')}
            </Bouton>
          ) : (
            <span />
          )}
          <Bouton variante={suite.principale ? 'principal' : 'discret'} onClick={avancer} disabled={envoi}>
            {envoi && <Attente />}
            {t(LIBELLES_D_ACTION[suite.action])}
            {!envoi && suite.action !== 'ouvrir' && <Icone nom="chevron_droit" taille={18} />}
          </Bouton>
        </div>
      </footer>
    </div>
  );
}
