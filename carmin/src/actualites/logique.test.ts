import { describe, expect, it } from 'vitest';
import type { Actualite } from '../../contrat/types';
import { choisirLaUne, compterParJeu, filtrerActualites, filtrerParJeu, regrouperParJour } from './logique';

function annonce(id: string, date: string, type: Actualite['type'] = 'annonce'): Actualite {
  return { id, id_jeu: 1, steam_appid: 10, titre: id, resume: '', html_sur: '', langue: 'fr', type, date, url: 'https://exemple.test', image: null };
}
const ids = (liste: Actualite[]) => liste.map((a) => a.id);

describe('filtrerActualites', () => {
  const liste = [annonce('a', '2026-11-03T10:00:00Z', 'annonce'), annonce('m', '2026-11-02T10:00:00Z', 'mise_a_jour'), annonce('b', '2026-11-01T10:00:00Z', 'annonce')];

  it('garde tout avec « toutes », dans une copie', () => {
    const resultat = filtrerActualites(liste, 'toutes');
    expect(ids(resultat)).toEqual(['a', 'm', 'b']);
    expect(resultat).not.toBe(liste);
  });

  it('sépare les mises à jour des annonces sans changer l\'ordre', () => {
    expect(ids(filtrerActualites(liste, 'mises_a_jour'))).toEqual(['m']);
    expect(ids(filtrerActualites(liste, 'annonces'))).toEqual(['a', 'b']);
  });

  it('rend une liste vide quand rien ne correspond ou quand la liste est vide', () => {
    expect(filtrerActualites([annonce('a', '2026-11-03T10:00:00Z')], 'mises_a_jour')).toEqual([]);
    expect(filtrerActualites([], 'toutes')).toEqual([]);
  });
});

describe('regrouperParJour', () => {
  const PARIS = 'Europe/Paris';

  it('regroupe les annonces d\'un même jour, le plus récent d\'abord', () => {
    const groupes = regrouperParJour(
      [annonce('a', '2026-11-11T09:00:00Z'), annonce('b', '2026-11-11T07:00:00Z'), annonce('c', '2026-11-10T12:00:00Z')],
      PARIS,
    );
    expect(groupes.map((g) => g.jour)).toEqual(['2026-11-11', '2026-11-10']);
    expect(ids(groupes[0]?.annonces ?? [])).toEqual(['a', 'b']);
    expect(groupes[0]?.date).toBe('2026-11-11T09:00:00Z');
  });

  it('compte le jour dans le fuseau du joueur, pas en UTC', () => {
    // 23 h 30 UTC le 10 est déjà le 11 à Paris (UTC+1 en novembre) ; à Los Angeles c'est encore le 10.
    const liste = [annonce('tard', '2026-11-10T23:30:00Z'), annonce('midi', '2026-11-11T12:00:00Z')];
    expect(regrouperParJour(liste, PARIS)).toHaveLength(1);
    expect(regrouperParJour(liste, 'America/Los_Angeles').map((g) => g.jour)).toEqual(['2026-11-11', '2026-11-10']);
  });

  it('trie une liste arrivée dans le désordre, sans couper un groupe en deux', () => {
    const groupes = regrouperParJour([annonce('a', '2026-11-10T08:00:00Z'), annonce('b', '2026-11-11T08:00:00Z'), annonce('c', '2026-11-10T20:00:00Z')], PARIS);
    expect(groupes.map((g) => g.jour)).toEqual(['2026-11-11', '2026-11-10']);
    expect(ids(groupes[1]?.annonces ?? [])).toEqual(['c', 'a']);
  });

  it('rend une liste vide pour une liste vide et ne modifie pas l\'entrée', () => {
    expect(regrouperParJour([], PARIS)).toEqual([]);
    const entree = [annonce('a', '2026-11-10T08:00:00Z'), annonce('b', '2026-11-11T08:00:00Z')];
    regrouperParJour(entree, PARIS);
    expect(ids(entree)).toEqual(['a', 'b']);
  });

  it('sépare deux annonces du même jour de deux mois différents', () => {
    expect(regrouperParJour([annonce('a', '2026-11-10T12:00:00Z'), annonce('b', '2026-10-10T12:00:00Z')], PARIS)).toHaveLength(2);
  });
});

describe('par jeu et à la une', () => {
  const avec = (id: string, id_jeu: number, date: string, image: string | null = null): Actualite => ({ ...annonce(id, date), id_jeu, image });

  it('compte les nouvelles de chaque jeu, du plus bavard au plus discret', () => {
    const liste = [avec('a', 1, '2026-11-03T10:00:00Z'), avec('b', 2, '2026-11-04T10:00:00Z'), avec('c', 1, '2026-11-01T10:00:00Z'), avec('d', 3, '2026-11-02T10:00:00Z')];
    expect(compterParJeu(liste)).toEqual([
      { id_jeu: 1, nombre: 2, derniere: '2026-11-03T10:00:00Z' },
      { id_jeu: 2, nombre: 1, derniere: '2026-11-04T10:00:00Z' },
      { id_jeu: 3, nombre: 1, derniere: '2026-11-02T10:00:00Z' },
    ]);
    expect(compterParJeu([])).toEqual([]);
  });

  it('filtre sur un jeu, ou rend tout', () => {
    const liste = [avec('a', 1, '2026-11-03T10:00:00Z'), avec('b', 2, '2026-11-04T10:00:00Z')];
    expect(ids(filtrerParJeu(liste, 2))).toEqual(['b']);
    expect(ids(filtrerParJeu(liste, null))).toEqual(['a', 'b']);
  });

  it('met à la une la plus récente avec une image, sinon la plus récente', () => {
    expect(choisirLaUne([avec('a', 1, '2026-11-05T10:00:00Z'), avec('b', 1, '2026-11-04T10:00:00Z', 'x.jpg'), avec('c', 1, '2026-11-03T10:00:00Z', 'y.jpg')])?.id).toBe('b');
    expect(choisirLaUne([avec('a', 1, '2026-11-03T10:00:00Z'), avec('b', 1, '2026-11-05T10:00:00Z')])?.id).toBe('b');
    expect(choisirLaUne([])).toBeUndefined();
  });
});
