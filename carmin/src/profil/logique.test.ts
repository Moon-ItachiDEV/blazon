import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JeuResume, Source } from '../../contrat/types';
import type { FauxCoeur } from '../coeur/faux/faux_coeur';
import { coeurDeTest } from '../coeur/faux/outils_de_test';
import { calculerLesChiffres, compterMasques, plusJoues, repartitionParSource } from './logique';

let id = 0;
function jeu(partie: { titre?: string; minutes?: number; deux_sem?: number | null; lance?: boolean; installe?: boolean; taille?: number | null; favori?: boolean; masque?: boolean; sources?: Source[]; succes?: number | null | 'aucun' }): JeuResume {
  id += 1;
  const titre = partie.titre ?? `Jeu ${id}`;
  const lance = partie.lance ?? (partie.minutes ?? 0) > 0;
  return {
    id,
    titre,
    titre_tri: titre.toLowerCase(),
    sources: partie.sources ?? ['steam'],
    steam_appid: null,
    installe: partie.installe ?? false,
    taille_octets: partie.taille ?? null,
    ajoute_le: '2026-01-01T00:00:00Z',
    favori: partie.favori ?? false,
    masque: partie.masque ?? false,
    temps: { minutes_total: partie.minutes ?? 0, minutes_2sem: partie.deux_sem ?? null, dernier_lancement: lance ? '2026-10-01T00:00:00Z' : null, origine: 'steam' },
    jaquette: null,
    icone: null,
    couleur_dominante: null,
    tags: [],
    modes: [],
    manette: null,
    avis: null,
    date_sortie: null,
    succes: partie.succes === undefined || partie.succes === 'aucun' ? null : { total: 50, debloques: partie.succes },
  };
}

describe('chiffres', () => {
  it('compte tout sur une petite bibliothèque connue', () => {
    const chiffres = calculerLesChiffres([
      jeu({ minutes: 600, deux_sem: 60, installe: true, taille: 1000, favori: true, succes: 10 }),
      jeu({ minutes: 90, deux_sem: 30, installe: true, taille: 500, succes: 5 }),
      jeu({ minutes: 0 }),
      jeu({ minutes: 0 }),
    ]);
    expect(chiffres).toEqual({
      jeux: 4,
      installes: 2,
      minutes_total: 690,
      minutes_2sem: 90,
      jamais_lances: 2,
      part_jamais_lances: 50,
      succes_debloques: 15,
      favoris: 1,
      taille_installee: 1500,
    });
  });

  it('ne compte pas les jeux masqués', () => {
    const jeux = [jeu({ minutes: 100 }), jeu({ minutes: 5000, masque: true, favori: true, installe: true, taille: 99 })];
    const chiffres = calculerLesChiffres(jeux);
    expect(chiffres.jeux).toBe(1);
    expect(chiffres.minutes_total).toBe(100);
    expect(chiffres.favoris).toBe(0);
    expect(chiffres.installes).toBe(0);
    expect(chiffres.taille_installee).toBe(0);
    expect(compterMasques(jeux)).toBe(1);
  });

  it('distingue « inconnu » de « zéro » pour les deux semaines et les succès', () => {
    const inconnus = calculerLesChiffres([jeu({ minutes: 10, deux_sem: null, succes: null }), jeu({ minutes: 10 })]);
    expect(inconnus.minutes_2sem).toBeNull();
    expect(inconnus.succes_debloques).toBeNull();
    const zeros = calculerLesChiffres([jeu({ minutes: 10, deux_sem: 0, succes: 0 }), jeu({ minutes: 10 })]);
    expect(zeros.minutes_2sem).toBe(0);
    expect(zeros.succes_debloques).toBe(0);
  });

  it('additionne les deux semaines des jeux qui les connaissent, sans compter les autres', () => {
    expect(calculerLesChiffres([jeu({ minutes: 10, deux_sem: 20 }), jeu({ minutes: 10, deux_sem: null })]).minutes_2sem).toBe(20);
  });

  it('une taille inconnue sur un jeu installé compte pour zéro', () => {
    expect(calculerLesChiffres([jeu({ installe: true, taille: null }), jeu({ installe: true, taille: 7 })]).taille_installee).toBe(7);
  });

  it('ne divise pas par zéro sur une bibliothèque vide', () => {
    const chiffres = calculerLesChiffres([]);
    expect(chiffres.jeux).toBe(0);
    expect(chiffres.part_jamais_lances).toBe(0);
    expect(chiffres.minutes_2sem).toBeNull();
  });
});

describe('répartition par source', () => {
  it('trie du plus fourni au moins fourni et compte un jeu multi-source pour chacune', () => {
    const parts = repartitionParSource([
      jeu({ sources: ['steam'] }),
      jeu({ sources: ['steam', 'gog'] }),
      jeu({ sources: ['epic'] }),
      jeu({ sources: ['epic'] }),
      jeu({ sources: ['epic'] }),
      jeu({ sources: ['manuel'], masque: true }),
    ]);
    expect(parts).toEqual([
      { source: 'epic', jeux: 3 },
      { source: 'steam', jeux: 2 },
      { source: 'gog', jeux: 1 },
    ]);
  });
});

describe('les plus joués', () => {
  it('garde les cinq premiers par temps de jeu, sans les masqués ni les jamais joués', () => {
    const jeux = [10, 700, 30, 0, 400, 50, 600, 20].map((minutes, i) => jeu({ titre: `J${i}`, minutes }));
    jeux.push(jeu({ titre: 'Caché', minutes: 99999, masque: true }));
    expect(plusJoues(jeux).map((j) => j.temps.minutes_total)).toEqual([700, 600, 400, 50, 30]);
    expect(plusJoues(jeux, 2)).toHaveLength(2);
  });

  it('départage les égalités par titre', () => {
    const jeux = [jeu({ titre: 'Zèbre', minutes: 60 }), jeu({ titre: 'Abeille', minutes: 60 })];
    expect(plusJoues(jeux).map((j) => j.titre)).toEqual(['Abeille', 'Zèbre']);
  });

  it('renvoie une liste vide quand rien n\'a été joué', () => {
    expect(plusJoues([jeu({}), jeu({})])).toEqual([]);
  });
});

describe('sur les données factices', () => {
  let coeur: FauxCoeur;
  let jeux: JeuResume[];
  beforeAll(async () => {
    coeur = coeurDeTest();
    jeux = await coeur.lister_jeux();
  });
  afterAll(() => coeur.arreter());

  it('retrouve les chiffres du générateur (donnees-factices/bilan.json), masqués exclus', () => {
    const chiffres = calculerLesChiffres(jeux);
    expect(jeux).toHaveLength(2000);
    expect(compterMasques(jeux)).toBe(20);
    expect(chiffres.jeux).toBe(1980);
    expect(chiffres.installes).toBeLessThanOrEqual(150);
    expect(chiffres.favoris).toBeLessThanOrEqual(19);
    expect(plusJoues(jeux)).toHaveLength(5);
    const parts = repartitionParSource(jeux);
    expect(parts[0]?.source).toBe('steam');
  });
});
