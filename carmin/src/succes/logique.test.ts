import { describe, expect, it } from 'vitest';
import type { Succes } from '../../contrat/types';
import { apercu, estCache, filtrerSucces, ordonner, rarete, vitrine } from './logique';

function succes(nom: string, reste: Partial<Succes> = {}): Succes {
  return { api_name: nom, nom, description: `Description de ${nom}`, secret: false, icone: '', icone_grise: '', pct_mondial: 50, debloque: false, debloque_le: null, ...reste };
}
const noms = (liste: Succes[]) => liste.map((s) => s.nom);

describe('ordonner', () => {
  it('met les débloqués d\'abord, du plus récent au plus ancien', () => {
    const liste = [
      succes('ancien', { debloque: true, debloque_le: '2026-01-01T10:00:00Z' }),
      succes('restant'),
      succes('recent', { debloque: true, debloque_le: '2026-06-01T10:00:00Z' }),
    ];
    expect(noms(ordonner(liste))).toEqual(['recent', 'ancien', 'restant']);
  });

  it('classe les restants du plus courant au plus rare, puis par nom', () => {
    const liste = [succes('b', { pct_mondial: 10 }), succes('rare', { pct_mondial: 1 }), succes('a', { pct_mondial: 10 }), succes('courant', { pct_mondial: 80 })];
    expect(noms(ordonner(liste))).toEqual(['courant', 'a', 'b', 'rare']);
  });

  it('range une rareté inconnue après toutes les raretés connues', () => {
    const liste = [succes('inconnu', { pct_mondial: null }), succes('zero', { pct_mondial: 0 })];
    expect(noms(ordonner(liste))).toEqual(['zero', 'inconnu']);
  });

  it('traite une progression inconnue comme « à débloquer » et ne change pas la liste reçue', () => {
    const liste = [succes('b', { debloque: null, pct_mondial: 5 }), succes('a', { debloque: null, pct_mondial: 40 })];
    const copie = [...liste];
    expect(noms(ordonner(liste))).toEqual(['a', 'b']);
    expect(liste).toEqual(copie);
  });

  it('supporte un débloqué sans date et une liste vide', () => {
    expect(noms(ordonner([succes('sans_date', { debloque: true }), succes('avec_date', { debloque: true, debloque_le: '2026-01-01T00:00:00Z' })]))).toEqual(['avec_date', 'sans_date']);
    expect(ordonner([])).toEqual([]);
  });
});

describe('filtrerSucces', () => {
  const liste = [succes('oui', { debloque: true }), succes('non'), succes('inconnu', { debloque: null })];

  it('garde tout avec « tous », dans une copie', () => {
    const resultat = filtrerSucces(liste, 'tous');
    expect(noms(resultat)).toEqual(['oui', 'non', 'inconnu']);
    expect(resultat).not.toBe(liste);
  });

  it('sépare débloqués et à débloquer, l\'inconnu allant avec les seconds', () => {
    expect(noms(filtrerSucces(liste, 'debloques'))).toEqual(['oui']);
    expect(noms(filtrerSucces(liste, 'a_debloquer'))).toEqual(['non', 'inconnu']);
  });

  it('rend une liste vide pour une liste vide', () => {
    for (const filtre of ['tous', 'debloques', 'a_debloquer'] as const) expect(filtrerSucces([], filtre)).toEqual([]);
  });
});

describe('apercu', () => {
  const debloques = (n: number) => Array.from({ length: n }, (_, i) => succes(`d${i}`, { debloque: true, debloque_le: `2026-0${i + 1}-01T00:00:00Z` }));
  const restants = (n: number) => Array.from({ length: n }, (_, i) => succes(`r${i}`, { pct_mondial: 90 - i }));

  it('prend la moitié de débloqués et complète avec les prochains à portée', () => {
    expect(noms(apercu([...debloques(5), ...restants(5)], 6))).toEqual(['d4', 'd3', 'd2', 'r0', 'r1', 'r2']);
  });

  it('comble avec des débloqués quand il reste peu de succès à faire', () => {
    expect(noms(apercu([...debloques(5), ...restants(1)], 6))).toEqual(['d4', 'd3', 'd2', 'd1', 'd0', 'r0']);
  });

  it('comble avec des restants quand il y a peu de débloqués', () => {
    expect(noms(apercu([...debloques(1), ...restants(8)], 6))).toEqual(['d0', 'r0', 'r1', 'r2', 'r3', 'r4']);
  });

  it('rend moins que demandé quand la liste est plus courte', () => {
    expect(noms(apercu([...debloques(1), ...restants(1)], 6))).toEqual(['d0', 'r0']);
    expect(apercu([], 6)).toEqual([]);
  });

  it('rend une liste vide pour zéro demandé', () => {
    expect(apercu([...debloques(2), ...restants(2)], 0)).toEqual([]);
  });

  it('n\'y met jamais un secret non débloqué, mais garde un secret débloqué', () => {
    const liste = [succes('secret_ferme', { secret: true, pct_mondial: 99 }), succes('secret_ouvert', { secret: true, debloque: true, debloque_le: '2026-01-01T00:00:00Z' }), succes('normal')];
    expect(noms(apercu(liste, 6))).toEqual(['secret_ouvert', 'normal']);
  });

  it('sans progression (null), montre les prochains non secrets', () => {
    const liste = [succes('a', { debloque: null, pct_mondial: 10 }), succes('b', { debloque: null, secret: true }), succes('c', { debloque: null, pct_mondial: 70 })];
    expect(noms(apercu(liste, 6))).toEqual(['c', 'a']);
  });
});

describe('estCache', () => {
  it('cache un secret non débloqué', () => {
    expect(estCache(succes('s', { secret: true }), false)).toBe(true);
  });

  it('ne cache pas un secret débloqué, ni quand le joueur a demandé à tout voir', () => {
    expect(estCache(succes('s', { secret: true, debloque: true }), false)).toBe(false);
    expect(estCache(succes('s', { secret: true }), true)).toBe(false);
  });

  it('cache un secret dont la progression est inconnue : on ne sait pas s\'il est débloqué', () => {
    expect(estCache(succes('s', { secret: true, debloque: null }), false)).toBe(true);
  });

  it('ne cache jamais un succès ordinaire', () => {
    expect(estCache(succes('n'), false)).toBe(false);
    expect(estCache(succes('n', { debloque: null }), false)).toBe(false);
  });
});
describe('rarete', () => {
  it('classe sous 5 % en ultra rare, sous 15 % en rare', () => {
    expect(rarete(succes('a', { pct_mondial: 2 }))).toBe('ultra');
    expect(rarete(succes('b', { pct_mondial: 12 }))).toBe('rare');
    expect(rarete(succes('c', { pct_mondial: 40 }))).toBeNull();
    expect(rarete(succes('d', { pct_mondial: null }))).toBeNull();
  });
});

describe('vitrine', () => {
  it('montre les trois débloqués les plus rares', () => {
    const liste = [
      succes('courant', { debloque: true, pct_mondial: 80 }),
      succes('rare', { debloque: true, pct_mondial: 3 }),
      succes('moyen', { debloque: true, pct_mondial: 30 }),
      succes('tres_rare', { debloque: true, pct_mondial: 1 }),
      succes('pas_eu', { pct_mondial: 0.5 }),
    ];
    expect(vitrine(liste, false)).toEqual({ succes: liste.filter((s) => ['tres_rare', 'rare', 'moyen'].includes(s.nom)).sort((a, b) => (a.pct_mondial ?? 0) - (b.pct_mondial ?? 0)), defis: false });
  });

  it('sans succès débloqué, propose les plus rares comme défis, sans les secrets cachés', () => {
    const liste = [succes('secret', { secret: true, pct_mondial: 0.1 }), succes('rare', { pct_mondial: 2 }), succes('courant', { pct_mondial: 70 })];
    const resultat = vitrine(liste, false);
    expect(resultat.defis).toBe(true);
    expect(noms(resultat.succes)).toEqual(['rare', 'courant']);
  });
});
