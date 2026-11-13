import { useEffect, useMemo, useRef, useState } from 'react';
import type { JeuResume } from '../../contrat/types';
import type { Actualite } from '../../contrat/types';
import { Attente, Bouton, classeBouton } from '../composants/Bouton';
import { aSignaler, classeActionDeNote, ErreurPleine, iconeDErreur, Message, Note, Squelette } from '../composants/Etats';
import { Segments } from '../composants/Formulaire';
import { Icone } from '../composants/Icone';
import { Page } from '../composants/Page';
import { coeur } from '../coeur';
import { vautUnNouvelEssai } from '../coeur/erreurs';
import { useApplication } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { useReponse } from '../etat/ressource';
import { formaterDateRelative } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { suiviDeListe } from '../composants/pointeur';
import { LecteurDActualite } from './Lecteur';
import { choisirLaUne, compterParJeu, FILTRES_ACTUALITES, filtrerActualites, filtrerParJeu, regrouperParJour, type FiltreActualites } from './logique';
import { CarteMagazine, formatDeCarte, RubanParJeu } from './Magazine';
import { CoteDeLaUne, Une } from './Une';
import styles from './EcranActualites.module.css';

const TAILLE_DE_PAGE = 20;

/**
 * Pagination : on redemande les `limite` plus récentes (avec `avant` à null) en augmentant la limite
 * de 20 à chaque clic, plutôt que de chaîner des pages par date. Le cœur répond depuis son cache et
 * la liste reste ordonnée d'elle-même : pas de doublon à fusionner, pas de page manquante si une
 * annonce arrive pendant la lecture. Contrepartie : le contenu des pages déjà vues est relu.
 */
export function EcranActualites() {
  const { t, te, langue } = useTexte();
  const maintenant = useMaintenant();
  const jeux = useApplication((a) => a.jeux);
  const [limite, setLimite] = useState(TAILLE_DE_PAGE);
  const [filtre, setFiltre] = useState<FiltreActualites>('toutes');
  const [ouverte, setOuverte] = useState<Actualite | null>(null);
  // Limite avec laquelle les données affichées ont été lues : `limite` change un rendu avant leur remplacement.
  const limiteLue = useRef(TAILLE_DE_PAGE);
  const fil = useReponse(
    () =>
      coeur.fil_d_actualites(limite, null).then((reponse) => {
        limiteLue.current = limite;
        return reponse;
      }),
    'actualites',
    null,
    `fil:${limite}`,
  );

  // Changer de limite remet la lecture à zéro : on garde la liste déjà vue pour que l'écran ne clignote pas.
  const derniere = useRef<Actualite[]>([]);
  if (fil.donnees !== null) derniere.current = fil.donnees;
  const enChargementDeSuite = fil.donnees === null && fil.en_cours && limite > TAILLE_DE_PAGE;
  const annonces = fil.donnees ?? (limite > TAILLE_DE_PAGE ? derniere.current : null);

  const [jeuChoisi, setJeuChoisi] = useState<number | null>(null);
  const parId = useMemo(() => new Map<number, JeuResume>((jeux ?? []).map((j) => [j.id, j])), [jeux]);
  const jeuDe = (id_jeu: number): JeuResume | undefined => parId.get(id_jeu);
  const titreDe = (id_jeu: number): { jeu?: string } => {
    const titre = parId.get(id_jeu)?.titre;
    return titre === undefined ? {} : { jeu: titre };
  };
  const ruban = useMemo(() => compterParJeu(annonces ?? []).filter((n) => parId.has(n.id_jeu)), [annonces, parId]);
  const visibles = useMemo(() => filtrerActualites(filtrerParJeu(annonces ?? [], jeuChoisi), filtre), [annonces, filtre, jeuChoisi]);
  // La une sort du fil : elle n'y apparaît pas deux fois. Les trois suivantes l'accompagnent sur le côté.
  const une = useMemo(() => choisirLaUne(visibles), [visibles]);
  const reste = useMemo(() => visibles.filter((a) => a !== une), [visibles, une]);
  const groupes = useMemo(() => regrouperParJour(reste), [reste]);
  // Place de chaque annonce dans le fil entier : elle décide du format de sa carte (une grande de temps en temps).
  const rangs = useMemo(() => new Map(groupes.flatMap((g) => g.annonces).map((a, i) => [a.id, i] as const)), [groupes]);
  const suivi = useMemo(() => suiviDeListe('[data-carte]'), []);

  // Il y a une suite si la dernière page était pleine : une page courte est la fin du fil.
  const finDuFil = fil.donnees !== null && fil.donnees.length < limiteLue.current;
  const peutAfficherPlus = annonces !== null && annonces.length > 0 && !finDuFil && (fil.donnees !== null || enChargementDeSuite);

  // Le bouton disparaît à la fin du fil : le focus clavier passe alors à la phrase de fin.
  const fin = useRef<HTMLParagraphElement>(null);
  const aDemandeLaSuite = useRef(false);
  useEffect(() => {
    if (finDuFil && aDemandeLaSuite.current) {
      aDemandeLaSuite.current = false;
      fin.current?.focus();
    }
  }, [finDuFil]);

  const afficherPlus = () => {
    if (enChargementDeSuite) return;
    aDemandeLaSuite.current = true;
    setLimite((actuelle) => actuelle + TAILLE_DE_PAGE);
  };

  const erreur = fil.erreur;
  const reglages = erreur !== null && (erreur.code === 'source_coupee' || erreur.code === 'source_desactivee');
  const lienReglages = (
    <Lien className={classeBouton({})} vers={{ ecran: 'parametres', section: 'donnees' }}>
      {t('actualites.reglages_donnees')}
    </Lien>
  );

  return (
    <Page titre={t('coque.actualites')} sousTitre={t('actualites.perimetre')}>
      {fil.vue === 'chargement' && annonces === null && (
        <div className={styles.squelettes} role="status" aria-label={t('commun.chargement')}>
          <Squelette hauteur="440px" rayon="var(--rayon-xl)" />
          {Array.from({ length: 3 }, (_, i) => (
            <Squelette key={i} hauteur="104px" rayon="var(--rayon-l)" />
          ))}
        </div>
      )}

      {fil.vue === 'erreur' && erreur !== null && <ErreurPleine erreur={erreur} reessayer={fil.reessayer} {...(reglages ? { actions: lienReglages } : {})} />}

      {fil.vue === 'vide' && annonces !== null && annonces.length === 0 && <Message icone="journal" titre={t('actualites.vide')} texte={t('actualites.vide_texte')} />}

      {annonces !== null && annonces.length > 0 && (
        <>
          {aSignaler(erreur, true) && (
            <div className={styles.note}>
              <Note
                icone={iconeDErreur(erreur)}
                action={
                  <>
                    {vautUnNouvelEssai(erreur) && (
                      <button type="button" className={classeActionDeNote} onClick={fil.reessayer}>
                        {t('commun.reessayer')}
                      </button>
                    )}
                    {reglages && (
                      <Lien className={classeActionDeNote} vers={{ ecran: 'parametres', section: 'donnees' }}>
                        {t('actualites.reglages_donnees')}
                      </Lien>
                    )}
                  </>
                }
              >
                {t('actualites.donnees_enregistrees', { raison: te(erreur) })}
              </Note>
            </div>
          )}

          {une !== undefined && (
            <div className={styles.tete}>
              <Une key={une.id} actualite={une} jeu={jeuDe(une.id_jeu)} onOuvrir={setOuverte} />
              <CoteDeLaUne annonces={filtrerParJeu(annonces, jeuChoisi)} aussi={reste.slice(0, 3)} jeuDe={jeuDe} onOuvrir={setOuverte} />
            </div>
          )}

          {ruban.length > 1 && <RubanParJeu jeux={ruban} jeuDe={jeuDe} choisi={jeuChoisi} onChoisir={setJeuChoisi} />}

          <div className={styles.outils}>
            <h2 className="titre-section">{t('actualites.le_fil')}</h2>
            <Segments
              nom={t('actualites.filtres')}
              valeur={filtre}
              onChanger={setFiltre}
              options={FILTRES_ACTUALITES.map((valeur) => ({ valeur, libelle: t(`actualites.filtre.${valeur}`) }))}
            />
            {jeuChoisi !== null && (
              <button type="button" className={styles.puce} onClick={() => setJeuChoisi(null)} aria-label={t('actualites.par_jeu.retirer')}>
                {jeuDe(jeuChoisi)?.titre}
                <Icone nom="fermer" taille={14} />
              </button>
            )}
          </div>

          {visibles.length === 0 && <p className={styles.vide}>{t('actualites.filtre_vide')}</p>}
          {/* Une seule grille pour tout le fil : pas de trou en fin de journée. La première carte de chaque jour porte son intitulé. */}
          <ul className={styles.grille} {...suivi}>
            {groupes.flatMap((groupe, numero) =>
              groupe.annonces.map((annonce, i) => (
                <CarteMagazine
                  key={annonce.id}
                  actualite={annonce}
                  jeu={jeuDe(annonce.id_jeu)}
                  format={formatDeCarte(annonce, rangs.get(annonce.id) ?? 1)}
                  rang={Math.min(numero * 2 + i, 14)}
                  {...(i === 0 ? { jour: formaterDateRelative(groupe.date, langue, maintenant) } : {})}
                  onOuvrir={setOuverte}
                />
              )),
            )}
          </ul>

          {peutAfficherPlus && (
            <div className={styles.suite}>
              {/* aria-disabled plutôt que disabled : pendant le chargement le bouton garde le focus clavier. */}
              <Bouton aria-disabled={enChargementDeSuite} onClick={afficherPlus}>
                {enChargementDeSuite && <Attente />}
                {t('actualites.afficher_plus')}
              </Bouton>
            </div>
          )}
          {finDuFil && limite > TAILLE_DE_PAGE && (
            <p ref={fin} className={styles.fin} tabIndex={-1}>
              {t('actualites.fin')}
            </p>
          )}
        </>
      )}

      <LecteurDActualite actualite={ouverte} {...(ouverte === null ? {} : titreDe(ouverte.id_jeu))} onFermer={() => setOuverte(null)} />
    </Page>
  );
}
