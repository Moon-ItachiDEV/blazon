import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icone, type NomDIcone } from "../composants/Icone";
import { Sigle } from "../composants/Marque";
import { PileDAvis } from "../composants/Avis";
import { coeur } from "../coeur";
import { useReponse } from "../etat/ressource";
import { useTexte } from "../i18n/react";
import { ACCUEIL, Lien, useRoute, type Route } from "../navigation";
import { BIBLIOTHEQUE } from "../navigation/routes";
import { Recents } from "./Recents";
import { Bandeaux } from "./Bandeaux";
import { Colonne } from "./Colonne";
import { Decor } from "./Decor";
import { ouvrirLaRecherche, RechercheRapide } from "./RechercheRapide";
import styles from "./Coque.module.css";

type Rubrique =
  | "accueil"
  | "ajout"
  | "bibliotheque"
  | "actualites"
  | "amis"
  | "parametres"
  | "profil";

/**
 * L'entrée allumée pour chaque écran. L'accueil, c'est la vitrine ; la bibliothèque, c'est toute la
 * collection, une recherche, et la fiche ou les succès d'un jeu (on y arrive depuis la collection).
 */
function rubriqueDe(route: Route): Rubrique {
  if (route.ecran === "bibliotheque" && route.recherche === "" && route.tout !== true) return "accueil";
  switch (route.ecran) {
    case "actualites":
    case "amis":
    case "parametres":
    case "profil":
    case "ajout":
      return route.ecran;
    default:
      return "bibliotheque";
  }
}

/** Une entrée de la barre latérale : une icône et son libellé. L'entrée ouverte est plus claire, avec un court repère rouge. */
function Entree({
  vers,
  actif,
  icone,
  children,
  pastille,
}: {
  vers: Route;
  actif: boolean;
  icone: NomDIcone;
  children: ReactNode;
  pastille?: ReactNode;
}) {
  return (
    <Lien
      className={styles.entree}
      vers={vers}
      aria-current={actif ? "page" : undefined}
    >
      <Icone nom={icone} taille={18} />
      <span className={styles.entreeNom}>{children}</span>
      {pastille}
    </Lien>
  );
}

/** Au bas de la barre latérale, le seul bouton de la coque : ajouter un jeu. */
function BoutonAjout({ actif }: { actif: boolean }) {
  const { t } = useTexte();
  return (
    <Lien className={styles.ajout} vers={{ ecran: "ajout" }} aria-current={actif ? "page" : undefined}>
      <Icone nom="plus" taille={16} />
      <span className={styles.entreeNom}>{t("coque.ajouter")}</span>
    </Lien>
  );
}

/**
 * La coque : à gauche, une barre latérale à libellés (la marque, les écrans, les derniers jeux,
 * Paramètres et « Ajouter un jeu ») ; au centre, la recherche et la page ; à droite, la colonne des
 * amis, repliée en un rail de portraits. Dans l'exécutable, le haut de la coque sert aussi de barre de
 * titre : on déplace la fenêtre par là, et les boutons de Windows sont posés dans son coin droit.
 */
export function Coque({ children }: { children: ReactNode }) {
  const { t, tp } = useTexte();
  const route = useRoute();
  const rubrique = rubriqueDe(route);
  const page = useRef<HTMLElement>(null);
  const amis = useReponse(() => coeur.amis(), "amis", null, "amis");
  const profil = useReponse(() => coeur.profil(), "profil", null, "profil");
  const enJeu =
    amis.donnees?.filter((ami) => ami.statut === "en_jeu").length ?? 0;

  const premiere = useRef(true);
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false;
      return;
    }
    page.current?.focus({ preventScroll: true });
  }, [route]);


  // La colonne des amis se replie en un rail de portraits ; le choix est gardé d'une visite à l'autre.
  const [replie, setReplie] = useState(() => {
    try {
      // Épuré : repliée tant que le joueur ne l'a pas ouverte lui-même.
      return localStorage.getItem("blazon-carmin-colonne") !== "ouverte";
    } catch {
      return true;
    }
  });
  const basculerColonne = () =>
    setReplie((avant) => {
      try {
        localStorage.setItem("blazon-carmin-colonne", avant ? "ouverte" : "repliee");
      } catch {
        /* rien à garder */
      }
      return !avant;
    });

  // La barre se teinte dès que la page défile : transparente sur l'image du jeu, noire sur une liste.
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const suivre = () => setDefile(window.scrollY > 24);
    suivre();
    window.addEventListener("scroll", suivre, { passive: true });
    return () => window.removeEventListener("scroll", suivre);
  }, []);

  return (
    <>
      <Decor />
      <button
        type="button"
        className={styles.evitement}
        onClick={() => page.current?.focus()}
      >
        {t("coque.aller_au_contenu")}
      </button>
      <div className={styles.application} data-colonne-repliee={replie ? "" : undefined}>
        <aside className={styles.laterale}>
          <Lien
            className={`${styles.marque} hors-poignee`}
            vers={ACCUEIL}
            aria-label={t("app.nom")}
          >
            <Sigle />
            <span className={styles.nom} aria-hidden="true">
              {t("app.nom")}
            </span>
          </Lien>
          <nav className={styles.menu} aria-label={t("coque.navigation")}>
            <Entree
              vers={ACCUEIL}
              actif={rubrique === "accueil"}
              icone="maison"
            >
              {t("coque.accueil")}
            </Entree>
            <Entree
              vers={BIBLIOTHEQUE}
              actif={rubrique === "bibliotheque"}
              icone="grille"
            >
              {t("carmin.bibliotheque.titre")}
            </Entree>
            <Entree
              vers={{ ecran: "actualites" }}
              actif={rubrique === "actualites"}
              icone="journal"
            >
              {t("coque.actualites")}
            </Entree>
            <Entree
              vers={{ ecran: "amis" }}
              actif={rubrique === "amis"}
              icone="amis"
              pastille={
                enJeu > 0 ? (
                  <>
                    <span
                      className={`${styles.pastille} chiffres`}
                      aria-hidden="true"
                    >
                      {enJeu}
                    </span>
                    <span className="hors-ecran">
                      , {tp("coque.amis_en_jeu", enJeu)}
                    </span>
                  </>
                ) : undefined
              }
            >
              {t("coque.amis")}
            </Entree>
            <Entree
              vers={{ ecran: "profil" }}
              actif={rubrique === "profil"}
              icone="utilisateur"
            >
              {t("coque.profil")}
            </Entree>
            <Recents />
            <span className={styles.ecart} aria-hidden="true" />
            <Entree
              vers={{ ecran: "parametres", section: "general" }}
              actif={rubrique === "parametres"}
              icone="reglages"
            >
              {t("coque.parametres")}
            </Entree>
          </nav>
          <BoutonAjout actif={rubrique === "ajout"} />
        </aside>

        <header className={styles.barre} data-defile={defile ? "" : undefined}>
          <button
            type="button"
            className={`${styles.recherche} hors-poignee`}
            onClick={ouvrirLaRecherche}
          >
            <Icone nom="recherche" taille={16} />
            <span className={styles.rechercheTexte}>
              {t("recherche.champ")}
            </span>
            <kbd className={styles.raccourci}>{t("coque.raccourci")}</kbd>
          </button>
        </header>

        <main
          ref={page}
          className={styles.page}
          data-ecran={route.ecran}
          tabIndex={-1}
        >
          <Bandeaux />
          {children}
        </main>

        <Colonne
          amis={rubrique === "amis" ? null : (amis.donnees ?? null)}
          tousLesAmis={amis.donnees?.length ?? 0}
          profil={profil.donnees ?? null}
          replie={replie}
        />
        <button
          type="button"
          className={`${styles.languette} hors-poignee`}
          onClick={basculerColonne}
          aria-expanded={!replie}
          aria-label={replie ? t("carmin.colonne.deplier") : t("carmin.colonne.replier")}
          title={replie ? t("carmin.colonne.deplier") : t("carmin.colonne.replier")}
        >
          <Icone nom="chevron_droit" taille={12} />
        </button>
      </div>
      <RechercheRapide />
      <PileDAvis />
    </>
  );
}

export function Ouverture() {
  const { t } = useTexte();
  return (
    <div
      className={styles.ouverture}
      role="status"
      aria-label={t("coque.ouverture")}
    >
      <Decor />
      <Sigle />
    </div>
  );
}
