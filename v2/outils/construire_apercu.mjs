/**
 * Construit l'application en UN SEUL fichier HTML, à ouvrir d'un double-clic dans Chrome ou Edge :
 * pas de serveur, pas d'installation. Le code, les styles, les polices et les données factices sont
 * dans le fichier ; seules les images des jeux viennent d'Internet (magasin Steam).
 *
 *   node outils/construire_apercu.mjs [fichier de sortie]      (défaut : apercu/Blazon.html)
 *
 * Sert à montrer la maquette à quelqu'un qui n'a ni Node ni le dépôt. Ce n'est pas la version livrée.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const racine = fileURLToPath(new URL('..', import.meta.url));
const sortie = resolve(process.argv[2] ?? `${racine}apercu/Blazon.html`);
const temporaire = `${racine}dist-apercu`;

const resultat = await build({
  root: racine,
  logLevel: 'warn',
  base: './',
  build: {
    outDir: temporaire,
    emptyOutDir: true,
    write: false,
    // Tout dans un seul module : une page ouverte depuis le disque ne peut pas charger d'autres fichiers.
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    chunkSizeWarningLimit: Number.MAX_SAFE_INTEGER,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});

const fichiers = (Array.isArray(resultat) ? resultat : [resultat]).flatMap((r) => r.output);
const scripts = fichiers.filter((f) => f.type === 'chunk');
const styles = fichiers.filter((f) => f.type === 'asset' && f.fileName.endsWith('.css'));
const autres = fichiers.filter((f) => f.type === 'asset' && !f.fileName.endsWith('.css') && !f.fileName.endsWith('.html'));
if (scripts.length !== 1) throw new Error(`Un seul script attendu, ${scripts.length} produits : ${scripts.map((s) => s.fileName).join(', ')}`);
if (autres.length > 0) throw new Error(`Fichiers non intégrés : ${autres.map((a) => a.fileName).join(', ')}`);

const page = fichiers.find((f) => f.fileName === 'index.html');
// Dans une page, « </script » fermerait la balise au milieu du code : on le coupe.
const code = scripts[0].code.replaceAll('</script', '<\\/script');
const css = styles.map((s) => String(s.source)).join('\n');
let html = String(page.source)
  .replace(/<script type="module"[^>]*><\/script>\s*/g, '')
  .replace(/<link rel="stylesheet"[^>]*>\s*/g, '')
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
html = html.replace('</head>', () => `<style>${css}</style>\n  </head>`);
html = html.replace('</body>', () => `<script type="module">${code}</script>\n  </body>`);

mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, html);
rmSync(temporaire, { recursive: true, force: true });
console.log(`${sortie} : ${(html.length / 1e6).toFixed(1)} Mo (${scripts.length} script, ${styles.length} feuille de style).`);
