import type { JeuResume, Source } from '../../contrat/types';
import { coeur } from '../coeur';
import { lancerLeJeu, tenter, useApplication } from '../etat/application';
import { useTexte } from '../i18n/react';
import { Attente, Bouton } from './Bouton';
import { Icone } from './Icone';

export type EtatDeLancement = 'pret' | 'lancement' | 'en_jeu' | 'occupe';

/**
 * Où en est ce jeu : prêt à être lancé, en cours de lancement, en train de tourner,
 * ou bloqué parce qu'un autre jeu tourne déjà.
 */
export function useEtatDeLancement(id_jeu: number): EtatDeLancement {
  const lancement = useApplication((a) => a.lancement);
  const session = useApplication((a) => a.etat?.session_en_cours?.id_jeu ?? null);
  if (session === id_jeu) return 'en_jeu';
  if (lancement === id_jeu) return 'lancement';
  return session !== null || lancement !== null ? 'occupe' : 'pret';
}

interface Proprietes {
  jeu: Pick<JeuResume, 'id' | 'installe' | 'steam_appid' | 'sources'>;
  /** Source choisie par le joueur quand le jeu existe chez plusieurs magasins. null = le cœur choisit. */
  source?: Source | null;
  grand?: boolean;
}

/** L'action principale d'un jeu : Jouer s'il est installé, Installer s'il vient de Steam. */
export function BoutonJouer({ jeu, source = null, grand = false }: Proprietes) {
  const { t } = useTexte();
  const etat = useEtatDeLancement(jeu.id);
  const taille = grand ? 22 : 18;

  if (!jeu.installe) {
    const appid = jeu.steam_appid;
    if (appid === null) {
      return (
        <Bouton variante="voile" grand={grand} disabled>
          {t('jeu.non_installe')}
        </Bouton>
      );
    }
    return (
      <Bouton variante="principal" grand={grand} onClick={() => void tenter(() => coeur.action_steam({ action: 'installer', steam_appid: appid }))}>
        <Icone nom="telechargement" taille={taille} />
        {t('jeu.installer')}
      </Bouton>
    );
  }

  if (etat === 'en_jeu') {
    return (
      <Bouton variante="principal" grand={grand} disabled>
        <Icone nom="manette" taille={taille} />
        {t('jeu.en_jeu')}
      </Bouton>
    );
  }
  if (etat === 'lancement') {
    return (
      <Bouton variante="principal" grand={grand} disabled>
        <Attente taille={taille} />
        {t('jeu.lancement')}
      </Bouton>
    );
  }
  return (
    <Bouton variante="principal" grand={grand} disabled={etat === 'occupe'} onClick={() => void lancerLeJeu(jeu.id, source)}>
      <Icone nom="jouer" taille={taille} />
      {t('jeu.jouer')}
    </Bouton>
  );
}
