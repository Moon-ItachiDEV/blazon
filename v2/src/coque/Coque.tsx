import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { filtreChoisi } from '../bibliotheque/filtre';
import { compter, FILTRES, type Filtre } from '../bibliotheque/logique';
import { PileDAvis } from '../composants/Avis';
import { Icone, type NomDIcone } from '../composants/Icone';
import { Marque, Sigle } from '../composants/Marque';
import { Menu } from '../composants/Menu';
import { coeur } from '../coeur';
import { useApplication } from '../etat/application';
import { useMagasin } from '../etat/magasin';
import { useReponse } from '../etat/ressource';
import { formaterNombre } from '../formats';
import { useTexte } from '../i18n/react';
import { ACCUEIL, declarerLeDefileur, Lien, naviguer, useRoute, type Route } from '../navigation';
import { BIBLIOTHEQUE } from '../navigation/routes';
import { Avatar } from '../profil/Avatar';
import { Bandeaux } from './Bandeaux';
import { Decor } from './Decor';
import { installerLEnvol } from './envol';
import { installerLesEffets } from './effets';
import { ArtFlou, Fond } from './Fond';
import { ouvrirLaRecherche, RechercheRapide } from './RechercheRapide';
import styles from './Coque.module.css';

type Rubrique = 'accueil' | 'ajout' | 'bibliotheque' | 'actualites' | 'amis' | 'parametres' | 'profil';

function rubriqueDe(route: Route): Rubrique {
  if (route.ecran === 'bibliotheque' && route.recherche === '' && route.tout !== true) return 'accueil';
  switch (route.ecran) {
    case 'actualites':
    case 'amis':
    case 'parametres':
    case 'profil':
    case 'ajout':
      return route.ecran;
    default:
      return 'bibliotheque';
  }
}

function Entree({ vers, actif, icone, children, fin }: { vers: Route; actif: boolean; icone: NomDIcone; children: ReactNode; fin?: ReactNode }) {
  return (
    <Lien className={styles.entree} vers={vers} aria-current={actif ? 'page' : undefined} data-entree="">
      <Icone nom={icone} taille={20} />
      <span className={styles.entreeNom}>{children}</span>
      {fin}
    </Lien>
  );
}

const NOMS_DE_FILTRE: Record<Filtre, 'bibliotheque.tous_les_jeux' | 'filtre.installes' | 'filtre.favoris' | 'filtre.jamais_lances'> = {
  tous: 'bibliotheque.tous_les_jeux',
  installes: 'filtre.installes',
  favoris: 'filtre.favoris',
  jamais_lances: 'filtre.jamais_lances',
};

/** Le profil du joueur en haut de la barre latérale (Dota 2) : grand avatar cerclé de son statut. */
function Joueur({ pseudo, avatar }: { pseudo: string | null; avatar: string | null }) {
  const { t } = useTexte();
  return (
    <Lien className={styles.joueur} vers={{ ecran: 'profil' }} aria-label={pseudo === null ? t('coque.profil') : t('coque.profil_de', { pseudo })}>
      <span className={styles.joueurAvatar}>
        <Avatar image={avatar} pseudo={pseudo} taille={58} />
      </span>
      <span className={styles.joueurTexte}>
        <span className={styles.joueurPseudo}>{pseudo ?? t('coque.profil')}</span>
        <span className={styles.joueurStatut}>
          <span className={styles.point} />
          {t('amis.statut.en_ligne')}
        </span>
      </span>
    </Lien>
  );
}

/**
 * La coque de la V2 : une grande fenêtre arrondie qui flotte sur un fond travaillé. À gauche, la barre
 * latérale (marque, joueur, navigation avec la Bibliothèque dépliable, Paramètres en bas) ; la barre
 * bleue de l'entrée active glisse sur le bord gauche de la fenêtre. En haut, la recherche et le profil.
 * Derrière tout, l'art du jeu affiché, flouté et teinté : la fenêtre en prend la couleur.
 */
export function Coque({ children }: { children: ReactNode }) {
  const { t, tp, langue } = useTexte();
  const route = useRoute();
  const rubrique = rubriqueDe(route);
  const page = useRef<HTMLElement>(null);
  const amis = useReponse(() => coeur.amis(), 'amis', null, 'amis');
  const profil = useReponse(() => coeur.profil(), 'profil', null, 'profil');
  const enJeu = amis.donnees?.filter((ami) => ami.statut === 'en_jeu').length ?? 0;
  const jeux = useApplication((a) => a.jeux);
  const montrerMasques = useApplication((a) => a.parametres?.affichage.montrer_les_jeux_masques ?? false);
  const comptes = useMemo(() => (jeux === null ? null : compter(jeux, montrerMasques)), [jeux, montrerMasques]);
  const filtre = useMagasin(filtreChoisi, (f) => f);
  const [deplie, setDeplie] = useState(true);
  const dansLaBibliotheque = route.ecran === 'bibliotheque' && route.tout === true;

  useLayoutEffect(() => {
    declarerLeDefileur(page.current);
    return () => declarerLeDefileur(null);
  }, []);

  const premiere = useRef(true);
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false;
      return;
    }
    page.current?.focus({ preventScroll: true });
  }, [route]);

  useEffect(() => installerLEnvol(), []);
  useEffect(() => installerLesEffets(), []);

  // La barre bleue glisse jusqu'à l'entrée allumée, avec un ressort.
  const menu = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = menu.current;
    if (nav === null) return;
    const placer = () => {
      const actif = nav.querySelector<HTMLElement>('[data-entree][aria-current="page"]');
      nav.style.setProperty('--barre-y', `${actif?.offsetTop ?? 0}px`);
      nav.style.setProperty('--barre-h', `${actif?.offsetHeight ?? 0}px`);
      nav.toggleAttribute('data-sans-barre', actif === null);
    };
    placer();
    const observateur = new ResizeObserver(placer);
    observateur.observe(nav);
    return () => observateur.disconnect();
  }, [rubrique, deplie]);

  // La barre du haut prend un verre dès que la page défile.
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const element = page.current;
    if (element === null) return;
    const suivre = () => setDefile(element.scrollTop > 12);
    element.addEventListener('scroll', suivre, { passive: true });
    return () => element.removeEventListener('scroll', suivre);
  }, []);

  const pseudo = profil.donnees?.pseudo ?? null;
  const avatar = profil.donnees?.avatar ?? null;
  const choisirFiltre = (f: Filtre) => {
    filtreChoisi.ecrire(f);
    naviguer(BIBLIOTHEQUE);
  };

  return (
    <>
      <Fond />
      <Decor />
      <button type="button" className={styles.evitement} onClick={() => page.current?.focus()}>
        {t('coque.aller_au_contenu')}
      </button>
      <div className={styles.fenetre}>
        <ArtFlou className={styles.artFenetre} />
        <div className={styles.voile} aria-hidden="true" />

        <aside className={styles.laterale}>
          <Lien className={styles.marque} vers={ACCUEIL} aria-label={t('app.nom')}>
            <Marque />
          </Lien>
          <Joueur pseudo={pseudo} avatar={avatar} />

          <nav ref={menu} className={styles.menu} aria-label={t('coque.navigation')}>
            <span className={styles.barreActive} aria-hidden="true" />
            <Entree vers={ACCUEIL} actif={rubrique === 'accueil'} icone="maison">
              {t('coque.accueil')}
            </Entree>
            <div className={styles.groupe}>
              <Entree
                vers={BIBLIOTHEQUE}
                actif={rubrique === 'bibliotheque'}
                icone="grille"
                fin={
                  <button
                    type="button"
                    className={styles.deplier}
                    aria-expanded={deplie}
                    aria-label={t('v2.deplier_bibliotheque')}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeplie((d) => !d);
                    }}
                  >
                    <Icone nom="chevron_bas" taille={16} />
                  </button>
                }
              >
                {t('coque.bibliotheque')}
              </Entree>
              {deplie && (
                <ul className={styles.sousMenu}>
                  {FILTRES.map((f) => (
                    <li key={f}>
                      <button type="button" className={styles.sousEntree} aria-current={dansLaBibliotheque && filtre === f ? 'true' : undefined} onClick={() => choisirFiltre(f)}>
                        <span>{t(NOMS_DE_FILTRE[f])}</span>
                        {comptes !== null && <span className={`${styles.compte} chiffres`}>{formaterNombre(comptes[f], langue)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Entree vers={{ ecran: 'actualites' }} actif={rubrique === 'actualites'} icone="journal">
              {t('coque.actualites')}
            </Entree>
            <Entree
              vers={{ ecran: 'amis' }}
              actif={rubrique === 'amis'}
              icone="amis"
              fin={
                enJeu > 0 ? (
                  <>
                    <span className={`${styles.pastille} chiffres`} aria-hidden="true">
                      {enJeu}
                    </span>
                    <span className="hors-ecran">, {tp('coque.amis_en_jeu', enJeu)}</span>
                  </>
                ) : undefined
              }
            >
              {t('coque.amis')}
            </Entree>
            <Entree vers={{ ecran: 'profil' }} actif={rubrique === 'profil'} icone="utilisateur">
              {t('coque.profil')}
            </Entree>
            <span className={styles.ecart} aria-hidden="true" />
            <Entree vers={{ ecran: 'ajout' }} actif={rubrique === 'ajout'} icone="plus">
              {t('coque.ajouter')}
            </Entree>
            <Entree vers={{ ecran: 'parametres', section: 'general' }} actif={rubrique === 'parametres'} icone="reglages">
              {t('coque.parametres')}
            </Entree>
          </nav>
        </aside>

        <div className={styles.colonne}>
          <header className={styles.barre} data-defile={defile ? '' : undefined}>
            <button type="button" className={styles.recherche} onClick={ouvrirLaRecherche}>
              <Icone nom="recherche" taille={18} />
              <span className={styles.rechercheTexte}>{t('v2.rechercher')}</span>
              <kbd className={styles.raccourci}>{t('coque.raccourci')}</kbd>
            </button>
            <div className={styles.outils}>
              <Lien className={styles.outil} vers={{ ecran: 'actualites' }} aria-label={t('coque.actualites')} title={t('coque.actualites')}>
                <Icone nom="cloche" taille={20} />
                <span className={styles.outilPoint} aria-hidden="true" />
              </Lien>
              <Lien className={styles.outil} vers={{ ecran: 'amis' }} aria-label={t('coque.amis')} title={t('coque.amis')}>
                <Icone nom="amis" taille={20} />
                {enJeu > 0 && <span className={styles.outilPoint} aria-hidden="true" />}
              </Lien>
              <span className={styles.separateur} aria-hidden="true" />
              <Menu
                classeDuBouton={styles.profil ?? ''}
                nom={pseudo === null ? t('coque.profil') : t('coque.profil_de', { pseudo })}
                alignement="droite"
                contenu={
                  <>
                    <Avatar image={avatar} pseudo={pseudo} taille={36} />
                    <span className={styles.profilPseudo}>{pseudo ?? t('coque.profil')}</span>
                    <Icone nom="chevron_bas" taille={16} />
                  </>
                }
                elements={[
                  { cle: 'profil', libelle: t('coque.profil'), icone: 'utilisateur', action: () => naviguer({ ecran: 'profil' }) },
                  { cle: 'amis', libelle: t('coque.amis'), icone: 'amis', action: () => naviguer({ ecran: 'amis' }) },
                  { cle: 'parametres', libelle: t('coque.parametres'), icone: 'reglages', separe: true, action: () => naviguer({ ecran: 'parametres', section: 'general' }) },
                ]}
              />
            </div>
          </header>

          <main ref={page} className={styles.page} data-ecran={route.ecran} data-pleine={route.ecran === 'jeu' ? '' : undefined} tabIndex={-1}>
            <div className={styles.bandeaux}>
              <Bandeaux />
            </div>
            {children}
          </main>
        </div>
      </div>
      <RechercheRapide />
      <PileDAvis />
    </>
  );
}

/** Une fenêtre flottante sans navigation : pour le premier lancement. */
export function FenetreSeule({ children }: { children: ReactNode }) {
  const page = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    declarerLeDefileur(page.current);
    return () => declarerLeDefileur(null);
  }, []);
  return (
    <>
      <Fond />
      <div className={`${styles.fenetre} ${styles.fenetreSeule}`}>
        <ArtFlou className={styles.artFenetre} />
        <div className={styles.voile} aria-hidden="true" />
        <main ref={page} className={styles.page} tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}

export function Ouverture() {
  const { t } = useTexte();
  return (
    <>
      <Fond />
      <div className={styles.ouverture} role="status" aria-label={t('coque.ouverture')}>
        <Sigle />
      </div>
    </>
  );
}
