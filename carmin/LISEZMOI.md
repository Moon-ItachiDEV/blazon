# Launcher : contrat, données factices et front-end

Ce dossier prépare le front-end. Il sera déplacé dans le dépôt GitHub du launcher dès qu'il existera.

## Ce qu'il contient

| Dossier | Rôle |
| --- | --- |
| `contrat/types.ts` | Le contrat v0.2 : tous les types que l'interface reçoit, et l'interface `Coeur` avec toutes les commandes et tous les événements. Les écrans ne dépendent que de ce fichier. |
| `donnees-factices/` | Une bibliothèque de 2 000 jeux qui respecte le contrat. `formats.ts` décrit chaque fichier. |
| `outils/generer_donnees.py` | Refabrique les données factices à l'identique à partir des réponses brutes (`fixtures/catalogue/`). |
| `outils/collecter_*.py` | Les deux scripts qui ont interrogé Steam le 11/11/2026 (sans clé). |
| `outils/verifier_donnees.mjs` | Vérifie les 45 fichiers contre le contrat, plus 9 règles de cohérence. |

## La bibliothèque factice en chiffres

- 2 000 jeux : 1 960 jeux Steam réels et 40 jeux hors Steam (Epic, GOG, ajout manuel).
- 150 installés, 658 jamais lancés, 82 sans jaquette (pour dessiner la jaquette de secours), 20 masqués, 19 favoris.
- 1 454 sessions de jeu sur 112 jeux, depuis le 10 juillet 2026.
- 251 jeux avec leurs vrais succès en français (17 885 succès), progression inventée.
- 258 vraies annonces de 45 jeux, dont 41 en français et 217 en anglais.
- 48 amis inventés : 8 en jeu sur 6 jeux (dont un jeu Steam que nous n'avons pas et un jeu hors Steam), 8 en ligne, 4 absents, 2 occupés, 26 hors ligne ; 3 n'ont pas d'avatar. Les avatars sont des emblèmes dessinés par le générateur.
- 381 tags en français et en anglais.

## Vrai ou inventé

**Vrai** (réponses publiques de Steam du 11/11/2026) : titres, jaquettes, images, descriptions en français, éditeurs, tags, modes de jeu, avis, dates de sortie, classification PEGI, langues, liste et rareté des succès, annonces.

**Inventé** (tirage fixe, graine 20261111) : quels jeux sont installés, tailles, temps de jeu, sessions, succès débloqués, favoris, amis, profil « Nova », couleurs dominantes, nombre de joueurs en ligne.

## Adresses des images : vérifiées

Le 11/11/2026, 40 adresses tirées au hasard ont été demandées pour chaque famille d'images.

| Famille | Résultat |
| --- | --- |
| Jaquettes 600×900, hero, en-têtes | 40 sur 40 |
| Captures (miniature et pleine taille) | 40 sur 40 |
| Icônes de jeux, icônes de succès (couleur et grise) | 40 sur 40 |
| Images des annonces (`clan.akamai.steamstatic.com`) | 40 sur 40 |
| Logos, ancienne adresse fixe `logo.png` (893 anciens jeux seulement) | 39 sur 40 : l'interface doit prévoir le repli sur le titre |

Reste écrit de mémoire : la table des codes de langue des jeux, confirmée pour l'anglais, l'allemand, le français, l'italien et l'espagnol.

## Refaire les données

```
python3 outils/generer_donnees.py ../fixtures/catalogue donnees-factices
npm install
npm run verifier:donnees
```

## Choix du contrat à connaître

- Noms de champs en français, sans accent, en snake_case, comme le modèle de données du document de contexte (§14).
- Toute donnée d'internet arrive dans une enveloppe `Reponse` qui distingue chargement, vide, erreur et « cache affiché faute de mieux ».
- Un seul canal d'erreur (`ErreurApp`). Une lecture ne rejette jamais pour une raison de réseau, de clé ou de confidentialité.
- Retirés de la v0 pour rester simple : prix, bandes-annonces, compatibilité Steam Deck, note Metacritic, niveau Steam. Les réponses brutes les contiennent, on peut les remettre.

## Le socle du front-end (étape 3)

Ce socle ne dépend pas de l'apparence choisie. Il se lance avec Node 22 :

```
npm install
npm run dev        # ouvre http://localhost:1420 sur l'application (ajouter ?banc pour le banc d'essai du faux cœur)
npm run verifier   # types, tests, puis conformité des données au contrat
```

| Dossier | Rôle |
| --- | --- |
| `src/coeur/index.ts` | Le seul point d'entrée des écrans vers le cœur. Aujourd'hui le faux cœur, demain le cœur Rust derrière Tauri. |
| `src/coeur/faux/` | Le faux cœur : toutes les commandes et tous les événements du contrat, servis par les données factices. |
| `src/coeur/erreurs.ts` | La fabrique d'erreurs et la liste des codes, tenue à jour par le compilateur. |
| `src/i18n/` | Les textes en français et en anglais. Une clé oubliée dans une langue casse la compilation. |
| `src/formats/` | Nombres, durées, tailles et dates, écrits de la même façon partout. |
| `src/bibliotheque/logique.ts` | Filtres, compteurs, tri, rangée « Reprendre » et recherche rapide. Des fonctions pures, sans React : l'écran n'a plus qu'à les appeler. |
| `src/BancDEssai.tsx` | Page de diagnostic du faux cœur, sans apparence. Elle s'ouvre avec `?banc`. |

### Les scénarios

On choisit une situation dans l'adresse, par exemple `http://localhost:1420/?scenario=hors_ligne`.

| Scénario | Ce que l'interface reçoit |
| --- | --- |
| `normal` | Clé valide, en ligne, 2 000 jeux. Les jeux installés sont déjà en cache, les autres se chargent à la première visite. |
| `premier_lancement` | Accueil, pas de clé, et le scan du PC qui trouve les jeux petit à petit. |
| `sans_cle` | Les 150 jeux du PC seulement, succès sans progression, pas d'amis. |
| `cle_refusee` | Comme sans clé, avec l'erreur « clé refusée ». |
| `profil_prive` | Clé valide mais ni jeux possédés, ni progression, ni amis. |
| `hors_ligne` | Le cache s'affiche avec une erreur discrète, le reste est indisponible. |
| `mode_jeu` | Un jeu tourne, le réseau est en pause. |
| `quota_atteint` | Plus aucun appel possible aujourd'hui. |
| `source_coupee` | Les actualités sont en pause après des échecs répétés. |
| `bibliotheque_vide` | Aucun jeu et Steam absent. |
| `mise_a_jour` | Une nouvelle version est proposée. |

### Ce que le faux cœur imite

- Une lecture en ligne répond tout de suite, avec le cache ou avec « rien encore », puis l'événement `donnees_rafraichies` annonce l'arrivée du réseau.
- `lancer` démarre une session simulée de 12 secondes qui compte pour 48 minutes de jeu, met le temps à jour et débloque un succès.
- La clé API n'est jamais conservée : seul le verdict l'est. Dans la maquette, une clé de 32 caractères hexadécimaux est acceptée, sauf si elle commence par `0000`.
- Les dates des données sont décalées d'un nombre entier de jours, pour que « il y a 2 jours » reste vrai quel que soit le jour où l'on ouvre la maquette.

### Limites connues

- Les couleurs dominantes des données sont inventées, pas calculées depuis les images.
- Le tri des titres ne retire pas l'article « l' » collé au mot, ni dans le générateur ni dans le faux cœur, qui suit la même règle.
- `npm audit` signale une faille modérée dans une dépendance de l'outil de vérification des données. Elle ne concerne pas l'application.

## Les écrans (étape 3)

### Orientation « Carmin » (12/11/2026)

Ce dossier porte l'orientation **Carmin** : noir profond et rouge, épurée (références « Gameverse », « Stray », « Lethal Company »). Ce qui change par rapport à Salon et à Nuit :

- **La coque** (`src/coque/Coque.tsx`, `Colonne.tsx`) : à gauche une barre latérale à libellés (Accueil, Actualités, Amis, Profil, Ajouter un jeu, Paramètres) dont l'entrée allumée porte une gélule qui glisse, un voile rouge-rose qui respire en bas, et la carte « Ta collection » au dégradé carmin qui ondule ; en haut de la page, la recherche en champ (Ctrl K), deux chiffres et l'heure ; à droite, la colonne du profil, des amis en ligne (jeu en pastille, « Rejoindre ») et des jeux joués récemment (jauge de succès qui se remplit). Pas de barre d'état. La colonne s'efface sous 1 240 px, la barre latérale passe aux icônes sous 1 100 px.
- **La vitrine** (`src/bibliotheque/Scene.tsx`) : l'image du jeu dans une grande carte arrondie (tags en pastilles, titre, chiffres, Jouer, pile d'amis), la carte carmin et deux captures à droite, puis les points du carrousel : la vitrine passe seule au jeu suivant toutes les 9 secondes (minuterie carmin, en pause sous le pointeur). Dessous, les dernières parties en grandes jaquettes, nom et temps de jeu dessous, flèches pour défiler.
- **La grille** : gouttières de 28 px, titre et état sous chaque jaquette (56 px comptés par la fenêtre, `LEGENDE` dans `Grille.tsx`).
- **Le rouge comme lumière** : la fresque du fond est recolorée en carmin (jamais l'orange d'une image) ; l'affiche de la fiche et l'en-tête des succès baignent dans l'écarlate (`--lavis-rouge`). Les médailles sont rondes, plus hexagonales.
- **Jetons** : `--carmin`, `--ecarlate`, `--framboise`, `--voile-carmin`, `--graisse-titre`, `--interlettrage` ; plus de verre dépoli (`--verre: none`), des aplats noirs. Ni orange ni jaune, y compris pour l'alerte (rose pâle).

L'apparence est le thème « Nuit » (12/11/2026), qui remplace « Arène » : un client esport bleu nuit, des panneaux arrondis et vitrés, et le dégradé violet-rose du logo pour tout ce qui compte (l'orange des premières captures a été retiré le 12/11 : le logo n'en a pas). L'application s'appelle **Blazon** ; son sigle est le blason C1 (dégradé violet-rose), dessiné en SVG dans `src/composants/Marque.tsx`. Il n'y a qu'un thème.

- **Le rail**, tout à gauche : le blason en haut, puis les sept derniers jeux joués en icônes (un clic ouvre la fiche, une bulle donne le nom, une barre au dégradé marque le jeu ouvert, une pastille verte celui qui tourne), puis Ajouter un jeu et Paramètres.
- **Le menu**, à côté : le nom de l'application, les écrans (Bibliothèque, Actualités, Amis, Profil, Paramètres) avec leurs nombres, puis les collections (Installés, Favoris, Jamais lancés : elles choisissent le filtre de la bibliothèque, `src/bibliotheque/filtre.ts`), et une carte Ajouter un jeu. Il disparaît sous 1 100 px ; le rail reste.
- **La barre du haut** : la recherche (Ctrl K), quatre médailles hexagonales (heures jouées, succès débloqués, jeux installés, amis en jeu) et le profil.
- **La vitrine** de la bibliothèque : l'affiche arrondie (tags en pilules, amis qui y jouent, chiffres, Jouer), à droite une carte au dégradé violet-rose qui présente le jeu et deux captures, dessous des points qui font tourner les cinq derniers jeux toutes les 9 secondes (minuterie au dégradé, en pause sous le pointeur et quand l'ambiance est figée), puis les dernières parties en grandes jaquettes.
- **Trois formes, chacune son rôle.** Le rectangle arrondi (8 à 22 px) porte la structure. Le dégradé (`--degrade`) est réservé à ce qui compte : le bouton principal, l'élément choisi d'un groupe, l'entrée ouverte du menu, la carte vedette. Le cercle signale une personne ou un état.
- **Les couleurs** : fond bleu nuit (`--fond`, `--surface-1` à `3`), accent violet-rose, celui du blason (`--accent`, `--accent-2`, `--accent-3`, `--degrade`, `--degrade-vedette`), bleu et violet pour les lumières du fond, vert pour « en jeu ». Le texte sur le dégradé est blanc et gras.
- **La typographie**, façon Apple : une seule famille, Inter, avec sa taille optique (en grand, elle prend ses formes « Display »), la police libre la plus proche de SF Pro (qui passe devant sur un Mac). Titres en semi-gras (650), interlettrage presque neutre (`--serrage-titre`), texte en 400 avec un interligne généreux, petites étiquettes en capitales rares et peu espacées. Le propriétaire n'aime ni les écritures serrées ni les graisses noires.
- **Le cadre** : le **panneau d'amis** à droite (ouvert d'office à partir de 1 800 px, sinon une colonne d'avatars ; il disparaît sous 1 100 px) et la **barre d'état** en bas. L'écran Amis n'a pas de panneau.
- **L'écran Amis** part des jeux, pas d'une liste. Chaque partie en cours est une bannière à la jaquette du jeu, et les amis qui y jouent sont regroupés dessus ; la partie où plusieurs amis jouent ensemble vient en premier, avec le liseré au dégradé. Les rangées sont toujours pleines (`src/composants/rangees.ts` calcule les largeurs). Une bannière large montre la jaquette entière et porte l'action qui compte (Jouer, Installer, ou Voir dans le magasin Steam) ; seule sur sa rangée, elle passe en panorama, les amis dans une colonne à droite. Dessous viennent les amis connectés, en plaques (statut, « Ami depuis »), puis les hors ligne, en lignes discrètes. Un clic sur un ami ouvre partout le même menu (message, profil Steam, fiche du jeu). `src/profil/Portrait.tsx` dessine l'avatar avec sa pastille de statut, et l'anneau au dégradé de ceux qui jouent.
- **Le fond vivant** (`src/coque/Decor`) : une poussière d'étoiles, une lumière à la couleur du dernier jeu mis à l'écran, une bleue, une violette et un reflet rose, et dessous **la fresque** : l'image de ce jeu, immense, floue (70 px) et saturée, franche sur la bibliothèque, la fiche et les succès, discrète ailleurs (`etat/ambiance.ts`, `imageAmbiance`).
- **Le verre dépoli** : les cadres `biseau`, les cartes de `Page` et la classe globale `verre` floutent ce qui est derrière eux (`--verre`, `--fond-verre`) et laissent passer les couleurs de la fresque et de l'affiche.
- **La profondeur** : `--panneau` est un verre bleuté plus clair en haut, `--lisere` le filet lumineux d'un cadre ; la classe globale `biseau` (nom hérité d'Arène) pose ce cadre arrondi, et `--biseau-marque: var(--degrade)` lui donne un liseré au dégradé.

### Le mouvement

Trois familles, toutes réglées par des jetons, donc toutes coupées d'un coup par le réglage Animations ou par Windows :

| Famille | Ce qui bouge | Jetons |
| --- | --- | --- |
| Réponse | Survols, appuis : voile qui remplit un bouton, carte holographique (elle penche vers le pointeur, une pellicule irisée et un éclat suivent la main, son image floutée s'allume dessous, les autres cartes s'effacent), parallaxe de l'affiche (l'image glisse à l'opposé du pointeur, le texte avec lui, une lumière le suit), loupe du rail (les icônes grossissent en vague selon leur distance au pointeur). `src/composants/pointeur.ts` pose les variables `--px --py --rx --ry --gx --gy`, une fois par image. | `--duree-courte`, `--duree`, `--holo`, `--eclat-holo`, `--flou-halo` |
| Entrée | Un écran qui arrive : en-tête, sections et cartes montent l'un après l'autre (classe globale `cascade`), les chiffres comptent jusqu'à leur valeur (`NombreAnime`), les jauges se remplissent, le trait de l'onglet glisse d'un onglet à l'autre, un volet en biais découvre la nouvelle image de l'affiche, et la jaquette cliquée s'envole et s'agrandit jusqu'à devenir l'affiche de la fiche (`src/coque/envol.ts`, View Transitions, nom `jaquette-envol`). | `--duree-longue`, `--pas-cascade`, `--duree-compte` |
| Ambiance | Ce qui vit sans qu'on y touche : lumières du fond, dérive de l'image de l'affiche, braises, faisceau, reflet et halo du bouton Jouer, dégradé de la carte vedette qui glisse (`moirer`) et son halo qui tourne, vitrine qui passe au jeu suivant. | `--duree-ambiance`, `--duree-balayage`, `--duree-moire`, `--cadence-ambiance`, `--lecture-ambiance` |

Règles à tenir pour que cela reste fluide :

1. **N'animer que `transform` et `opacity`**, sauf le fond vivant, qui anime la position de ses lumières huit fois par seconde seulement (`--cadence-ambiance`).
2. **Une seule couche fixe derrière la page** (plus la fresque, immobile : elle ne se recalcule qu'au changement de jeu). Le fond vivant est un seul élément opaque : chaque couche translucide de plus, fixe derrière un contenu qui défile, se paie à chaque image. Mesuré : quatre couches séparées faisaient tomber le défilement de 60 à 35 images par seconde.
3. **Pas de `backdrop-filter` sur une grande surface** posée devant le fond vivant (panneau d'amis, barre d'état) : le flou serait recalculé à chaque image. Le verre dépoli est réservé aux panneaux de taille moyenne (cadres, cartes) ; non mesuré sur une machine réelle depuis son ajout.
4. **Pas de perspective au repos.** Une carte de la grille ne reçoit sa transformation 3D que sous le pointeur.
5. **Une animation d'entrée se termine sans laisser de trace** : `animation-fill-mode: backwards`, jamais `both`. Sinon l'élément garde un contexte d'empilement et un menu ouvert passe sous la section suivante.
6. **L'ambiance se fige** pendant une partie et quand la fenêtre n'est plus devant (`data-ambiance="figee"`, posé par `Decor`) : le launcher ne prend rien au jeu.

Les images d'inspiration (tableau de bord esport bleu nuit, vitrine d'un client de jeu) n'ont fourni que des principes : rail d'icônes, verre bleuté, dégradés chauds, médailles hexagonales. Aucun logo, illustration ni texte n'en est repris.

| Dossier | Rôle |
| --- | --- |
| `src/theme/` | `jetons.css` : toutes les couleurs, rayons, espaces et durées. `base.css` : remise à plat, anneau de focus, trame du fond, classes communes (`titre-section`, `sur-titre`, `hors-ecran`, `chiffres`, `biseau`, `cascade`), changement d'écran (View Transitions). |
| `src/etat/` | `application.ts` : l'état partagé (état du cœur, paramètres, jeux) tenu à jour par les événements, et les actions (`lancerLeJeu`, `definirFavori`, `modifierLesParametres`, `tenter`, `signaler`). `ressource.ts` : `useReponse`, qui lit une donnée en ligne et dit lequel des quatre états dessiner. `detail.ts`, `maintenant.ts`. |
| `src/navigation/` | Les adresses (`routes.ts`, fonctions pures) et `Lien`, `naviguer`, `revenir`, `useRoute`. |
| `src/composants/` | Les pièces communes : `Marque`, `Bouton`, `BoutonJouer`, `Menu`, `Jaquette`, `Affiche` (et `titre.ts`, qui réduit un titre long), `NombreAnime` (et `compte.ts`), `Page`, `Section`, `Carte`, `Formulaire` (ligne de réglage, interrupteur, champ, segments), `Dialogue`, `Visionneuse`, `Etats` (message, erreur pleine, note, squelette), `Avis`, `Icone`, `fenetre.ts` (longues listes), `rangees.ts` (rangées toujours pleines : combien d'éléments par rangée, et quelle largeur pour chacun). |
| `src/coque/` | Le rail des derniers jeux, le menu, la barre du haut et ses médailles, le fond vivant (`Decor`), le panneau d'amis (`PanneauAmis`), la barre d'état (`Pied`), les bandeaux d'état, la recherche rapide (Ctrl K). |
| `src/steam/` | Le formulaire de la clé Steam, partagé par le premier lancement et les paramètres. La clé n'est jamais gardée ni écrite dans un journal. |
| `src/bibliotheque/`, `src/fiche/`, `src/succes/`, `src/actualites/`, `src/amis/`, `src/profil/`, `src/parametres/`, `src/ajout/`, `src/accueil/` | Un dossier par écran. |

### Les écrans

| Écran | Adresse | Ce qu'il montre |
| --- | --- | --- |
| Bibliothèque | `#/` et `#/?q=…` | Le jeu à reprendre en grand, les dernières parties, la grille ou la liste des 2 000 jeux, filtres, tri, recherche. |
| Fiche d'un jeu | `#/jeu/49` | Image du jeu, Jouer ou Installer, chiffres, description, captures, aperçu des succès, sessions, actualités, détails. |
| Succès | `#/jeu/49/succes` | Tous les succès d'un jeu, filtre Tous / Débloqués / À débloquer, succès secrets cachés par défaut. |
| Actualités | `#/actualites` | Le fil des jeux installés ou joués récemment, par jour, avec un lecteur d'annonce. |
| Amis | `#/amis` | Ce qui se joue en ce moment (une bannière par jeu, les amis regroupés dessus), puis les amis connectés, puis les hors ligne ; filtre par pseudo ou par jeu. |
| Profil | `#/profil` | Le compte suivi, la bibliothèque en chiffres, les cinq jeux les plus joués, la répartition par source. |
| Paramètres | `#/parametres`, `#/parametres/steam`, `/bibliotheque`, `/donnees`, `/a_propos` | Langue, animations, démarrage ; clé et compte Steam ; dossiers, analyse, affichage, jeux masqués ; sources en ligne, vie privée, tout effacer ; version, mise à jour, niveau de données. |
| Ajout manuel | `#/ajout` | Coller ou déposer un `.exe`, `.lnk` ou `.url`, vérifier l'aperçu, corriger le titre, ajouter. |
| Premier lancement | `/?scenario=premier_lancement` | Quatre étapes : bienvenue et langue, analyse du PC en direct, clé Steam facultative, récapitulatif. |

Tous ont été ouverts dans Chromium, en français et en anglais, sans erreur de console. Pour voir l'anglais : Paramètres, Général, Langue.

### Écrire ou modifier un écran

1. **Un écran ne parle au cœur que par `src/coeur`** (`import { coeur } from '../coeur'`) et par `src/etat`. Jamais de `fetch`, jamais d'import depuis `src/coeur/faux/`.
2. **Les quatre états sont obligatoires** : chargement (`Squelette`), vide (`Message`), erreur (`ErreurPleine` s'il n'y a rien à montrer, `Note` à côté d'un contenu), données. `useReponse` donne `vue`, `donnees`, `erreur`, `en_cours`, `reessayer`. `aSignaler` évite de répéter ce que le bandeau du haut dit déjà. Le bouton « Réessayer » ne s'affiche que si `vautUnNouvelEssai(erreur)` le dit : pas pour le quota du jour, qui redonnerait la même réponse.
3. **Aucun texte en dur.** Tout passe par `useTexte()` : `t('cle')`, `tp('base', nombre)` pour un accord en nombre (clés `base.un` et `base.autre`), `te(erreur)` pour une erreur du cœur. On ajoute les textes dans les deux langues d'un coup :
   ```
   node outils/ajouter_textes.mjs <<'FIN'
   amis.titre ¦ Amis ¦ Friends
   FIN
   ```
   Le français tutoie le joueur. Une clé absente casse la compilation.
4. **Aucune couleur, aucun rayon, aucune durée en dur.** Les styles vont dans un fichier `.module.css` à côté du composant et n'utilisent que les variables de `jetons.css`. Pas de style en ligne, sauf pour une valeur calculée. Cela vaut aussi pour les ombres, les voiles sur les images et les animations en boucle (`--ombre-flottante`, `--rideau`, `--duree-tour`, `--lueur`) : aucun `rgb(` ni `#` en dehors de `jetons.css`. Un cadre à angles coupés s'obtient par la classe globale `biseau` (deux calques sous le contenu) : jamais de `clip-path` sur un élément qui peut recevoir le focus, son anneau serait découpé avec lui.
5. **Nombres, durées, dates, tailles** : uniquement par `src/formats`.
6. **Accessibilité** : vrais éléments (`button`, `a`, `dialog`, listes), cible de 44 px au moins, nom lisible pour tout bouton sans texte (`aria-label`), image décorative avec `alt=""`, rien qui ne soit atteignable qu'au survol. Le focus clavier est géré par `base.css` : ne pas le retirer.
7. **Une action qui peut échouer** passe par `tenter(() => coeur.…)` : l'échec devient un message en bas de l'écran, traduit, sans texte brut. Seule exception : un formulaire qui doit écrire l'erreur sous son champ (ajout manuel, clé Steam) attrape l'erreur lui-même et la traduit avec `te`.
8. **La logique se teste sans React** : tri, filtres et calculs vont dans un fichier `logique.ts` de fonctions pures, avec ses tests.

Pour regarder un écran : `npm run dev`, puis l'adresse de l'écran (`#/`, `#/jeu/49`, `#/jeu/49/succes`, `#/actualites`, `#/amis`, `#/profil`, `#/parametres`, `#/ajout`), précédée du scénario voulu (`/?scenario=hors_ligne#/amis`).

### Mesures (2 000 jeux, version de production, Chromium)

- Premières jaquettes affichées en 430 ms, dont la lecture du fichier de données factices.
- Défilement de la grille, toutes animations en marche : 59 images par seconde ; au repos sur la bibliothèque : 58. Mesuré sans carte graphique (rendu logiciel), donc au pire.
- Changement de filtre : moins de 35 ms.
- La grille et la liste sont fenêtrées (`src/composants/fenetre.ts`) : une soixantaine de cartes existent à la fois, au lieu de 14 600 éléments. Sans fenêtrage, revenir au filtre « Tous » prenait 200 ms.

### Limites connues des écrans

- Les descriptions, les succès et la plupart des annonces des données factices n'existent qu'en français : en anglais, l'interface change mais ces contenus restent en français.
- Dans un navigateur, déposer un fichier ne donne que son nom. Le chemin complet arrivera par l'événement de glisser-déposer de la fenêtre Tauri.
- Aucun lecteur d'écran réel n'a été essayé : seuls le parcours au clavier, les noms des boutons et les zones annoncées ont été contrôlés.
- Rien n'a encore été ouvert dans WebView2 : les contrôles ont été faits dans Chromium, le même moteur.
- La barre de titre de la fenêtre n'est pas dessinée : elle dépend de la coquille Tauri.

## Ce qui manque au contrat (à décider avant le cœur Rust)

Relevé en construisant les écrans. Rien de bloquant pour la maquette, tout est à trancher pour la version 0.3 du contrat.

1. **Sélecteur de Windows.** Aucune commande pour ouvrir le sélecteur de fichier ou de dossier : aujourd'hui le joueur colle un chemin. Il manque aussi le chemin d'un fichier déposé dans la fenêtre, et un moyen de vérifier qu'un dossier existe.
2. **Analyse du PC.** `EtatScan` ne dit pas quelle source est en cours (elle n'arrive que par les événements), `scan_termine` ne donne pas le détail par source, et seul `steam_installe` existe : impossible de dire qu'Epic Games ou GOG est absent.
3. **Mises à jour.** Pas de commande « chercher une mise à jour », pas de date de dernière vérification, pas de « redémarrer maintenant » quand la version est prête.
4. **`tout_effacer`.** Le contrat ne dit pas ce qui est effacé (réglages, jeux masqués). L'écran reprend le comportement du faux cœur.
5. **Clé Steam.** Le comportement en mode jeu n'est pas défini : vérifiée tout de suite, ou à la fin de la partie.
6. **Comptes Steam.** `CompteSteam` ne dit pas quel compte est connecté dans Steam en ce moment, et `choisir_le_compte` ne renvoie pas le nouveau profil.
7. **Erreurs.** `details.id_jeu` de `deja_present` n'est pas typé, et `analyser_un_chemin` ne vérifie pas que le fichier existe.
8. **Actualités.** Le cœur ne dit pas quels jeux le fil couvre, et la pagination par date stricte (`avant`) peut perdre deux annonces publiées à la même seconde : l'écran redemande donc les N plus récentes.
9. **Langue.** Au changement de langue, le cœur devrait annoncer `donnees_rafraichies` pour les fiches et les succès, afin que les écrans ouverts relisent leurs textes.
10. **Profil.** Rien ne signale directement que la clé manque : l'écran le déduit de l'erreur et de `jeux_possedes_erreur`.
11. **Panneau d'amis.** Son état (ouvert ou réduit) n'est gardé que le temps de la session : il manque un réglage dans `Parametres.affichage`.
12. **Jeu en cours d'un ami.** `JeuEnCoursAmi` a reçu `jaquette` et `couleur_dominante` le 12/11/2026, pour que l'écran Amis montre aussi les jeux que nous n'avons pas : le cœur devra les demander au magasin Steam avec `steam_appid`. À confirmer dans la version 0.3. Rejoindre la partie d'un ami n'est pas prévu : le bouton lance le jeu, rien de plus.

## Version artefact (test sur iPad ou navigateur)

`outils/artefact/construire.sh <sortie>` construit l'app avec `VITE_ARTEFACT=1` et y joint les images : une page d'artefact n'a le droit de charger aucune image venue d'un autre site. `outils/artefact/images.py` télécharge une partie des images Steam (toutes les jaquettes et icônes, hero, logos, en-têtes et 4 captures pour les jeux installés ou récents, les icônes de succès de 70 jeux, 160 images d'actualités), les réduit en WebP et les range dans des paquets de 1,5 Mo avec un index. `src/artefact/images.ts` remplace les adresses Steam des données par une image d'attente et charge la tranche du paquet quand l'image approche de l'écran ; une image non emportée tombe sur le repli dessiné. Hors de cette version, rien ne change. Les paquets dépassent 64 Mo au total : publier en deux fois. Les styles et les polices latines sont mis dans la page, car l’hôte refuse les feuilles de styles externes. Pour comparer avec Arène (/mnt/project-files/launcher-arene/, construit de la même façon) : `python3 outils/artefact/page_double.py <dist_nuit> <dist_arene>` fait une seule page avec un bouton Nuit / Arène.
