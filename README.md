# Blazon

Blazon est un launcher de jeux pour Windows 11, pensé comme une alternative au client Steam : une bibliothèque unique, les jaquettes, les succès, les actualités et les amis, dans une interface plus soignée.

Le projet est en cours de conception. Deux directions d'apparence sont développées en parallèle sur le même contrat et le même cœur.

## Contenu du dépôt

| Dossier | Rôle |
| --- | --- |
| `carmin/` | Front-end « Carmin » (React 19, Vite, TypeScript strict). |
| `v2/` | Front-end « V2 » (anthracite, accent bleu électrique), même pile. |
| `electron/` | La coquille Electron et le vrai cœur Node (`electron/coeur/`), partagé par les deux versions. Voir `electron/LISEZMOI.md`. |
| `logos/` | Le logo Blazon (blason dégradé violet-rose). |

Chaque front contient son `contrat/types.ts` (le contrat entre l'interface et le cœur, identique dans les deux), ses `donnees-factices/` (une bibliothèque de 2 000 jeux pour travailler sans compte Steam) et ses outils. Le détail est dans `carmin/LISEZMOI.md` et `v2/LISEZMOI.md`.

## Lancer un front

```sh
cd carmin        # ou v2
npm ci
npm run dev      # http://localhost:1420, sur les données factices
npm run verifier # types, tests et conformité des données
```

## Construire les .exe

Voir `electron/LISEZMOI.md`. Les .exe ne sont pas rangés dans le dépôt.

## Clé Steam et données personnelles

Aucune clé n'est dans ce dépôt. Dans l'app, la clé Steam Web API est saisie par l'utilisateur, chiffrée par Windows (safeStorage) dans `%APPDATA%` et jamais envoyée à l'interface. Le compte Steam est lu sur le PC. Les données factices n'ont que des amis et un profil inventés ; les textes de jeux et d'annonces sont des réponses publiques du magasin Steam.

## Ce qui n'est pas dans le dépôt

Les .exe, les `node_modules`, les captures et films, les réponses brutes de Steam qui servent à refabriquer les données factices (`outils/generer_donnees.py` les attend dans `fixtures/catalogue/`), et les anciennes pistes d'apparence (Nuit, Abysse, Arène, Salon).

Blazon n'est ni affilié à Valve ni approuvé par Valve. Steam est une marque de Valve Corporation.
