import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompteSteam, ErreurApp, EtatApp } from '../../contrat/types';
import { Attente, Bouton } from '../composants/Bouton';
import { Dialogue } from '../composants/Dialogue';
import { classeActionDeNote, iconeDErreur, Note, Squelette } from '../composants/Etats';
import { Icone } from '../composants/Icone';
import { Carte, Section } from './Bloc';
import { coeur } from '../coeur';
import { erreur, estErreurApp } from '../coeur/erreurs';
import { tenter } from '../etat/application';
import { useTexte } from '../i18n/react';
import { FormulaireDeCle } from '../steam/FormulaireDeCle';
import { BlocDEtat } from './BlocDEtat';
import { etatDeLaCle, explicationDesJeuxPossedes } from './logique';
import styles from './Parametres.module.css';

/** Les comptes Steam du PC : une simple promesse, sans enveloppe `Reponse` ni rafraîchissement. */
function useComptes() {
  const [comptes, setComptes] = useState<CompteSteam[] | null>(null);
  const [echec, setEchec] = useState<ErreurApp | null>(null);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let actif = true;
    setEchec(null);
    coeur.comptes_steam().then(
      (liste) => actif && setComptes(liste),
      (cause: unknown) => actif && setEchec(estErreurApp(cause) ? cause : erreur('interne')),
    );
    return () => {
      actif = false;
    };
  }, [essai]);

  /** Coche tout de suite le compte choisi ; si le cœur refuse, on revient en arrière (le message vient de `tenter`). */
  const choisir = useCallback(
    async (steamid: string) => {
      const avant = comptes;
      setComptes((liste) => liste?.map((compte) => ({ ...compte, actif: compte.steamid === steamid })) ?? liste);
      if (!(await tenter(() => coeur.choisir_le_compte(steamid)))) setComptes(avant);
    },
    [comptes],
  );

  return { comptes, echec, choisir, reessayer: () => setEssai((n) => n + 1) };
}

function ComptesSteam({ comptes, echec, choisir, reessayer }: ReturnType<typeof useComptes>) {
  const { t, te } = useTexte();
  if (echec !== null) {
    return (
      <Note
        icone={iconeDErreur(echec)}
        action={
          <button type="button" className={classeActionDeNote} onClick={reessayer}>
            {t('commun.reessayer')}
          </button>
        }
      >
        {te(echec)}
      </Note>
    );
  }
  if (comptes === null) {
    return (
      <div role="status" aria-label={t('commun.chargement')}>
        <Squelette hauteur="60px" rayon="var(--rayon-l)" style={{ display: 'block' }} />
      </div>
    );
  }
  if (comptes.length === 0) return <p className={styles.texte}>{t('parametres.comptes.aucun')}</p>;
  const [seul] = comptes;
  if (comptes.length === 1 && seul !== undefined) return <p className={styles.texte}>{t('parametres.comptes.seul', { pseudo: seul.pseudo })}</p>;
  return (
    <div className={styles.pile}>
      <p className={styles.texte}>{t('parametres.comptes.texte')}</p>
      <Carte>
        <fieldset className={styles.comptes}>
          <legend className="hors-ecran">{t('parametres.comptes.titre')}</legend>
          {comptes.map((compte) => (
            <label key={compte.steamid} className={styles.compte}>
              <input type="radio" name="compte-steam" value={compte.steamid} checked={compte.actif} onChange={() => void choisir(compte.steamid)} />
              <span>{compte.pseudo}</span>
            </label>
          ))}
        </fieldset>
      </Carte>
    </div>
  );
}

export function SectionSteam({ etat }: { etat: EtatApp }) {
  const { t, te } = useTexte();
  const comptes = useComptes();
  const [confirmer, setConfirmer] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const titreDeLaCle = useRef<HTMLHeadingElement>(null);
  const refocaliser = useRef(false);

  const explication = explicationDesJeuxPossedes(etat.jeux_possedes_erreur);
  const cle = etatDeLaCle(etat.cle, etat.en_ligne, explication === 'profil_prive');
  const compteActif = comptes.comptes?.find((compte) => compte.actif) ?? null;

  // Le bouton « Supprimer la clé » disparaît avec la clé : le focus revient sur l'état de la clé.
  useEffect(() => {
    if (refocaliser.current && !confirmer && etat.cle === 'absente') {
      refocaliser.current = false;
      titreDeLaCle.current?.focus();
    }
  }, [confirmer, etat.cle]);

  const supprimer = async () => {
    setSuppression(true);
    const ok = await tenter(() => coeur.supprimer_la_cle());
    setSuppression(false);
    if (ok) {
      refocaliser.current = true;
      setConfirmer(false);
    }
  };

  return (
    <>
      {!etat.steam_installe && (
        <Section titre={t('sources.steam')}>
          <BlocDEtat icone="alerte" ton="alerte" titre={t('parametres.steam_absent.titre')} texte={t('parametres.steam_absent.texte')} />
        </Section>
      )}

      <Section titre={t('parametres.cle.titre')} texte={t('parametres.cle.apport')}>
        <div className={styles.pile}>
          <div aria-live="polite">
            <BlocDEtat icone={cle.icone} ton={cle.ton} titre={t(cle.titre)} texte={t(cle.texte)} refDuTitre={titreDeLaCle} />
          </div>

          {explication === 'profil_prive' && (
            <BlocDEtat icone="cadenas" ton="alerte" titre={t('parametres.profil_prive.titre')} texte={t('parametres.profil_prive.texte')}>
              <ol className={styles.etapes}>
                <li>{t('parametres.profil_prive.etape1')}</li>
                <li>{t('parametres.profil_prive.etape2')}</li>
                <li>{t('parametres.profil_prive.etape3')}</li>
              </ol>
              {compteActif !== null && etat.steam_installe && (
                <div className={styles.actions}>
                  <Bouton onClick={() => void tenter(() => coeur.action_steam({ action: 'ouvrir_le_profil', steamid: compteActif.steamid }))}>
                    {t('parametres.profil_prive.ouvrir')}
                    <Icone nom="lien_externe" taille={16} />
                  </Bouton>
                </div>
              )}
            </BlocDEtat>
          )}
          {explication === 'autre' && etat.jeux_possedes_erreur !== null && (
            <Note icone={iconeDErreur(etat.jeux_possedes_erreur)}>{t('parametres.jeux_possedes.autre', { raison: te(etat.jeux_possedes_erreur) })}</Note>
          )}

        </div>
      </Section>

      <Section titre={etat.cle === 'absente' ? t('parametres.cle.ajouter') : t('parametres.cle.remplacer')}>
        <div className={styles.pile}>
          {!etat.en_ligne && <Note icone="hors_ligne">{t('parametres.cle.hors_ligne')}</Note>}
          <Carte>
            <div className={styles.formulaireDeCle}>
              <FormulaireDeCle />
            </div>
          </Carte>
          <p className={styles.garantie}>
            <Icone nom="cadenas" taille={14} />
            <span>{t('parametres.cle.garantie')}</span>
          </p>
          {etat.cle !== 'absente' && (
            <div className={styles.actions}>
              <Bouton variante="danger" onClick={() => setConfirmer(true)}>
                <Icone nom="poubelle" taille={16} />
                {t('parametres.cle.supprimer')}
              </Bouton>
            </div>
          )}
        </div>
      </Section>

      {etat.steam_installe && (
        <Section titre={t('parametres.comptes.titre')}>
          <ComptesSteam {...comptes} />
        </Section>
      )}

      <Dialogue
        ouvert={confirmer}
        onFermer={() => setConfirmer(false)}
        titre={t('parametres.cle.supprimer.titre')}
        pied={
          <>
            <Bouton onClick={() => setConfirmer(false)}>{t('commun.annuler')}</Bouton>
            <Bouton variante="danger" aria-disabled={suppression} onClick={() => void (suppression || supprimer())}>
              {suppression && <Attente taille={16} />}
              {t('parametres.cle.supprimer')}
            </Bouton>
          </>
        }
      >
        <p>{t('parametres.cle.supprimer.texte')}</p>
        <ul className={styles.puces}>
          <li>{t('parametres.cle.supprimer.jeux')}</li>
          <li>{t('parametres.cle.supprimer.succes')}</li>
          <li>{t('parametres.cle.supprimer.amis')}</li>
        </ul>
        <p className={styles.discret}>{t('parametres.cle.supprimer.reste')}</p>
      </Dialogue>
    </>
  );
}
