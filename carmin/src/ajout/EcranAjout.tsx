import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type DragEvent, type FormEvent } from 'react';
import type { JeuResume, Source } from '../../contrat/types';
import { Attente, Bouton, classeBouton } from '../composants/Bouton';
import { Note, Squelette } from '../composants/Etats';
import { Champ } from '../composants/Formulaire';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { Page } from '../composants/Page';
import { coeur, erreur, estErreurApp } from '../coeur';
import { cheminDuFichier } from '../coeur/electron';
import { useApplication } from '../etat/application';
import { useTexte } from '../i18n/react';
import { Lien, naviguer } from '../navigation';
import { couleurDeLApercu, ETAT_INITIAL, etapeDe, EXTENSIONS, evoluer, jeuDejaPresent, titreAEnvoyer, titreProvisoire } from './logique';
import styles from './EcranAjout.module.css';

/** Une action du cœur rejette avec une `ErreurApp` ; tout le reste devient l'erreur générique. */
function enErreurApp(cause: unknown) {
  return estErreurApp(cause) ? cause : erreur('interne');
}

const ETAPES = ['fichier', 'titre', 'ajout'] as const;

/** Les trois étapes de l'assistant : celle en cours en blanc, les faites cochées. */
function Etapes({ etape }: { etape: 0 | 1 | 2 }) {
  const { t } = useTexte();
  return (
    <ol className={styles.etapes} aria-label={t('ajout.etapes')}>
      {ETAPES.map((cle, index) => (
        <li key={cle} className={styles.etape} data-etat={index < etape ? 'faite' : index === etape ? 'active' : 'a_venir'} aria-current={index === etape ? 'step' : undefined}>
          <span className={styles.etapeRond} aria-hidden="true">
            {index < etape ? <Icone nom="coche" taille={14} /> : index + 1}
          </span>
          <span className={styles.etapeNom}>{t(`ajout.etape.${cle}`)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Les jaquettes qui encadrent le nouveau jeu sur l'étagère : des jeux récents de la bibliothèque. */
function voisins(jeux: readonly JeuResume[] | null): JeuResume[] {
  if (jeux === null) return [];
  const date = (jeu: JeuResume) => jeu.temps.dernier_lancement ?? '';
  return jeux
    .filter((jeu) => jeu.jaquette !== null && !jeu.masque && jeu.installe)
    .sort((a, b) => date(b).localeCompare(date(a)))
    .slice(0, 2);
}

/**
 * L'aperçu de la future jaquette, qui se remplit à mesure qu'on avance : un cadre vide, puis le titre
 * deviné du nom du fichier et la couleur tirée du titre, l'icône et la source une fois le fichier analysé.
 * Elle est posée entre deux vraies jaquettes de la bibliothèque. Rien n'y bouge tout seul.
 */
function Scene({ titre, source, icone }: { titre: string; source: Source | null; icone: string | null }) {
  const { t } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const autour = useMemo(() => voisins(jeux), [jeux]);
  const couleur = couleurDeLApercu(titre);
  const vignette = (jeu: JeuResume | undefined) =>
    jeu === undefined ? null : (
      <span key={jeu.id} className={styles.voisin}>
        <Jaquette jeu={jeu} />
      </span>
    );
  return (
    <aside className={styles.scene} aria-label={t('ajout.apercu')}>
      <p className={styles.sceneEtiquette}>{t('ajout.apercu.etagere')}</p>
      <div className={styles.etagere}>
        {vignette(autour[0])}
        <div className={styles.futur} data-titre={titre !== '' ? '' : undefined} style={{ '--couleur-futur': couleur ?? undefined } as CSSProperties} aria-hidden="true">
          {icone !== null && <img className={styles.futurIcone} src={icone} alt="" width={32} height={32} />}
          {titre !== '' ? (
            <span className={styles.futurTitre}>{titre}</span>
          ) : (
            <span className={styles.futurLignes}>
              <span />
              <span />
            </span>
          )}
          <span className={styles.futurSource}>{source !== null ? t(`sources.${source}`) : ''}</span>
        </div>
        {vignette(autour[1])}
      </div>
      <div className={styles.sceneLegende}>
        <p className={styles.sceneTitre}>{titre !== '' ? titre : t('ajout.apercu.vide')}</p>
        <p className={styles.sceneTexte}>{source !== null ? t(`sources.${source}`) : t('ajout.apercu.texte')}</p>
      </div>
    </aside>
  );
}

/**
 * Ajouter à la main un jeu qui ne vient d'aucun magasin (F-07) : on donne un fichier, le cœur
 * dit ce qu'il en comprend, le joueur corrige le titre et ajoute.
 *
 * Les erreurs restent sous le champ du chemin, pas seulement dans un message éphémère : c'est là
 * que le joueur corrige. C'est pourquoi l'analyse et l'ajout ne passent pas par `tenter`.
 */
export function EcranAjout() {
  const { t, te } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const [etat, envoyer] = useReducer(evoluer, ETAT_INITIAL);
  const [survol, setSurvol] = useState(false);
  const refDuTitre = useRef<HTMLHeadingElement>(null);
  const formulaireDuChemin = useRef<HTMLFormElement>(null);
  const { phase, chemin, analyse, probleme } = etat;
  const occupe = phase === 'analyse' || phase === 'ajout';

  // L'analyse part dès que l'état passe en « analyse ». Une réponse arrivée après un changement
  // de chemin est écartée deux fois : ici (`actif`) et dans `evoluer` (chemin comparé).
  useEffect(() => {
    if (phase !== 'analyse' || chemin === null) return;
    let actif = true;
    coeur.analyser_un_chemin(chemin).then(
      (resultat) => {
        if (actif) envoyer({ type: 'analyse_reussie', chemin, analyse: resultat });
      },
      (cause: unknown) => {
        if (actif) envoyer({ type: 'analyse_echouee', chemin, erreur: enErreurApp(cause) });
      },
    );
    return () => {
      actif = false;
    };
  }, [phase, chemin]);

  // Une nouvelle analyse apparaît plus bas : le focus y descend, pour qu'un lecteur d'écran l'annonce.
  // Seulement à l'arrivée d'une analyse : après un ajout refusé, il va au champ (effet suivant).
  useEffect(() => {
    if (analyse !== null) refDuTitre.current?.focus();
  }, [analyse]);

  // Toute erreur s'affiche sous le champ du chemin : le focus y va (une fois le champ réactivé),
  // et le message, relié au champ, est lu avec lui.
  useEffect(() => {
    if (probleme !== null) formulaireDuChemin.current?.querySelector('input')?.focus();
  }, [probleme]);

  const analyser = (evenement: FormEvent) => {
    evenement.preventDefault();
    envoyer({ type: 'analyser', saisie: etat.saisie });
  };

  const ajouter = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (phase !== 'apercu' || analyse === null || chemin === null || analyse.doublon_de !== null) return;
    envoyer({ type: 'ajouter' });
    try {
      const jeu = await coeur.ajouter_un_jeu_manuel(chemin, titreAEnvoyer(etat.titre, analyse));
      // `remplacer` : Retour depuis la fiche ramène là d'où l'on venait, pas à un formulaire déjà servi.
      naviguer({ ecran: 'jeu', id_jeu: jeu.id }, { remplacer: true });
    } catch (cause) {
      envoyer({ type: 'ajout_echoue', erreur: enErreurApp(cause) });
    }
  };

  // Le bouton disparaît avec l'aperçu : le focus revient au champ, prêt pour un autre chemin.
  const recommencer = () => {
    envoyer({ type: 'recommencer' });
    formulaireDuChemin.current?.querySelector('input')?.focus();
  };

  // ── Dépôt d'un fichier
  const survoler = (evenement: DragEvent<HTMLDivElement>) => {
    if (occupe) return;
    evenement.preventDefault();
    evenement.dataTransfer.dropEffect = 'copy';
    setSurvol(true);
  };
  const quitter = (evenement: DragEvent<HTMLDivElement>) => {
    // `dragleave` part aussi en passant sur un enfant de la zone : on ne réagit qu'en la quittant.
    if (!evenement.currentTarget.contains(evenement.relatedTarget as Node | null)) setSurvol(false);
  };
  const deposer = (evenement: DragEvent<HTMLDivElement>) => {
    evenement.preventDefault();
    setSurvol(false);
    if (occupe) return;
    // Dans un navigateur, un fichier déposé ne donne que son nom, jamais son chemin complet :
    // l'analyse le refusera (chemin_invalide), mais on garde le geste et le message. Dans Tauri 2,
    // le dépôt arrive par l'événement de glisser-déposer de la fenêtre, avec le chemin complet ;
    // il sera branché ici avec le cœur Rust. Un texte déposé (un chemin) est pris tel quel.
    const fichier = evenement.dataTransfer.files[0];
    const saisie = (fichier && cheminDuFichier(fichier)) ?? fichier?.name ?? evenement.dataTransfer.getData('text/plain');
    if (saisie !== '') envoyer({ type: 'analyser', saisie });
  };

  const texteDuProbleme = probleme === null ? null : probleme.type === 'extension' ? t('ajout.extension') : te(probleme.erreur);
  const dejaPresent = probleme?.type === 'coeur' ? jeuDejaPresent(probleme.erreur) : null;
  const doublon = analyse?.doublon_de ?? null;
  const titreDuDoublon = doublon === null ? undefined : jeux?.find((jeu) => jeu.id === doublon)?.titre;
  const etape = etapeDe(phase);
  // Ce que montre l'aperçu : le titre choisi une fois le fichier analysé, sinon celui que l'on devine du nom du fichier.
  const titreDeLApercu = analyse !== null ? titreAEnvoyer(etat.titre, analyse) : titreProvisoire(etat.saisie);

  return (
    <Page retour titre={t('bibliotheque.ajouter_un_jeu')} sousTitre={t('ajout.sous_titre')}>
      <Etapes etape={etape} />

      <div className={styles.atelier}>
        <div className={styles.colonne}>
          <div className={styles.depot} data-survol={survol} data-rempli={etat.saisie.trim() !== '' ? '' : undefined} data-compact={analyse !== null ? '' : undefined} onDragOver={survoler} onDragEnter={survoler} onDragLeave={quitter} onDrop={deposer}>
            <div className={styles.depotEntete}>
              <span className={styles.depotIcone} aria-hidden="true">
                <Icone nom="dossier" taille={22} />
              </span>
              <div>
                <p className={styles.depotTitre}>{survol ? t('ajout.depot_actif') : t('ajout.depot')}</p>
                <p className={styles.depotTexte}>{t('ajout.depot_texte')}</p>
              </div>
            </div>

            <form ref={formulaireDuChemin} className={styles.rangee} onSubmit={analyser} noValidate>
              <Champ
                nom={t('ajout.chemin')}
                aide={t('ajout.chemin_aide')}
                erreur={texteDuProbleme}
                value={etat.saisie}
                placeholder={t('ajout.chemin_exemple')}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                disabled={phase === 'ajout'}
                onChange={(evenement) => envoyer({ type: 'saisir', saisie: evenement.target.value })}
              />
              <Bouton type="submit" variante={phase === 'saisie' && etat.saisie.trim() !== '' ? 'principal' : 'discret'} className={styles.boutonAnalyser} disabled={occupe || etat.saisie.trim() === ''}>
                {phase === 'analyse' ? <Attente /> : <Icone nom="recherche" taille={18} />}
                {t('ajout.analyser')}
              </Bouton>
            </form>
            {dejaPresent !== null && (
              <Lien className={styles.lienTexte} vers={{ ecran: 'jeu', id_jeu: dejaPresent }}>
                {t('ajout.voir_la_fiche')}
                <Icone nom="chevron_droit" taille={16} />
              </Lien>
            )}
          </div>

          {phase === 'saisie' && (
            <section className={styles.section} aria-labelledby="ajout-types">
              <h2 id="ajout-types" className="titre-section">
                {t('ajout.types.titre')}
              </h2>
              <ul className={styles.types}>
                {EXTENSIONS.map((extension) => (
                  <li key={extension} className={styles.type}>
                    <span className={styles.extension}>.{extension}</span>
                    <span>{t(`ajout.types.${extension}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {phase === 'analyse' && (
            <div className={`${styles.section} ${styles.carte}`} role="status" aria-label={t('ajout.analyse_en_cours')}>
              <div className={styles.details}>
                <Squelette hauteur="22px" largeur="40%" />
                <Squelette hauteur="48px" rayon="var(--rayon-m)" />
                <Squelette hauteur="20px" largeur="70%" />
              </div>
            </div>
          )}

          {(phase === 'apercu' || phase === 'ajout') && analyse !== null && (
            <section className={`${styles.section} ${styles.carte}`} aria-labelledby="ajout-apercu">
              <h2 id="ajout-apercu" ref={refDuTitre} tabIndex={-1} className={`titre-section ${styles.focusDeTitre}`}>
                {t('ajout.apercu')}
              </h2>
              <form className={styles.details} onSubmit={(evenement) => void ajouter(evenement)}>
                {doublon === null ? (
                  <Champ
                    nom={t('ajout.titre')}
                    aide={t('ajout.titre_aide')}
                    value={etat.titre}
                    maxLength={120}
                    disabled={phase === 'ajout'}
                    onChange={(evenement) => envoyer({ type: 'renommer', titre: evenement.target.value })}
                  />
                ) : (
                  <p className={styles.titreDuJeu}>{analyse.titre_propose}</p>
                )}
                <dl className={styles.proprietes}>
                  <div className={styles.propriete}>
                    <dt>{t('ajout.cible')}</dt>
                    <dd className={styles.cible}>
                      {analyse.icone !== null && <img src={analyse.icone} alt="" width={20} height={20} />}
                      <span>{analyse.cible}</span>
                    </dd>
                  </div>
                  <div className={styles.propriete}>
                    <dt>{t('ajout.source')}</dt>
                    <dd>{t(`sources.${analyse.source}`)}</dd>
                  </div>
                </dl>

                {doublon !== null ? (
                  <>
                    <Note icone="alerte">{titreDuDoublon === undefined ? t('erreurs.deja_present') : t('ajout.doublon', { titre: titreDuDoublon })}</Note>
                    <div className={styles.actions}>
                      <Lien className={classeBouton({ variante: 'principal' })} vers={{ ecran: 'jeu', id_jeu: doublon }}>
                        {t('ajout.voir_la_fiche')}
                      </Lien>
                      <Bouton onClick={recommencer}>{t('ajout.autre_fichier')}</Bouton>
                    </div>
                  </>
                ) : (
                  <div className={styles.actions}>
                    <Bouton variante="principal" grand type="submit" disabled={phase === 'ajout'}>
                      {phase === 'ajout' ? <Attente /> : <Icone nom="plus" taille={20} />}
                      {phase === 'ajout' ? t('ajout.ajout_en_cours') : t('ajout.ajouter')}
                    </Bouton>
                    <Bouton disabled={phase === 'ajout'} onClick={recommencer}>
                      {t('ajout.autre_fichier')}
                    </Bouton>
                  </div>
                )}
              </form>
            </section>
          )}
        </div>

        <Scene titre={titreDeLApercu} source={analyse?.source ?? null} icone={analyse?.icone ?? null} />
      </div>
    </Page>
  );
}
