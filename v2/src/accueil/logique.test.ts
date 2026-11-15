import { describe, expect, it } from 'vitest';
import type { EtatScan, JeuResume, ResultatTestCle } from '../../contrat/types';
import {
  actionSuivante,
  cleAuRecapitulatif,
  dernieresJaquettes,
  ETAPES,
  etapePrecedente,
  etapeSuivante,
  fautIlAnnoncer,
  INTERVALLE_D_ANNONCE_MS,
  lireLeScan,
  numeroDEtape,
  statutsDesSources,
  type LectureDuScan,
} from './logique';

const EN_COURS: EtatScan = { en_cours: true, dernier: null, jeux_trouves: 0 };
const FINI: EtatScan = { en_cours: false, dernier: '2026-11-11T10:00:00Z', jeux_trouves: 150 };
const JAMAIS: EtatScan = { en_cours: false, dernier: null, jeux_trouves: 0 };

describe('étapes', () => {
  it('va de la bienvenue à la fin, dans les deux sens, sans sortir des bornes', () => {
    expect(ETAPES.map(numeroDEtape)).toEqual([1, 2, 3, 4]);
    expect(etapeSuivante('bienvenue')).toBe('analyse');
    expect(etapeSuivante('cle')).toBe('fin');
    expect(etapeSuivante('fin')).toBeNull();
    expect(etapePrecedente('analyse')).toBe('bienvenue');
    expect(etapePrecedente('bienvenue')).toBeNull();
  });
});

describe('lecture du scan', () => {
  it('attend tant que le scan n’a pas démarré', () => {
    expect(lireLeScan(JAMAIS, null, null)).toEqual({ phase: 'attente', jeux_trouves: 0, source: null });
    expect(lireLeScan(null, null, null).phase).toBe('attente');
  });

  it('suit la progression directe pendant le scan', () => {
    expect(lireLeScan(EN_COURS, { source: 'epic', jeux_trouves: 112 }, null)).toEqual({ phase: 'en_cours', jeux_trouves: 112, source: 'epic' });
  });

  it('ne retombe pas à zéro entre la fin du scan et la relecture de l’état', () => {
    // `scan_termine` a vidé la progression directe ; l’état relu au début dit encore « en cours, 0 ».
    expect(lireLeScan(EN_COURS, null, { source: 'gog', jeux_trouves: 150 })).toEqual({ phase: 'en_cours', jeux_trouves: 150, source: 'gog' });
  });

  it('donne le total une fois le scan terminé', () => {
    expect(lireLeScan(FINI, null, { source: 'gog', jeux_trouves: 140 })).toEqual({ phase: 'termine', jeux_trouves: 150, source: null });
  });
});

describe('statut des magasins', () => {
  const lecture = (phase: LectureDuScan['phase'], source: LectureDuScan['source'] = null): LectureDuScan => ({ phase, source, jeux_trouves: 0 });
  const statuts = (l: LectureDuScan, steam = true) => statutsDesSources(l, steam).map((s) => s.statut);

  it('marque les magasins déjà vus, celui en cours et ceux à venir', () => {
    expect(statuts(lecture('en_cours', 'epic'))).toEqual(['fini', 'en_cours', 'a_venir']);
    expect(statuts(lecture('termine'))).toEqual(['fini', 'fini', 'fini']);
    expect(statuts(lecture('attente'))).toEqual(['a_venir', 'a_venir', 'a_venir']);
  });

  it('commence par le premier magasin présent quand la source n’est pas encore connue', () => {
    expect(statuts(lecture('en_cours'))).toEqual(['en_cours', 'a_venir', 'a_venir']);
    expect(statuts(lecture('en_cours'), false)).toEqual(['absent', 'en_cours', 'a_venir']);
  });

  it('dit que Steam est absent plutôt que fini ou en cours', () => {
    expect(statuts(lecture('termine'), false)).toEqual(['absent', 'fini', 'fini']);
    expect(statuts(lecture('en_cours', 'steam'), false)[0]).toBe('absent');
  });
});

describe('jaquettes', () => {
  const jeu = (id: number, masque = false, jaquette: string | null = 'image') => ({ id, masque, jaquette }) as JeuResume;

  it('fait passer les jeux qui ont une image avant ceux dont la jaquette sera dessinée', () => {
    const jeux = [jeu(1), jeu(2, false, null), jeu(3), jeu(4, false, null), jeu(5, true)];
    expect(dernieresJaquettes(jeux, 3).map((j) => j.id)).toEqual([3, 1, 4]);
    expect(dernieresJaquettes(jeux, 2).map((j) => j.id)).toEqual([3, 1]);
  });

  it('montre les dernières arrivées, la plus récente d’abord, sans les jeux masqués', () => {
    const jeux = [jeu(1), jeu(2), jeu(3, true), jeu(4), jeu(5)];
    expect(dernieresJaquettes(jeux, 3).map((j) => j.id)).toEqual([5, 4, 2]);
    expect(dernieresJaquettes(jeux, 10).map((j) => j.id)).toEqual([5, 4, 2, 1]);
    expect(dernieresJaquettes(null, 3)).toEqual([]);
    expect(dernieresJaquettes(jeux, 0)).toEqual([]);
  });
});

describe('annonces', () => {
  const l = (phase: LectureDuScan['phase'], source: LectureDuScan['source']): LectureDuScan => ({ phase, source, jeux_trouves: 10 });

  it('annonce le début, chaque nouveau magasin et la fin, une seule fois', () => {
    expect(fautIlAnnoncer(null, l('attente', null), 0)).toBe(false);
    expect(fautIlAnnoncer(null, l('en_cours', 'steam'), 0)).toBe(true);
    const steam = { phase: 'en_cours' as const, source: 'steam' as const, instant_ms: 0 };
    expect(fautIlAnnoncer(steam, l('en_cours', 'epic'), 100)).toBe(true);
    expect(fautIlAnnoncer(steam, l('termine', null), 100)).toBe(true);
    expect(fautIlAnnoncer({ phase: 'termine', source: null, instant_ms: 0 }, l('termine', null), 99_999)).toBe(false);
  });

  it('n’annonce pas chaque jeu trouvé : au plus une fois par intervalle pour un même magasin', () => {
    const steam = { phase: 'en_cours' as const, source: 'steam' as const, instant_ms: 1_000 };
    expect(fautIlAnnoncer(steam, l('en_cours', 'steam'), 1_000 + INTERVALLE_D_ANNONCE_MS - 1)).toBe(false);
    expect(fautIlAnnoncer(steam, l('en_cours', 'steam'), 1_000 + INTERVALLE_D_ANNONCE_MS)).toBe(true);
  });
});

describe('clé et bouton suivant', () => {
  const verdict = (etat: ResultatTestCle['etat'], pseudo: string | null = null): ResultatTestCle => ({ etat, pseudo, erreur: null });

  it('résume la clé d’après le verdict, ou d’après le cœur après un refus', () => {
    expect(cleAuRecapitulatif(verdict('valide', 'Nova'), 'valide')).toEqual({ etat: 'valide', pseudo: 'Nova' });
    expect(cleAuRecapitulatif(null, 'valide')).toEqual({ etat: 'valide', pseudo: null });
    expect(cleAuRecapitulatif(verdict('non_verifiee'), 'non_verifiee')).toEqual({ etat: 'non_verifiee' });
    expect(cleAuRecapitulatif(verdict('refusee'), 'refusee')).toEqual({ etat: 'sans' });
    // Une nouvelle clé refusée ne retire pas celle déjà acceptée.
    expect(cleAuRecapitulatif(verdict('refusee'), 'valide')).toEqual({ etat: 'valide', pseudo: null });
    expect(cleAuRecapitulatif(null, 'absente')).toEqual({ etat: 'sans' });
  });

  it('ne met jamais deux boutons principaux à l’étape de la clé', () => {
    const sans = { etat: 'sans' } as const;
    expect(actionSuivante('cle', sans, null, true)).toEqual({ action: 'plus_tard', principale: false });
    expect(actionSuivante('cle', sans, verdict('refusee'), true)).toEqual({ action: 'continuer_sans_cle', principale: false });
    expect(actionSuivante('cle', { etat: 'valide', pseudo: 'Nova' }, verdict('valide'), false)).toEqual({ action: 'continuer', principale: true });
    expect(actionSuivante('cle', { etat: 'valide', pseudo: null }, null, true)).toEqual({ action: 'continuer', principale: false });
  });

  it('commence, continue puis ouvre la bibliothèque', () => {
    const sans = { etat: 'sans' } as const;
    expect(actionSuivante('bienvenue', sans, null, true).action).toBe('commencer');
    expect(actionSuivante('analyse', sans, null, true)).toEqual({ action: 'continuer', principale: true });
    expect(actionSuivante('fin', sans, null, true)).toEqual({ action: 'ouvrir', principale: true });
  });
});
