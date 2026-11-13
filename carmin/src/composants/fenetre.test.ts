import { describe, expect, it } from 'vitest';
import { geometrie } from './fenetre';

const grille = (nombre: number) => ({ nombre, largeurMin: 180, espace: 16, hauteur: (largeur: number) => largeur * 1.5 });

describe('géométrie d’une liste fenêtrée', () => {
  it('met autant de colonnes que la largeur le permet, sans descendre sous la largeur minimale', () => {
    // 6 colonnes de 180 et 5 espaces de 16 tiennent dans 1 160 px ; il en faudrait 1 356 pour 7.
    expect(geometrie(1160, grille(2000)).colonnes).toBe(6);
    expect(geometrie(1159, grille(2000)).colonnes).toBe(5);
    expect(geometrie(1356, grille(2000)).colonnes).toBe(7);
  });

  it('garde au moins une colonne dans une fenêtre très étroite', () => {
    expect(geometrie(120, grille(10)).colonnes).toBe(1);
  });

  it('compte les lignes, la dernière pouvant être incomplète', () => {
    expect(geometrie(1160, grille(12)).lignes).toBe(2);
    expect(geometrie(1160, grille(13)).lignes).toBe(3);
    expect(geometrie(1160, grille(0)).lignes).toBe(0);
  });

  it('calcule le pas vertical : hauteur de la jaquette (2:3) plus l’espace', () => {
    const { pas } = geometrie(1160, grille(2000));
    expect(pas).toBeCloseTo(180 * 1.5 + 16, 6);
  });

  it('traite une liste comme une seule colonne de hauteur fixe', () => {
    const liste = { nombre: 150, largeurMin: null, espace: 0, hauteur: () => 64 };
    expect(geometrie(900, liste)).toEqual({ colonnes: 1, pas: 64, lignes: 150 });
  });
});
