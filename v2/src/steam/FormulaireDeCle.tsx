import { useState, type FormEvent } from 'react';
import type { ResultatTestCle } from '../../contrat/types';
import { Attente, Bouton } from '../composants/Bouton';
import { Champ } from '../composants/Formulaire';
import { Icone } from '../composants/Icone';
import { coeur } from '../coeur';
import { signaler, tenter } from '../etat/application';
import { useTexte } from '../i18n/react';
import styles from './FormulaireDeCle.module.css';

/** Page officielle où Steam délivre une clé à un compte. */
const ADRESSE_DE_LA_CLE = 'https://steamcommunity.com/dev/apikey';

/** Une clé Steam : 32 caractères hexadécimaux. On le vérifie ici pour répondre sans appel inutile. */
export function formeDeCleValide(cle: string): boolean {
  return /^[0-9A-Fa-f]{32}$/.test(cle.trim());
}

/**
 * Saisie de la clé Steam du joueur. Sert dans les paramètres et à l'accueil du premier lancement.
 *
 * Règles de sécurité tenues ici :
 *  - la clé ne vit que dans ce champ, le temps de la saisie ; elle est effacée dès l'envoi au cœur ;
 *  - elle n'est jamais écrite dans un journal, une adresse, le magasin d'état ou le stockage du navigateur ;
 *  - le champ est masqué et le navigateur n'a pas le droit de la mémoriser ;
 *  - une fois enregistrée, l'interface ne peut plus la relire : le cœur ne renvoie que son état.
 */
export function FormulaireDeCle({ onResultat }: { onResultat?: (resultat: ResultatTestCle) => void }) {
  const { t, te } = useTexte();
  const [cle, setCle] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [forme, setForme] = useState(false);
  const [resultat, setResultat] = useState<ResultatTestCle | null>(null);

  const envoyer = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (envoi) return;
    setResultat(null);
    if (!formeDeCleValide(cle)) {
      setForme(true);
      return;
    }
    setForme(false);
    setEnvoi(true);
    const saisie = cle.trim();
    // Effacée de l'écran et de la mémoire du composant avant même la réponse.
    setCle('');
    try {
      const verdict = await coeur.enregistrer_la_cle(saisie);
      setResultat(verdict);
      onResultat?.(verdict);
    } catch (cause) {
      signaler(cause);
    } finally {
      setEnvoi(false);
    }
  };

  const erreurAffichee = forme ? t('cle.forme_invalide') : resultat?.etat === 'refusee' ? (resultat.erreur === null ? t('erreurs.cle_refusee') : te(resultat.erreur)) : null;

  return (
    <form className={styles.formulaire} onSubmit={(evenement) => void envoyer(evenement)} autoComplete="off">
      <div className={styles.rangee}>
        <Champ
          nom={t('cle.champ')}
          type="password"
          name="cle-steam"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          maxLength={64}
          placeholder={t('cle.exemple')}
          value={cle}
          disabled={envoi}
          erreur={erreurAffichee}
          onChange={(evenement) => {
            setCle(evenement.target.value);
            if (forme) setForme(false);
          }}
        />
        <Bouton variante="principal" type="submit" disabled={envoi || cle.trim() === ''} style={{ marginBottom: erreurAffichee === null ? 0 : 26 }}>
          {envoi && <Attente />}
          {envoi ? t('cle.verification') : t('cle.enregistrer')}
        </Bouton>
      </div>
      <div aria-live="polite">
        {resultat?.etat === 'valide' && (
          <p className={`${styles.verdict} ${styles.accepte}`}>
            <Icone nom="coche" taille={18} />
            <span>{resultat.pseudo === null ? t('cle.acceptee') : t('cle.acceptee_pour', { pseudo: resultat.pseudo })}</span>
          </p>
        )}
        {resultat?.etat === 'non_verifiee' && (
          <p className={`${styles.verdict} ${styles.attente}`}>
            <Icone nom="horloge" taille={18} />
            <span>{t('cle.non_verifiee')}</span>
          </p>
        )}
      </div>
      <button type="button" className={styles.lien} onClick={() => void tenter(() => coeur.ouvrir_un_lien(ADRESSE_DE_LA_CLE))}>
        {t('cle.ou_la_trouver')}
        <Icone nom="lien_externe" taille={16} />
      </button>
    </form>
  );
}
