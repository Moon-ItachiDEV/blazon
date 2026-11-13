import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Build de l'exécutable Windows : le faux cœur et ses données factices sont remplacés par un bouchon.
const exe = process.env.BLAZON_EXE === '1';

export default defineConfig({
  plugins: [react()],
  resolve: exe ? { alias: [{ find: /^\.\/faux\/faux_coeur$/, replacement: fileURLToPath(new URL('./src/coeur/sans_faux.ts', import.meta.url)) }] } : {},
  // Chemins relatifs : la version artefact est servie depuis un sous-dossier inconnu d'avance.
  base: './',
  // Tauri attend un port fixe ; on le fixe dès maintenant pour ne rien changer plus tard.
  server: { port: 1420, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
