import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
