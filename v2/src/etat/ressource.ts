/**
 * Lecture d'une donnée en ligne (fiche, succès, amis, actualités, profil).
 *
 * Le cœur répond tout de suite avec ce qu'il a en cache, puis annonce la suite par l'événement
 * `donnees_rafraichies` : ce crochet relit alors la donnée. L'écran n'attend jamais le réseau,
 * et il sait toujours lequel des quatre états dessiner grâce à `vue`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Domaine, ErreurApp, Reponse } from '../../contrat/types';
import { coeur } from '../coeur';
import { erreur, estErreurApp } from '../coeur/erreurs';
import { ecouterLesRafraichissements, signaler } from './application';

/** Les quatre états d'un écran (§16), plus rien : chaque écran doit savoir dessiner les quatre. */
export type Vue = 'chargement' | 'erreur' | 'vide' | 'donnees';

export interface Ressource<T> {
  vue: Vue;
  donnees: T | null;
  /** Avec des données : à signaler discrètement. Sans données : c'est l'écran d'erreur. */
  erreur: ErreurApp | null;
  /** Vrai pendant un aller-retour réseau, que des données soient déjà affichées ou non. */
  en_cours: boolean;
  reessayer: () => void;
}

function estVide(donnees: unknown): boolean {
  return Array.isArray(donnees) && donnees.length === 0;
}

export function vueDe<T>(reponse: Reponse<T> | null): Vue {
  if (reponse === null) return 'chargement';
  if (reponse.donnees !== null) return estVide(reponse.donnees) ? 'vide' : 'donnees';
  if (reponse.erreur !== null) return 'erreur';
  return reponse.rafraichissement === 'en_cours' ? 'chargement' : 'vide';
}

/**
 * @param lire      appel au cœur, par exemple `() => coeur.succes_du_jeu(49)`
 * @param domaine   domaine dont les rafraîchissements concernent cette donnée
 * @param id_jeu    jeu concerné, ou null pour une donnée globale (amis, profil, fil d'actualités)
 * @param cle       change quand la donnée demandée change (identifiant du jeu, limite…)
 */
export function useReponse<T>(lire: () => Promise<Reponse<T>>, domaine: Domaine, id_jeu: number | null, cle: string): Ressource<T> {
  const [reponse, setReponse] = useState<Reponse<T> | null>(null);
  const [fatale, setFatale] = useState<ErreurApp | null>(null);
  // `lire` est recréée à chaque rendu par l'écran : on garde la dernière sans relancer l'effet.
  const lireActuel = useRef(lire);
  lireActuel.current = lire;

  useEffect(() => {
    let actif = true;
    setReponse(null);
    setFatale(null);
    const relire = () => {
      lireActuel
        .current()
        .then((r) => {
          if (actif) setReponse(r);
        })
        .catch((cause: unknown) => {
          // Une lecture ne rejette que pour `introuvable` et `interne` (règle 5 du contrat).
          if (actif) setFatale(estErreurApp(cause) ? cause : erreur('interne'));
        });
    };
    relire();
    const arreter = ecouterLesRafraichissements(domaine, (id) => {
      if (id === id_jeu) relire();
    });
    return () => {
      actif = false;
      arreter();
    };
  }, [domaine, id_jeu, cle]);

  const reessayer = useCallback(() => {
    // Le cœur relance la demande et ré-annonce le résultat : on relit tout de suite pour afficher « en cours ».
    coeur
      .rafraichir(domaine, id_jeu)
      .then(() => lireActuel.current())
      .then(setReponse)
      .catch(signaler);
  }, [domaine, id_jeu]);

  if (fatale !== null) return { vue: 'erreur', donnees: null, erreur: fatale, en_cours: false, reessayer };
  return {
    vue: vueDe(reponse),
    donnees: reponse?.donnees ?? null,
    erreur: reponse?.erreur ?? null,
    en_cours: reponse === null || reponse.rafraichissement === 'en_cours',
    reessayer,
  };
}
