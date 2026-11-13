import { describe, expect, it } from 'vitest';
import { colonnesPossibles, parRangee, repartirEnRangees } from './rangees';

describe('parRangee', () => {
  it('garde une seule rangée tant que tout tient', () => {
    // 1 500 px, 176 px au moins par élément, 16 px d'écart : sept éléments tiennent.
    expect(parRangee(6, 1500, 176, 16)).toBe(6);
    expect(parRangee(7, 1500, 176, 16)).toBe(7);
  });

  it('répartit au lieu de laisser un élément seul sur la dernière rangée', () => {
    expect(parRangee(8, 1500, 176, 16)).toBe(4);
    expect(parRangee(9, 1500, 176, 16)).toBe(5);
    expect(parRangee(15, 1500, 176, 16)).toBe(5);
  });

  it('descend à une colonne quand la place manque', () => {
    expect(parRangee(5, 150, 176, 16)).toBe(1);
  });

  it('ne renvoie jamais zéro, même sans élément ou sans largeur', () => {
    expect(parRangee(0, 1500, 176, 16)).toBe(1);
    expect(parRangee(3, 0, 176, 16)).toBe(1);
  });
});

describe('colonnesPossibles', () => {
  it('compte les colonnes qui tiennent, écarts compris', () => {
    expect(colonnesPossibles(1184, 176, 16)).toBe(6);
    expect(colonnesPossibles(7 * 176 + 6 * 16, 176, 16)).toBe(7);
    expect(colonnesPossibles(7 * 176 + 6 * 16 - 1, 176, 16)).toBe(6);
  });

  it('en garde toujours une', () => {
    expect(colonnesPossibles(0, 176, 16)).toBe(1);
  });
});

describe('repartirEnRangees', () => {
  const largeurs = (minimums: number[], largeur: number, ecart: number) => repartirEnRangees(minimums, largeur, ecart).map((place) => Math.round(place.largeur * 100) / 100);
  const six = Array<number>(6).fill(176);
  const sept = Array<number>(7).fill(176);

  it('donne la même largeur à tous quand une rangée suffit', () => {
    expect(largeurs(six, 1500, 16)).toEqual(Array(6).fill(236.67));
  });

  it('équilibre les rangées au lieu de laisser un élément seul sur la dernière', () => {
    // 1 184 px : six éléments tiendraient sur la première rangée et le septième serait seul. On en met quatre puis trois.
    const places = repartirEnRangees(sept, 1184, 16);
    expect(places.map((place) => place.largeur)).toEqual([284, 284, 284, 284, 384, 384, 384]);
    expect(places.map((place) => place.colonne)).toEqual([0, 1, 2, 3, 0, 1, 2]);
  });

  it('partage la place libre au prorata des largeurs minimales', () => {
    // Un grand élément de 480 px et cinq de 176 px : 64 px restent, dont 480/1360 vont au premier.
    expect(largeurs([480, 176, 176, 176, 176, 176], 1504, 16)).toEqual([502.59, 184.28, 184.28, 184.28, 184.28, 184.28]);
  });

  it('remplit chaque rangée jusqu\'au bord', () => {
    for (const largeur of [400, 777, 1184, 1504]) {
      const places = repartirEnRangees([480, 176, 300, 176, 176, 240, 176], largeur, 16);
      let somme = 0;
      places.forEach((place, index) => {
        if (place.colonne === 0 && index > 0) {
          expect(somme).toBeCloseTo(largeur);
          somme = 0;
        }
        somme += place.largeur + (place.colonne === 0 ? 0 : 16);
      });
      expect(somme).toBeCloseTo(largeur);
    }
  });

  it('donne toute la largeur à un élément plus large que la bande', () => {
    expect(largeurs([176, 176], 150, 16)).toEqual([150, 150]);
  });

  it('garde les largeurs minimales tant que la bande n\'est pas mesurée, et ne renvoie rien sans élément', () => {
    expect(largeurs([480, 176], 0, 16)).toEqual([480, 176]);
    expect(repartirEnRangees([], 1500, 16)).toEqual([]);
  });
});
