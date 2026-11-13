import { describe, expect, it } from 'vitest';
import type { Reponse } from '../../contrat/types';
import { erreur } from '../coeur/erreurs';
import { vueDe } from './ressource';

const reponse = <T,>(partie: Partial<Reponse<T>>): Reponse<T> => ({ donnees: null, fraicheur: null, rafraichissement: 'aucun', erreur: null, ...partie });

describe('les quatre états d’un écran', () => {
  it('chargement : pas encore de réponse, ou rien en cache et le réseau travaille', () => {
    expect(vueDe(null)).toBe('chargement');
    expect(vueDe(reponse({ rafraichissement: 'en_cours' }))).toBe('chargement');
  });

  it('erreur : rien à montrer et une raison', () => {
    expect(vueDe(reponse({ erreur: erreur('hors_ligne'), rafraichissement: 'echoue' }))).toBe('erreur');
  });

  it('vide : une liste sans élément, ou rien du tout sans erreur', () => {
    expect(vueDe(reponse<number[]>({ donnees: [] }))).toBe('vide');
    expect(vueDe(reponse({}))).toBe('vide');
  });

  it('données : dès qu’il y a quelque chose à montrer, même avec une erreur à côté', () => {
    expect(vueDe(reponse({ donnees: [1] }))).toBe('donnees');
    expect(vueDe(reponse({ donnees: { a: 1 }, erreur: erreur('hors_ligne') }))).toBe('donnees');
  });
});
