import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icone, type NomDIcone } from "../composants/Icone";
import { Sigle } from "../composants/Marque";
import { PileDAvis } from "../composants/Avis";
import { coeur } from "../coeur";
import { useReponse } from "../etat/ressource";
import { useTexte } from "../i18n/react";
import { useMaintenant } from "../etat/maintenant";
import { useApplication } from "../etat/application";
import { NombreAnime } from "../composants/NombreAnime";
import { formaterNombre } from "../formats";
import { ACCUEIL, Lien, useRoute, type Route } from "../navigation";
import { BIBLIOTHEQUE } from "../navigation/routes";
import { Recents } from "./Recents";
import { Bandeaux } from "./Bandeaux";
import { Colonne } from "./Colonne";
import { Decor } from "./Decor";
import { installerLEnvol } from "./envol";
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

/** Une entrée de la barre latérale : une icône et son libellé. L'entrée allumée porte une gélule qui glisse d'une entrée à l'autre. */
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
      <span className={styles.entreeIcone}>
        <Icone nom={icone} taille={20} />
      </span>
      <span className={styles.entreeNom}>{children}</span>
      {pastille}
    </Lien>
  );
}

/** Au bas de la barre latérale, un seul bouton pour ajouter un jeu : sombre, un « + » rouge. */
function BoutonAjout({ actif }: { actif: boolean }) {
  const { t } = useTexte();
  return (
    <Lien className={`${styles.carteBouton} ${styles.ajoutSeul}`} vers={{ ecran: "ajout" }} aria-current={actif ? "page" : undefined}>
      <Icone nom="plus" taille={16} />
      {t("coque.ajouter")}
    </Lien>
  );
}

/** Deux chiffres de la bibliothèque dans la barre du haut : une icône rouge dans un rond, un nombre. */
function Medailles({ enJeu }: { enJeu: number | null }) {
  const { t, langue } = useTexte();
  const jeux = useApplication((a) => a.jeux);
  const chiffres = useMemo(() => {
    if (jeux === null) return null;
    let minutes = 0;
    let succes = 0;
    let installes = 0;
    for (const jeu of jeux) {
      if (jeu.masque) continue;
      minutes += jeu.temps.minutes_total;
      succes += jeu.succes?.debloques ?? 0;
      if (jeu.installe) installes += 1;
    }
    return { heures: Math.round(minutes / 60), succes, installes };
  }, [jeux]);
  if (chiffres === null) return null;
  const nombre = (n: number) => formaterNombre(n, langue);
  const liste: {
    cle: string;
    icone: NomDIcone;
    nom: string;
    valeur: number;
  }[] = [
    {
      cle: "heures",
      icone: "horloge",
      nom: t("coque.heures"),
      valeur: chiffres.heures,
    },
    {
      cle: "succes",
      icone: "trophee",
      nom: t("coque.succes"),
      valeur: chiffres.succes,
    },
  ];
  if (enJeu !== null)
    liste.push({
      cle: "en_jeu",
      icone: "manette",
      nom: t("coque.en_jeu"),
      valeur: enJeu,
    });
  return (
    <dl className={styles.medailles} aria-label={t("coque.statistiques")}>
      {liste.map((m) => (
        <div key={m.cle} className={styles.medaille} title={m.nom}>
          <dt className="hors-ecran">{m.nom}</dt>
          <span className={styles.puceIcone} aria-hidden="true">
            <Icone nom={m.icone} taille={16} />
          </span>
          <dd className="chiffres">
            <NombreAnime valeur={m.valeur} format={nombre} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** L'heure, comme sur une console : discrète, à côté du profil. */
function Horloge() {
  const { langue } = useTexte();
  const maintenant = useMaintenant();
  return (
    <time
      className={`${styles.horloge} chiffres`}
      dateTime={maintenant.toISOString()}
    >
      {maintenant.toLocaleTimeString(langue, {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </time>
  );
}

/**
 * Orientation « Carmin » : noir profond et rouge, épurée. À gauche, une barre latérale à libellés
 * (la marque, les écrans, Paramètres et la carte de la collection, sur un voile rouge-rose qui monte du
 * bas) ; au centre, la recherche et la page ; à droite, la colonne des amis en ligne et des jeux joués
 * récemment. Pas de barre d'état : le cadre reste nu, le rouge est la seule lumière.
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

  useEffect(() => installerLEnvol(), []);

  // La gélule de l'entrée allumée glisse d'une entrée à l'autre, avec un léger rebond.
  const menu = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = menu.current;
    if (nav === null) return;
    const placer = () => {
      const actif = nav.querySelector<HTMLElement>('[aria-current="page"]');
      nav.style.setProperty("--gelule-y", `${actif?.offsetTop ?? 0}px`);
      nav.style.setProperty("--gelule-h", `${actif?.offsetHeight ?? 0}px`);
      nav.toggleAttribute("data-sans-gelule", actif === null);
    };
    placer();
    const observateur = new ResizeObserver(placer);
    observateur.observe(nav);
    return () => observateur.disconnect();
  }, [rubrique]);

  // La colonne des amis se replie en un rail de portraits ; le choix est gardé d'une visite à l'autre.
  const [replie, setReplie] = useState(() => {
    try {
      return localStorage.getItem("blazon-carmin-colonne") === "repliee";
    } catch {
      return false;
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
            className={styles.marque}
            vers={ACCUEIL}
            aria-label={t("app.nom")}
          >
            <Sigle />
            <span className={styles.nom} aria-hidden="true">
              {t("app.nom")}
            </span>
          </Lien>
          <nav
            ref={menu}
            className={styles.menu}
            aria-label={t("coque.navigation")}
          >
            <span className={styles.indicateur} aria-hidden="true" />
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
            className={styles.recherche}
            onClick={ouvrirLaRecherche}
          >
            <Icone nom="recherche" taille={18} />
            <span className={styles.rechercheTexte}>
              {t("recherche.champ")}
            </span>
            <kbd className={styles.raccourci}>{t("coque.raccourci")}</kbd>
          </button>
          <div className={styles.outils}>
            <Medailles enJeu={null} />
            <Horloge />
          </div>
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
          className={styles.languette}
          onClick={basculerColonne}
          aria-expanded={!replie}
          aria-label={replie ? t("carmin.colonne.deplier") : t("carmin.colonne.replier")}
          title={replie ? t("carmin.colonne.deplier") : t("carmin.colonne.replier")}
        >
          <Icone nom="chevron_droit" taille={14} />
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
