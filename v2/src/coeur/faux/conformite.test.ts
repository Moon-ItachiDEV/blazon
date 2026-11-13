/**
 * Le faux cœur doit respecter le contrat à l'exécution, dans chaque scénario : sinon un écran
 * construit dessus casserait le jour où le vrai cœur arrive. On fabrique un schéma à partir de
 * chaque type du contrat et on y passe tout ce que le faux cœur renvoie ou émet.
 */
/// <reference types="node" />
import { Ajv, type ValidateFunction } from 'ajv';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';
import { afterAll, describe, expect, it } from 'vitest';
import type { Evenement } from '../../../contrat/types';
import type { FauxCoeur } from './faux_coeur';
import { attendre, coeurDeTest } from './outils_de_test';
import { SCENARIOS } from './scenarios';

const generateur = createGenerator({
  path: fileURLToPath(new URL('./formes.ts', import.meta.url)),
  type: '*',
  expose: 'export',
  skipTypeCheck: true,
  additionalProperties: false,
  strictTuples: true,
});
const ajv = new Ajv({ allErrors: false, strict: false });
const validateurs = new Map<string, ValidateFunction>();

function verifier(forme: string, valeur: unknown, contexte: string): void {
  let valide = validateurs.get(forme);
  if (!valide) {
    // Le schéma généré est un JSON Schema ordinaire ; seuls les types des deux bibliothèques diffèrent.
    valide = ajv.compile(generateur.createSchema(forme) as object);
    validateurs.set(forme, valide);
  }
  if (!valide(valeur)) {
    throw new Error(`${contexte} ne respecte pas ${forme} : ${ajv.errorsText(valide.errors?.slice(0, 3))}`);
  }
}

const ouverts: FauxCoeur[] = [];
afterAll(() => {
  for (const coeur of ouverts) coeur.arreter();
});

describe('conformité au contrat', () => {
  it.each(SCENARIOS)('scénario %s : chaque réponse et chaque événement respectent le contrat', async (scenario) => {
    const coeur = coeurDeTest({ scenario });
    ouverts.push(coeur);
    const evenements: Evenement[] = [];
    coeur.ecouter((e) => evenements.push(e));
    if (scenario === 'premier_lancement') await attendre(coeur, 'scan_termine');

    const etat = await coeur.etat();
    verifier('FormeEtat', etat, 'etat()');
    verifier('FormeParametres', await coeur.parametres(), 'parametres()');
    verifier('FormeReferentiels', await coeur.referentiels('fr'), "referentiels('fr')");
    verifier('FormeReferentiels', await coeur.referentiels('en'), "referentiels('en')");
    verifier('FormeComptes', await coeur.comptes_steam(), 'comptes_steam()');
    verifier('FormeAmis', await coeur.amis(), 'amis()');
    verifier('FormeProfil', await coeur.profil(), 'profil()');
    verifier('FormeActualites', await coeur.fil_d_actualites(20, null), 'fil_d_actualites()');

    const jeux = await coeur.lister_jeux();
    verifier('FormeJeux', jeux, 'lister_jeux()');
    // Un échantillon qui couvre installés, non installés, hors Steam, avec et sans succès.
    const echantillon = [
      ...jeux.filter((j) => j.installe && j.succes !== null).slice(0, 3),
      ...jeux.filter((j) => j.installe && j.steam_appid !== null && j.succes === null).slice(0, 2),
      ...jeux.filter((j) => !j.installe).slice(0, 3),
      ...jeux.filter((j) => j.steam_appid === null).slice(0, 2),
    ];
    for (const jeu of echantillon) {
      const ou = `jeu ${jeu.id}`;
      verifier('FormeDetail', await coeur.detail_jeu(jeu.id), `detail_jeu, ${ou}`);
      verifier('FormeSessions', await coeur.lister_sessions(jeu.id, 10, null), `lister_sessions, ${ou}`);
      // Deux lectures : la première peut répondre « rien encore », la seconde après l'arrivée du réseau.
      for (let passe = 0; passe < 2; passe += 1) {
        verifier('FormeFiche', await coeur.fiche_du_jeu(jeu.id), `fiche_du_jeu, ${ou}`);
        verifier('FormeSucces', await coeur.succes_du_jeu(jeu.id), `succes_du_jeu, ${ou}`);
        verifier('FormeActualites', await coeur.actualites_du_jeu(jeu.id, 5, null), `actualites_du_jeu, ${ou}`);
        await new Promise((resoudre) => {
          setTimeout(resoudre, 5);
        });
      }
    }

    verifier('FormeAnalyse', await coeur.analyser_un_chemin('D:\\Jeux\\Un_Jeu\\Un_Jeu.exe'), 'analyser_un_chemin()');
    verifier('FormeJeu', await coeur.ajouter_un_jeu_manuel('D:\\Jeux\\Un_Jeu\\Un_Jeu.exe', 'Un jeu'), 'ajouter_un_jeu_manuel()');
    verifier('FormeResultatCle', await coeur.enregistrer_la_cle('A1B2C3D4E5F60718293A4B5C6D7E8F90'), 'enregistrer_la_cle()');
    verifier('FormeEtat', await coeur.etat(), 'etat() après la clé');
    verifier('FormeJeux', await coeur.lister_jeux(), 'lister_jeux() après la clé');

    const installe = (await coeur.lister_jeux()).find((j) => j.installe && j.steam_appid !== null);
    if (installe && (await coeur.etat()).session_en_cours === null) {
      const fin = attendre(coeur, 'session_terminee');
      await coeur.lancer(installe.id, null);
      await fin;
    }
    await coeur.relancer_le_scan();
    await attendre(coeur, 'scan_termine');

    expect(evenements.length).toBeGreaterThan(0);
    evenements.forEach((e, i) => verifier('FormeEvenement', e, `événement ${i} (${e.type})`));
    verifier('FormeEtat', await coeur.etat(), 'etat() à la fin');
  });
});
