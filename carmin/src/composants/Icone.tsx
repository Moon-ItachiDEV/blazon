/**
 * Toutes les icônes de l'application, dessinées au trait sur une grille de 24.
 * Elles sont décoratives : le nom lisible est toujours porté par le bouton ou le lien qui les contient.
 */
import type { ReactNode } from 'react';

const TRACES = {
  maison: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  grille: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  liste: <path d="M4 6h16M4 12h16M4 18h16" />,
  journal: (
    <>
      <path d="M4 5h13v14H6a2 2 0 0 1-2-2z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2" />
      <path d="M8 9h5M8 13h5" />
    </>
  ),
  amis: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M17 14.5a5 5 0 0 1 4.5 5" />
    </>
  ),
  reglages: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  recherche: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  retour: <path d="M19 12H5M11 6l-6 6 6 6" />,
  chevron_bas: <path d="m6 9 6 6 6-6" />,
  chevron_droit: <path d="m9 6 6 6-6 6" />,
  etoile: <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z" />,
  fermer: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  autres: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
  dossier: <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  lien_externe: <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  cadenas: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  cle: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8.5-8.5M16 7l2.5 2.5M13.5 9.5l2 2" />
    </>
  ),
  hors_ligne: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M5.5 13a9 9 0 0 1 4-2.3M18.5 13a9 9 0 0 0-3.2-2M2.5 9.5a13.5 13.5 0 0 1 4-2.6M21.5 9.5A13.5 13.5 0 0 0 11 5.6" />
      <circle cx="12" cy="19.5" r="0.6" />
    </>
  ),
  horloge: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  trophee: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  alerte: (
    <>
      <path d="M12 4 2.8 19.5h18.4z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17" r="0.6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.6" />
    </>
  ),
  coche: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  oeil_barre: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4 9.5 6a13 13 0 0 1-3 3.8M6.3 7.8A13 13 0 0 0 2.5 12c1 2 4.5 6 9.5 6a9.5 9.5 0 0 0 3.8-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  oeil: (
    <>
      <path d="M2.5 12c1-2 4.5-6 9.5-6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  telechargement: <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" />,
  manette: (
    <>
      <path d="M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.3a2.3 2.3 0 0 1-4.1.9L15 15.5H9l-1.6 2.1a2.3 2.3 0 0 1-4.1-.9l-.7-3.3A4.5 4.5 0 0 1 7 8z" />
      <path d="M7.5 10.5v3M6 12h3" />
      <circle cx="16.5" cy="12" r="0.7" />
    </>
  ),
  rafraichir: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  tri_croissant: <path d="M7 18V6M3.5 9.5 7 6l3.5 3.5M13 8h8M13 12h6M13 16h4" />,
  tri_decroissant: <path d="M7 6v12M3.5 14.5 7 18l3.5-3.5M13 8h4M13 12h6M13 16h8" />,
  poubelle: <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h5.4a1.5 1.5 0 0 0 1.5-1.5L17 7M10 11v5.5M14 11v5.5" />,
  crayon: <path d="M4 20l.8-4L16 4.8a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8 19.2zM14 6.8 17.2 10" />,
  message: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  utilisateur: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NomDIcone = keyof typeof TRACES | 'jouer' | 'etoile_pleine';

export function Icone({ nom, taille = 20 }: { nom: NomDIcone; taille?: number }) {
  // Les deux icônes pleines : le triangle « Jouer » et l'étoile d'un favori.
  if (nom === 'jouer' || nom === 'etoile_pleine') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width={taille} height={taille} fill="currentColor" style={{ flex: 'none' }}>
        {nom === 'jouer' ? <path d="M8 5.5v13l10.5-6.5z" /> : TRACES.etoile}
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      {TRACES[nom]}
    </svg>
  );
}
