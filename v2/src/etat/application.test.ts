import { afterEach, describe, expect, it } from 'vitest';
import type { FauxCoeur } from '../coeur/faux/faux_coeur';
import { coeurDeTest } from '../coeur/faux/outils_de_test';
import { application, demarrer, modifierLesParametres } from './application';

let coeur: FauxCoeur | null = null;
let debrancher: (() => void) | null = null;

afterEach(() => {
  debrancher?.();
  coeur?.arreter();
  coeur = null;
  debrancher = null;
});

/** Attend qu'une condition devienne vraie : le magasin se met à jour après des événements du cœur. */
async function jusqua(condition: () => boolean): Promise<void> {
  for (let essai = 0; essai < 400 && !condition(); essai += 1) await new Promise((suite) => setTimeout(suite, 5));
  expect(condition()).toBe(true);
}

describe('changement de langue', () => {
  it('relit les tags dans la nouvelle langue, bien que le magasin la connaisse avant la réponse du cœur', async () => {
    coeur = coeurDeTest();
    debrancher = demarrer(coeur);
    await jusqua(() => application.lire().pret);

    const [fr, en] = await Promise.all([coeur.referentiels('fr'), coeur.referentiels('en')]);
    // Un tag dont le nom change vraiment d'une langue à l'autre.
    const repere = fr.tags.find((tag) => en.tags.some((autre) => autre.id === tag.id && autre.nom !== tag.nom));
    expect(repere).toBeDefined();
    if (repere === undefined) return;
    const enAnglais = en.tags.find((tag) => tag.id === repere.id)?.nom;

    expect(application.lire().tags.get(repere.id)).toBe(repere.nom);

    await modifierLesParametres((p) => ({ ...p, langue: 'en' }));
    await jusqua(() => application.lire().tags.get(repere.id) === enAnglais);

    await modifierLesParametres((p) => ({ ...p, langue: 'fr' }));
    await jusqua(() => application.lire().tags.get(repere.id) === repere.nom);
  });
});
