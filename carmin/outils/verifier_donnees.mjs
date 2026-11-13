// Vérifie que chaque fichier de donnees-factices/ respecte le contrat (contrat/types.ts).
// Usage : node outils/verifier_donnees.mjs   (depuis le dossier launcher, après npm install typescript ts-json-schema-generator ajv)
import { createGenerator } from 'ts-json-schema-generator';
import Ajv from 'ajv';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const donnees = join(racine, 'donnees-factices');
const generateur = createGenerator({ path: join(donnees, 'formats.ts'), type: '*', expose: 'export', skipTypeCheck: false, additionalProperties: false, strictTuples: true });
const ajv = new Ajv({ allErrors: false, strict: false });

const fichiers = [
  ['jeux.json', 'FichierJeux'], ['sessions.json', 'FichierSessions'], ['amis.json', 'FichierAmis'],
  ['actualites.json', 'FichierActualites'], ['referentiels.json', 'FichierReferentiels'], ['etat.json', 'FichierEtat'],
  ...readdirSync(join(donnees, 'fiches')).sort().map((f) => [join('fiches', f), 'FichierFiches']),
  ...readdirSync(join(donnees, 'succes')).sort().map((f) => [join('succes', f), 'FichierSucces']),
];
const validateurs = new Map();
let erreurs = 0;
for (const [fichier, type] of fichiers) {
  if (!validateurs.has(type)) validateurs.set(type, ajv.compile(generateur.createSchema(type)));
  const valide = validateurs.get(type);
  const contenu = JSON.parse(readFileSync(join(donnees, fichier), 'utf8'));
  if (valide(contenu)) continue;
  erreurs += 1;
  console.error(`ECHEC ${fichier} (${type}) : ${ajv.errorsText(valide.errors.slice(0, 3))}`);
}

// Cohérence entre fichiers : ce que le contrat promet mais que les types seuls ne voient pas.
const jeux = JSON.parse(readFileSync(join(donnees, 'jeux.json'), 'utf8'));
const sessions = JSON.parse(readFileSync(join(donnees, 'sessions.json'), 'utf8'));
const parId = new Map(jeux.map((j) => [j.id, j]));
const regles = [
  ['identifiants de jeux uniques', () => parId.size === jeux.length],
  ['couples (source, appid Steam) uniques', () => new Set(jeux.filter((j) => j.steam_appid).map((j) => j.steam_appid)).size === jeux.filter((j) => j.steam_appid).length],
  ['chaque session pointe vers un jeu existant', () => sessions.every((s) => parId.has(s.id_jeu))],
  ['aucune session avant l\'ajout du jeu', () => sessions.every((s) => s.debut >= parId.get(s.id_jeu).ajoute_le)],
  ['dernier lancement jamais avant l\'ajout', () => jeux.every((j) => !j.temps.dernier_lancement || j.temps.dernier_lancement >= j.ajoute_le)],
  ['un jeu jamais lancé a 0 minute', () => jeux.every((j) => (j.temps.minutes_total === 0) === (j.temps.dernier_lancement === null))],
  ['un jeu hors Steam a un temps d\'origine locale', () => jeux.every((j) => (j.steam_appid === null) === (j.temps.origine === 'local'))],
  ['taille connue seulement si installé', () => jeux.every((j) => (j.taille_octets !== null) === j.installe)],
  ['toutes les adresses sont en https ou en data:', () => jeux.every((j) => [j.jaquette, j.icone].every((u) => u === null || /^(https:|data:)/.test(u)))],
];
for (const [nom, test] of regles) {
  if (test()) continue;
  erreurs += 1;
  console.error(`ECHEC règle : ${nom}`);
}
console.log(erreurs === 0 ? `OK : ${fichiers.length} fichiers conformes au contrat, ${regles.length} règles de cohérence tenues.` : `${erreurs} échec(s).`);
process.exit(erreurs === 0 ? 0 : 1);
