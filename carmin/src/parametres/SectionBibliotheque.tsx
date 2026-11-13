import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { Affichage as ReglagesDAffichage, EtatApp, JeuResume, Parametres } from '../../contrat/types';
import { Attente, Bouton, classeBouton } from '../composants/Bouton';
import { Squelette } from '../composants/Etats';
import { Champ, LigneDeReglage, ReglageOuiNon, Segments } from '../composants/Formulaire';
import { Icone } from '../composants/Icone';
import { Jaquette } from '../composants/Jaquette';
import { Carte, Section } from './Bloc';
import { coeur } from '../coeur';
import { application, definirMasque, modifierLAffichage, modifierLesParametres, tenter, useApplication } from '../etat/application';
import { useMaintenant } from '../etat/maintenant';
import { formaterDateHeure, formaterTempsDeJeu } from '../formats';
import { useTexte } from '../i18n/react';
import { Lien } from '../navigation';
import { Curseur } from './Curseur';
import { useFocusApresRetrait } from './focus';
import { etatDeLAnalyse, jeuxMasques, TAILLE_MAX, TAILLE_MIN, TAILLE_PAS, TEXTE_DE_REFUS, TRIS, validerDossier, type RaisonDeRefus } from './logique';
import styles from './Parametres.module.css';

function Dossiers({ dossiers }: { dossiers: string[] }) {
  const { t } = useTexte();
  const [saisie, setSaisie] = useState('');
  const [refus, setRefus] = useState<RaisonDeRefus | null>(null);
  const [annonce, setAnnonce] = useState('');
  const formulaire = useRef<HTMLFormElement>(null);
  // Plus aucun dossier : le focus va au champ d'ajout, la suite logique.
  const { liste, noterLeRetrait } = useFocusApresRetrait(dossiers.length, () => formulaire.current?.querySelector('input'));

  const ajouter = async (evenement: FormEvent) => {
    evenement.preventDefault();
    const verdict = validerDossier(saisie, dossiers);
    if (!verdict.ok) {
      setRefus(verdict.raison);
      setAnnonce('');
      return;
    }
    setRefus(null);
    setSaisie('');
    await modifierLesParametres((p) => ({ ...p, dossiers_a_scanner: [...p.dossiers_a_scanner, verdict.chemin] }));
    // `modifierLesParametres` ne dit pas si le cœur a accepté : on le lit dans l'état qu'il a laissé.
    if (application.lire().parametres?.dossiers_a_scanner.includes(verdict.chemin) === true) {
      setAnnonce(t('parametres.dossiers.ajoute', { chemin: verdict.chemin }));
    } else {
      setSaisie(verdict.chemin);
    }
  };

  const retirer = (chemin: string, indice: number) => {
    noterLeRetrait(indice);
    setAnnonce(t('parametres.dossiers.retire', { chemin }));
    void modifierLesParametres((p) => ({ ...p, dossiers_a_scanner: p.dossiers_a_scanner.filter((dossier) => dossier !== chemin) }));
  };

  return (
    <Section titre={t('parametres.dossiers.titre')} texte={t('parametres.dossiers.texte')}>
      <Carte>
        {dossiers.length === 0 ? (
          <p className={styles.vide}>{t('parametres.dossiers.aucun')}</p>
        ) : (
          <ul ref={liste}>
            {dossiers.map((dossier, indice) => (
              <li key={dossier} className={styles.rangee}>
                <span className={styles.rangeeIcone}>
                  <Icone nom="dossier" taille={18} />
                </span>
                <span className={styles.rangeeTexte}>{dossier}</span>
                <Bouton variante="texte" carre data-retrait aria-label={t('parametres.dossiers.retirer', { chemin: dossier })} onClick={() => retirer(dossier, indice)}>
                  <Icone nom="poubelle" taille={16} />
                </Bouton>
              </li>
            ))}
          </ul>
        )}
      </Carte>
      <form ref={formulaire} className={styles.ajoutDossier} onSubmit={(evenement) => void ajouter(evenement)} noValidate>
        <Champ
          nom={t('parametres.dossiers.champ')}
          aide={t('parametres.dossiers.aide')}
          erreur={refus === null ? null : t(TEXTE_DE_REFUS[refus])}
          value={saisie}
          spellCheck={false}
          autoComplete="off"
          placeholder="D:\…"
          onChange={(evenement) => {
            setSaisie(evenement.target.value);
            if (refus !== null) setRefus(null);
          }}
        />
        <Bouton type="submit">
          <Icone nom="plus" taille={16} />
          {t('parametres.dossiers.ajouter')}
        </Bouton>
      </form>
      <p className={`${styles.discret} ${styles.annonce}`} role="status">
        {annonce}
      </p>
    </Section>
  );
}

function Analyse({ etat }: { etat: EtatApp }) {
  const { t, tp, langue } = useTexte();
  const maintenant = useMaintenant();
  const progression = useApplication((a) => a.scan);
  const analyse = etatDeLAnalyse(etat.scan, progression);

  const resume = analyse.en_cours
    ? tp('parametres.analyse.en_cours', analyse.jeux_trouves)
    : analyse.dernier === null
      ? t('parametres.analyse.jamais')
      : tp('parametres.analyse.derniere', analyse.jeux_trouves, { quand: formaterDateHeure(analyse.dernier, langue, maintenant) });

  return (
    <Section titre={t('parametres.analyse.titre')}>
      <Carte>
        <LigneDeReglage
          nom={t('bibliotheque.vide.analyser')}
          aide={
            <span className="chiffres" role="status">
              {resume}
            </span>
          }
        >
          {/* `aria-disabled` plutôt que `disabled` : le bouton garde le focus clavier pendant l'analyse. */}
          <Bouton aria-disabled={analyse.en_cours} onClick={() => void (analyse.en_cours || tenter(() => coeur.relancer_le_scan()))}>
            {analyse.en_cours ? <Attente taille={16} /> : <Icone nom="rafraichir" taille={16} />}
            {analyse.en_cours ? t('parametres.analyse.en_cours_bouton') : t('parametres.analyse.relancer')}
          </Bouton>
        </LigneDeReglage>
        <LigneDeReglage nom={t('parametres.ajout_manuel.action')} aide={t('parametres.ajout_manuel')}>
          <Lien className={classeBouton()} vers={{ ecran: 'ajout' }}>
            <Icone nom="plus" taille={16} />
            {t('parametres.dossiers.ajouter')}
          </Lien>
        </LigneDeReglage>
      </Carte>
    </Section>
  );
}

/** Combien de jaquettes l'aperçu aligne : assez pour déborder à droite, même en petite taille. */
const JAQUETTES_D_APERCU = 12;

/** Les jeux les plus récemment lancés qui ont une image : ceux que le joueur reconnaîtra. */
function jeuxDApercu(jeux: readonly JeuResume[]): JeuResume[] {
  const date = (jeu: JeuResume) => jeu.temps.dernier_lancement ?? '';
  return jeux
    .filter((jeu) => jeu.jaquette !== null && !jeu.masque)
    .sort((a, b) => date(b).localeCompare(date(a)) || b.temps.minutes_total - a.temps.minutes_total)
    .slice(0, JAQUETTES_D_APERCU);
}

/**
 * L'aperçu de l'affichage : de vraies jaquettes de la bibliothèque, à la taille choisie (à moitié),
 * qui suivent le curseur pendant qu'on le glisse ; en vue liste, les mêmes jeux en lignes.
 */
function ApercuDAffichage({ taille, vue }: { taille: number; vue: ReglagesDAffichage['vue'] }) {
  const { langue } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const choisis = useMemo(() => (jeux === null ? [] : jeuxDApercu(jeux)), [jeux]);
  if (choisis.length === 0) return null;
  return (
    <div className={styles.apercuAffichage} data-vue={vue} style={{ '--t': `${taille}px` } as CSSProperties} aria-hidden="true">
      {vue === 'grille' ? (
        <ul className={styles.apercuGrille}>
          {choisis.map((jeu) => (
            <li key={jeu.id}>
              <Jaquette jeu={jeu} className={styles.apercuJaquette ?? ''} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.apercuListe}>
          {choisis.slice(0, 3).map((jeu) => (
            <li key={jeu.id}>
              <Jaquette jeu={jeu} className={styles.apercuMini ?? ''} />
              <span className={styles.apercuTitre}>{jeu.titre}</span>
              <span className={`${styles.apercuTemps} chiffres`}>{formaterTempsDeJeu(jeu.temps.minutes_total, langue)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Affichage({ parametres }: { parametres: Parametres }) {
  const { t } = useTexte();
  const idTaille = useId();
  const idTri = useId();
  const affichage = parametres.affichage;
  // La taille que montre l'aperçu : celle du curseur pendant le geste, puis celle enregistrée.
  const [taille, setTaille] = useState(affichage.taille_jaquettes);
  useEffect(() => setTaille(affichage.taille_jaquettes), [affichage.taille_jaquettes]);
  return (
    <Section titre={t('parametres.affichage.titre')} texte={t('parametres.affichage.texte')}>
      <Carte apercu={<ApercuDAffichage taille={taille} vue={affichage.vue} />}>
        <LigneDeReglage nom={t('parametres.vue')}>
          <Segments
            nom={t('parametres.vue')}
            valeur={affichage.vue}
            options={[
              { valeur: 'grille', libelle: t('parametres.vue.grille') },
              { valeur: 'liste', libelle: t('parametres.vue.liste') },
            ]}
            onChanger={(vue) => void modifierLAffichage({ vue })}
          />
        </LigneDeReglage>
        <LigneDeReglage nom={t('parametres.taille')} aide={t('parametres.taille.aide')} idDuNom={idTaille}>
          <Curseur
            nommePar={idTaille}
            min={TAILLE_MIN}
            max={TAILLE_MAX}
            pas={TAILLE_PAS}
            valeur={affichage.taille_jaquettes}
            formater={(n) => t('parametres.taille.valeur', { n })}
            onGlisser={setTaille}
            onValider={(taille_jaquettes) => void modifierLAffichage({ taille_jaquettes })}
          />
        </LigneDeReglage>
        <LigneDeReglage nom={t('parametres.tri')} idDuNom={idTri}>
          <select className={styles.choix} aria-labelledby={idTri} value={affichage.tri} onChange={(evenement) => void modifierLAffichage({ tri: TRIS.find((tri) => tri === evenement.target.value) ?? affichage.tri })}>
            {TRIS.map((tri) => (
              <option key={tri} value={tri}>
                {t(`tri.${tri}`)}
              </option>
            ))}
          </select>
        </LigneDeReglage>
        <LigneDeReglage nom={t('parametres.ordre')}>
          <Segments
            nom={t('parametres.ordre')}
            valeur={affichage.ordre}
            options={[
              { valeur: 'croissant', libelle: t('parametres.ordre.croissant') },
              { valeur: 'decroissant', libelle: t('parametres.ordre.decroissant') },
            ]}
            onChanger={(ordre) => void modifierLAffichage({ ordre })}
          />
        </LigneDeReglage>
      </Carte>
    </Section>
  );
}

function JeuxMasques({ montrer }: { montrer: boolean }) {
  const { t, tp } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const masques = useMemo(() => (jeux === null ? null : jeuxMasques(jeux)), [jeux]);
  const [annonce, setAnnonce] = useState('');
  const titreDeLaListe = useRef<HTMLHeadingElement>(null);
  const { liste, noterLeRetrait } = useFocusApresRetrait(masques?.length ?? 0, () => titreDeLaListe.current);

  return (
    <Section titre={t('parametres.masques.titre')}>
      <div className={styles.pile}>
        <Carte>
          <ReglageOuiNon
            nom={t('parametres.masques.montrer')}
            aide={t('parametres.masques.montrer.aide')}
            actif={montrer}
            onChanger={(actif) => void modifierLAffichage({ montrer_les_jeux_masques: actif })}
          />
        </Carte>
        {masques === null ? (
          <div role="status" aria-label={t('commun.chargement')}>
            <Squelette hauteur="60px" rayon="var(--rayon-l)" style={{ display: 'block' }} />
          </div>
        ) : (
          <>
            <h3 className={styles.sousTitre} ref={titreDeLaListe} tabIndex={-1}>
              {tp('parametres.masques.nombre', masques.length)}
            </h3>
            <Carte>
              {masques.length === 0 ? (
                <p className={styles.vide}>{t('parametres.masques.aucun')}</p>
              ) : (
                <ul ref={liste}>
                  {masques.map((jeu, indice) => (
                    <li key={jeu.id} className={styles.rangee}>
                      <Jaquette jeu={jeu} className={styles.vignette ?? ''} />
                      <Lien className={styles.rangeeTexte} vers={{ ecran: 'jeu', id_jeu: jeu.id }}>
                        {jeu.titre}
                      </Lien>
                      <Bouton
                        data-retrait
                        aria-label={t('parametres.masques.ne_plus_masquer', { titre: jeu.titre })}
                        onClick={() => {
                          noterLeRetrait(indice);
                          setAnnonce(t('parametres.masques.reaffiche', { titre: jeu.titre }));
                          void definirMasque(jeu.id, false);
                        }}
                      >
                        <Icone nom="oeil" taille={16} />
                        {t('fiche.ne_plus_masquer')}
                      </Bouton>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </>
        )}
        <p className="hors-ecran" role="status">
          {annonce}
        </p>
      </div>
    </Section>
  );
}

export function SectionBibliotheque({ etat, parametres }: { etat: EtatApp; parametres: Parametres }) {
  return (
    <>
      <Dossiers dossiers={parametres.dossiers_a_scanner} />
      <Analyse etat={etat} />
      <Affichage parametres={parametres} />
      <JeuxMasques montrer={parametres.affichage.montrer_les_jeux_masques} />
    </>
  );
}
