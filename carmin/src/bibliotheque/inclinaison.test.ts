import { describe, expect, it } from 'vitest';
import { inclinaison, INCLINAISON_MAX } from './inclinaison';

describe('inclinaison', () => {
  it('reste à plat quand le pointeur est au centre', () => {
    expect(inclinaison(0.5, 0.5)).toEqual({ rx: 0, ry: 0, gx: 50, gy: 50 });
  });

  it('atteint le maximum dans les coins', () => {
    expect(inclinaison(1, 0)).toEqual({ rx: INCLINAISON_MAX, ry: INCLINAISON_MAX, gx: 100, gy: 0 });
    expect(inclinaison(0, 1)).toEqual({ rx: -INCLINAISON_MAX, ry: -INCLINAISON_MAX, gx: 0, gy: 100 });
  });

  it('ne dépasse jamais le maximum, même hors de la carte', () => {
    const hors = inclinaison(1.8, -0.6);
    expect(hors.rx).toBe(INCLINAISON_MAX);
    expect(hors.ry).toBe(INCLINAISON_MAX);
  });
});
