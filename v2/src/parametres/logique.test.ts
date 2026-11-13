import { describe, expect, it } from 'vitest';
import type { JeuResume, MiseAJour } from '../../contrat/types';
import { erreur } from '../coeur/erreurs';
import { DICTIONNAIRES } from '../i18n';
import {
  bornerTaille,
  estCheminWindows,
  etatDeLAnalyse,
  etatDeLaCle,
  explicationDesJeuxPossedes,
  indiceApresRetrait,
  jeuxMasques,
  normaliserDossier,
  progressionDeLaMiseAJour,
  SOURCES_EN_LIGNE,
  TEXTE_DE_REFUS,
  TRIS,
  validerDossier,
} from './logique';

describe('dossiers à analyser', () => {
  it('remet un chemin collé dans une forme unique', () => {
    expect(normaliserDossier('  "D:\\Jeux\\"  ')).toBe('D:\\Jeux');
    expect(normaliserDossier('d:/Jeux/Steam/')).toBe('D:\\Jeux\\Steam');
    expect(normaliserDossier('e:')).toBe('E:\\');
    expect(normaliserDossier('E:\\\\')).toBe('E:\\');
    expect(normaliserDossier('\\\\nas\\jeux\\')).toBe('\\\\nas\\jeux');
  });

  it('reconnaît un chemin Windows, local ou réseau', () => {
    expect(estCheminWindows('D:\\Jeux')).toBe(true);
    expect(estCheminWindows('D:\\')).toBe(true);
    expect(estCheminWindows('\\\\nas\\jeux\\PC')).toBe(true);
    expect(estCheminWindows('Jeux')).toBe(false);
    expect(estCheminWindows('/home/nova/jeux')).toBe(false);
    expect(estCheminWindows('D:\\Je?ux')).toBe(false);
    expect(estCheminWindows('D:\\a:b')).toBe(false);
    expect(estCheminWindows('\\\\nas')).toBe(false);
    expect(estCheminWindows('https://exemple.fr')).toBe(false);
  });

  it('refuse un chemin vide, mal formé ou déjà présent, sans tenir compte de la casse', () => {
    const existants = ['D:\\Jeux', 'E:\\'];
    expect(validerDossier('   ', existants)).toEqual({ ok: false, raison: 'vide' });
    expect(validerDossier('""', existants)).toEqual({ ok: false, raison: 'vide' });
    expect(validerDossier('mes jeux', existants)).toEqual({ ok: false, raison: 'forme' });
    expect(validerDossier('d:\\jeux\\', existants)).toEqual({ ok: false, raison: 'deja_present' });
    expect(validerDossier('e:', existants)).toEqual({ ok: false, raison: 'deja_present' });
    expect(validerDossier(' "F:\\Games" ', existants)).toEqual({ ok: true, chemin: 'F:\\Games' });
  });

  it('a un texte pour chaque refus', () => {
    for (const cle of Object.values(TEXTE_DE_REFUS)) expect(DICTIONNAIRES.fr[cle]).toBeTruthy();
  });
});

describe('clé Steam', () => {
  it('dit chaque état avec le bon ton', () => {
    expect(etatDeLaCle('absente', true).ton).toBe('neutre');
    expect(etatDeLaCle('valide', true)).toMatchObject({ ton: 'ok', titre: 'parametres.cle.etat.valide' });
    expect(etatDeLaCle('refusee', true).ton).toBe('danger');
    expect(etatDeLaCle('non_verifiee', false).ton).toBe('alerte');
  });

  it('garde une clé valide hors ligne, en disant que rien ne se met à jour', () => {
    expect(etatDeLaCle('valide', false)).toMatchObject({ titre: 'parametres.cle.etat.valide', texte: 'parametres.cle.etat.valide.hors_ligne', ton: 'alerte' });
  });

  it('ne dit pas « tout est à jour » quand le profil est privé', () => {
    expect(etatDeLaCle('valide', true, true).texte).toBe('parametres.cle.etat.valide.profil_prive');
  });

  it("n'explique à part que ce qui n'est pas déjà dit ailleurs", () => {
    expect(explicationDesJeuxPossedes(null)).toBe('aucune');
    expect(explicationDesJeuxPossedes(erreur('cle_absente'))).toBe('aucune');
    expect(explicationDesJeuxPossedes(erreur('cle_refusee'))).toBe('aucune');
    expect(explicationDesJeuxPossedes(erreur('hors_ligne'))).toBe('aucune');
    expect(explicationDesJeuxPossedes(erreur('profil_prive'))).toBe('profil_prive');
    expect(explicationDesJeuxPossedes(erreur('quota_atteint'))).toBe('autre');
  });
});

describe('analyse du PC', () => {
  const repos = { en_cours: false, dernier: '2026-11-11T18:48:00Z', jeux_trouves: 150 };

  it("préfère la progression en direct à l'état du cœur", () => {
    expect(etatDeLAnalyse(repos, null)).toEqual({ en_cours: false, jeux_trouves: 150, dernier: repos.dernier });
    expect(etatDeLAnalyse(repos, { source: 'steam', jeux_trouves: 60 })).toEqual({ en_cours: true, jeux_trouves: 60, dernier: repos.dernier });
    expect(etatDeLAnalyse({ ...repos, en_cours: true, jeux_trouves: 0 }, null)).toMatchObject({ en_cours: true, jeux_trouves: 0 });
  });
});

describe('affichage', () => {
  it('borne la taille des jaquettes sur le pas du curseur', () => {
    expect(bornerTaille(180)).toBe(180);
    expect(bornerTaille(184)).toBe(180);
    expect(bornerTaille(186)).toBe(190);
    expect(bornerTaille(40)).toBe(120);
    expect(bornerTaille(900)).toBe(260);
    expect(bornerTaille(Number.NaN)).toBe(120);
  });

  it('propose les cinq tris et les cinq sources du contrat, une fois chacun', () => {
    expect(new Set(TRIS).size).toBe(5);
    expect(new Set(SOURCES_EN_LIGNE)).toEqual(new Set(['fiches_magasin', 'succes_publics', 'actualites', 'visuels_magasin', 'joueurs_en_ligne']));
  });

  it('liste les jeux masqués par ordre alphabétique', () => {
    const jeu = (id: number, titre_tri: string, masque: boolean) => ({ id, titre_tri, masque }) as JeuResume;
    const jeux = [jeu(1, 'zelda', true), jeu(2, 'celeste', false), jeu(3, 'astroneer', true)];
    expect(jeuxMasques(jeux).map((j) => j.id)).toEqual([3, 1]);
  });

  it('place le focus sur la ligne suivante, puis la précédente, puis nulle part', () => {
    expect(indiceApresRetrait(0, 3)).toBe(0);
    expect(indiceApresRetrait(3, 3)).toBe(2);
    expect(indiceApresRetrait(0, 0)).toBe(-1);
  });
});

describe('mise à jour', () => {
  it('donne une progression entière entre 0 et 100', () => {
    const maj = (progression_pct: number | null): MiseAJour => ({ version: '0.2.0', etape: 'telechargement', progression_pct });
    expect(progressionDeLaMiseAJour(maj(null))).toBe(0);
    expect(progressionDeLaMiseAJour(maj(49.6))).toBe(50);
    expect(progressionDeLaMiseAJour(maj(140))).toBe(100);
  });
});
