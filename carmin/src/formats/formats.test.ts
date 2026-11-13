import { describe, expect, it } from 'vitest';
import {
  formaterDate, formaterDateRelative, formaterDureeDeSession, formaterNombre, formaterPourcentage, formaterTaille, formaterTempsDeJeu,
} from './index';

const MAINTENANT = new Date('2026-11-11T19:00:00Z');
const BRUXELLES = 'Europe/Brussels';
// Intl sépare les milliers par une espace fine insécable en français.
const FINE = '\u202f';
const INSECABLE = '\u00a0';

describe('formats', () => {
  it('écrit les nombres et les pourcentages selon la langue', () => {
    expect(formaterNombre(237473, 'fr')).toBe(`237${FINE}473`);
    expect(formaterNombre(237473, 'en')).toBe('237,473');
    expect(formaterPourcentage(97, 'fr')).toBe(`97${INSECABLE}%`);
    expect(formaterPourcentage(97, 'en')).toBe('97%');
  });

  it('écrit le temps de jeu en arrondissant vers le bas', () => {
    expect(formaterTempsDeJeu(0, 'fr')).toBe('0 min');
    expect(formaterTempsDeJeu(13, 'fr')).toBe('13 min');
    expect(formaterTempsDeJeu(4367, 'fr')).toBe('72 h');
    expect(formaterTempsDeJeu(15017, 'fr')).toBe('250 h');
    expect(formaterTempsDeJeu(75_000, 'fr')).toBe(`1${FINE}250 h`);
  });

  it('écrit la durée d\'une session', () => {
    expect(formaterDureeDeSession(5, 'fr')).toBe("Moins d'une minute");
    expect(formaterDureeDeSession(5, 'en')).toBe('Less than a minute');
    expect(formaterDureeDeSession(3034, 'fr')).toBe('51 min');
    expect(formaterDureeDeSession(6088, 'fr')).toBe('1 h 41');
    expect(formaterDureeDeSession(7299, 'fr')).toBe('2 h 02');
    expect(formaterDureeDeSession(3599, 'fr')).toBe('1 h 00');
  });

  it('écrit les tailles en unités de Windows', () => {
    expect(formaterTaille(563_617_958, 'fr')).toBe('538 Mo');
    expect(formaterTaille(17_947_186_651, 'fr')).toBe('16,7 Go');
    expect(formaterTaille(17_947_186_651, 'en')).toBe('16.7 GB');
  });

  it('écrit les dates relatives selon le calendrier local', () => {
    expect(formaterDateRelative('2026-11-11T13:00:20Z', 'fr', MAINTENANT, BRUXELLES)).toBe("Aujourd'hui");
    expect(formaterDateRelative('2026-11-10T22:30:00Z', 'fr', MAINTENANT, BRUXELLES)).toBe('Hier');
    // 23:30 UTC le 10 = 00:30 le 11 à Bruxelles : c'est déjà « aujourd'hui » pour le joueur.
    expect(formaterDateRelative('2026-11-10T23:30:00Z', 'fr', MAINTENANT, BRUXELLES)).toBe("Aujourd'hui");
    expect(formaterDateRelative('2026-11-09T04:09:13Z', 'fr', MAINTENANT, BRUXELLES)).toBe('Il y a 2 jours');
    expect(formaterDateRelative('2026-11-05T22:39:11Z', 'fr', MAINTENANT, BRUXELLES)).toBe('Il y a 6 jours');
    expect(formaterDateRelative('2026-11-05T22:39:11Z', 'en', MAINTENANT, BRUXELLES)).toBe('6 days ago');
    expect(formaterDateRelative('2026-10-01T10:38:36Z', 'fr', MAINTENANT, BRUXELLES)).toBe('1 oct.');
    expect(formaterDateRelative('2024-11-04T13:43:54Z', 'fr', MAINTENANT, BRUXELLES)).toBe('4 nov. 2024');
  });

  it('écrit les dates avec l\'année seulement si elle diffère', () => {
    expect(formaterDate('2026-11-05T22:39:11Z', 'fr', MAINTENANT, BRUXELLES)).toBe('5 nov.');
    expect(formaterDate('2024-09-10T14:59:54Z', 'fr', MAINTENANT, BRUXELLES)).toBe('10 sept. 2024');
    expect(formaterDate('2024-09-10T14:59:54Z', 'en', MAINTENANT, BRUXELLES)).toBe('10 Sept 2024');
  });
});
