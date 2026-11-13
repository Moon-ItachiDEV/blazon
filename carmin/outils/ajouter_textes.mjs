/**
 * Ajoute ou remplace des textes dans fr.json ET en.json d'un seul geste, pour qu'ils restent en phase.
 *
 * Entrée standard : une ligne par texte, au format « clé ¦ français ¦ anglais ».
 *   node outils/ajouter_textes.mjs <<'FIN'
 *   amis.titre ¦ Amis ¦ Friends
 *   FIN
 *
 * Un verrou (dossier créé puis supprimé) évite que deux lancements simultanés s'écrasent.
 */
import { mkdirSync, readFileSync, rmdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dossier = fileURLToPath(new URL('../src/i18n/', import.meta.url));
const verrou = `${dossier}.verrou`;
const SEPARATEUR = '¦';

const entree = readFileSync(0, 'utf8');
const ajouts = [];
for (const ligne of entree.split('\n')) {
  if (ligne.trim() === '') continue;
  const morceaux = ligne.split(SEPARATEUR).map((morceau) => morceau.trim());
  if (morceaux.length !== 3 || morceaux.some((morceau) => morceau === '')) {
    console.error(`Ligne mal formée (attendu : clé ${SEPARATEUR} français ${SEPARATEUR} anglais) : ${ligne}`);
    process.exit(1);
  }
  ajouts.push(morceaux);
}

const attendre = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let pris = false;
for (let essai = 0; essai < 200 && !pris; essai += 1) {
  try {
    mkdirSync(verrou);
    pris = true;
  } catch {
    attendre(50);
  }
}
if (!pris) {
  console.error(`Verrou ${verrou} occupé depuis 10 s. S'il est resté d'un lancement interrompu, supprime ce dossier.`);
  process.exit(1);
}

try {
  const lire = (nom) => JSON.parse(readFileSync(dossier + nom, 'utf8'));
  const fr = lire('fr.json');
  const en = lire('en.json');
  for (const [cle, francais, anglais] of ajouts) {
    fr[cle] = francais;
    en[cle] = anglais;
  }
  writeFileSync(`${dossier}fr.json`, `${JSON.stringify(fr, null, 2)}\n`);
  writeFileSync(`${dossier}en.json`, `${JSON.stringify(en, null, 2)}\n`);
  console.log(`${ajouts.length} textes ajoutés ou remplacés ; ${Object.keys(fr).length} clés au total.`);
} finally {
  rmdirSync(verrou);
}
