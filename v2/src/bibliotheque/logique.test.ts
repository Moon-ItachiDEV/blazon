import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JeuResume } from '../../contrat/types';
import type { FauxCoeur } from '../coeur/faux/faux_coeur';
import { coeurDeTest } from '../coeur/faux/outils_de_test';
import { aReprendre, compter, filtrer, normaliserRecherche, rechercheRapide, trier } from './logique';

let coeur: FauxCoeur;
let jeux: JeuResume[];
beforeAll(async () => {
  coeur = coeurDeTest();
  jeux = await coeur.lister_jeux();
});
afterAll(() => coeur.arreter());

const TOUT = { filtre: 'tous', recherche: '', montrer_les_jeux_masques: true } as const;
const titres = (liste: JeuResume[]) => liste.map((j) => j.titre);

describe('filtres et compteurs', () => {
  it('retrouve les chiffres annoncés par le générateur de données', () => {
    // Source indépendante : donnees-factices/bilan.json.
    expect(compter(jeux, true)).toEqual({ tous: 2000, installes: 150, favoris: 19, jamais_lances: 658 });
  });

  it('cache les jeux masqués sauf demande contraire', () => {
    expect(filtrer(jeux, TOUT)).toHaveLength(2000);
    const visibles = filtrer(jeux, { ...TOUT, montrer_les_jeux_masques: false });
    expect(visibles).toHaveLength(1980);
    expect(visibles.some((j) => j.masque)).toBe(false);
    expect(compter(jeux, false).tous).toBe(1980);
  });

  it('donne le même nombre par le filtre et par le compteur', () => {
    const compte = compter(jeux, false);
    for (const filtre of ['tous', 'installes', 'favoris', 'jamais_lances'] as const) {
      expect(filtrer(jeux, { filtre, recherche: '', montrer_les_jeux_masques: false }), filtre).toHaveLength(compte[filtre]);
    }
  });

  it('cherche sans tenir compte des accents, de la casse ni de l\'ordre des mots', () => {
    expect(normaliserRecherche('  Épée & Magie ! ')).toBe('epee magie');
    expect(titres(filtrer(jeux, { ...TOUT, recherche: 'SATISFAC' }))).toEqual(['Satisfactory']);
    expect(titres(filtrer(jeux, { ...TOUT, recherche: 'wilds monster' }))).toContain('Monster Hunter Wilds');
    expect(filtrer(jeux, { ...TOUT, recherche: 'zzzz introuvable' })).toEqual([]);
    expect(filtrer(jeux, { ...TOUT, recherche: '   ' })).toHaveLength(2000);
  });
});

describe('tri', () => {
  it('ne modifie pas la liste reçue', () => {
    const avant = jeux.map((j) => j.id);
    trier(jeux, 'temps_de_jeu', 'decroissant');
    expect(jeux.map((j) => j.id)).toEqual(avant);
  });

  it('trie par titre en comprenant les nombres', () => {
    const tries = trier(jeux, 'titre', 'croissant');
    const cles = tries.map((j) => j.titre_tri);
    const attendu = [...cles].sort(new Intl.Collator('fr', { numeric: true, sensitivity: 'base' }).compare);
    expect(cles).toEqual(attendu);
    expect(trier(jeux, 'titre', 'decroissant')[0]?.id).toBe(tries.at(-1)?.id);
  });

  it('trie par temps de jeu, du plus joué au moins joué', () => {
    const minutes = trier(jeux, 'temps_de_jeu', 'decroissant').map((j) => j.temps.minutes_total);
    expect(minutes).toEqual([...minutes].sort((a, b) => b - a));
    expect(minutes[0]).toBeGreaterThan(0);
  });

  it('range les jeux jamais lancés à la fin, dans les deux sens', () => {
    for (const ordre of ['croissant', 'decroissant'] as const) {
      const tries = trier(jeux, 'dernier_lancement', ordre);
      const premierJamais = tries.findIndex((j) => j.temps.dernier_lancement === null);
      expect(premierJamais, ordre).toBe(2000 - 658);
      expect(tries.slice(premierJamais).every((j) => j.temps.dernier_lancement === null)).toBe(true);
      const dates = tries.slice(0, premierJamais).map((j) => j.temps.dernier_lancement ?? '');
      const attendu = [...dates].sort();
      expect(dates).toEqual(ordre === 'croissant' ? attendu : attendu.reverse());
    }
  });

  it('range aussi les dates de sortie inconnues à la fin', () => {
    const tries = trier(jeux, 'date_sortie', 'croissant');
    const premierInconnu = tries.findIndex((j) => j.date_sortie === null);
    expect(premierInconnu).toBeGreaterThan(0);
    expect(tries.slice(premierInconnu).every((j) => j.date_sortie === null)).toBe(true);
  });
});

describe('reprendre et recherche rapide', () => {
  it('propose les jeux installés lancés le plus récemment', () => {
    const reprise = aReprendre(jeux, 4);
    const dates = reprise.map((j) => j.temps.dernier_lancement ?? '');
    expect(reprise).toHaveLength(4);
    // Du plus récent au plus ancien (les dates ISO en UTC se comparent comme du texte).
    expect(dates).toEqual([...dates].sort().reverse());
    // Le premier est bien le plus récent de tous les candidats, calculé ici sans passer par `trier`.
    const plusRecent = jeux
      .filter((j) => j.installe && !j.masque)
      .map((j) => j.temps.dernier_lancement ?? '')
      .sort()
      .at(-1);
    expect(dates[0]).toBe(plusRecent);
    expect(aReprendre(jeux, 50).every((j) => j.installe && !j.masque && j.temps.dernier_lancement !== null)).toBe(true);
    expect(aReprendre(jeux, 0)).toEqual([]);
  });

  it('classe le titre exact avant le début de titre, puis le début de mot', () => {
    const resultats = titres(rechercheRapide(jeux, 'terraria', 5));
    expect(resultats[0]).toBe('Terraria');
    const hollow = titres(rechercheRapide(jeux, 'hollow', 5));
    expect(hollow[0]?.toLowerCase().startsWith('hollow')).toBe(true);
    expect(rechercheRapide(jeux, '', 5)).toEqual([]);
    expect(rechercheRapide(jeux, 'a', 7)).toHaveLength(7);
    expect(rechercheRapide(jeux, 'a', 50).some((j) => j.masque)).toBe(false);
  });

  it('reste instantané sur 2 000 jeux', () => {
    const debut = performance.now();
    for (let i = 0; i < 20; i += 1) {
      trier(filtrer(jeux, { filtre: 'tous', recherche: 'the', montrer_les_jeux_masques: false }), 'titre', 'croissant');
      rechercheRapide(jeux, 'war', 8);
    }
    // Budget large pour une machine de test lente : 20 passes complètes en moins de 400 ms.
    expect(performance.now() - debut).toBeLessThan(400);
  });
});
