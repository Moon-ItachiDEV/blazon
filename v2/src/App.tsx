import { useEffect } from 'react';
import { PremierLancement } from './accueil/PremierLancement';
import { EcranActualites } from './actualites/EcranActualites';
import { EcranAjout } from './ajout/EcranAjout';
import { EcranAmis } from './amis/EcranAmis';
import { Bibliotheque } from './bibliotheque/Bibliotheque';
import { PileDAvis } from './composants/Avis';
import { ErreurPleine } from './composants/Etats';
import { coeur } from './coeur';
import { Coque, FenetreSeule, Ouverture } from './coque/Coque';
import { EcranAccueil } from './accueil/EcranAccueil';
import { demarrer, useApplication, useLangue } from './etat/application';
import { Fiche } from './fiche/Fiche';
import type { CleDeTexte } from './i18n';
import { useTexte } from './i18n/react';
import { useRoute, type Route } from './navigation';
import { EcranParametres } from './parametres/EcranParametres';
import { EcranProfil } from './profil/EcranProfil';
import { EcranSucces } from './succes/EcranSucces';

/** Titre de la fenêtre pour chaque écran. */
const TITRES: Record<Route['ecran'], CleDeTexte> = {
  bibliotheque: 'coque.bibliotheque',
  jeu: 'coque.bibliotheque',
  succes: 'fiche.succes',
  ajout: 'bibliotheque.ajouter_un_jeu',
  actualites: 'coque.actualites',
  amis: 'coque.amis',
  profil: 'coque.profil',
  parametres: 'coque.parametres',
};

function Ecran({ route }: { route: Route }) {
  switch (route.ecran) {
    case 'bibliotheque':
      if (route.recherche === '' && route.tout !== true) return <EcranAccueil />;
      return <Bibliotheque recherche={route.recherche} tout={route.tout === true} />;
    case 'jeu':
      // `key` : en passant d'un jeu à un autre, la fiche repart de zéro (menus, fenêtres, source choisie).
      return <Fiche key={route.id_jeu} id_jeu={route.id_jeu} />;
    case 'succes':
      return <EcranSucces key={route.id_jeu} id_jeu={route.id_jeu} />;
    case 'actualites':
      return <EcranActualites />;
    case 'amis':
      return <EcranAmis />;
    case 'profil':
      return <EcranProfil />;
    case 'parametres':
      return <EcranParametres section={route.section} />;
    case 'ajout':
      return <EcranAjout />;
  }
}

export function App() {
  const { t } = useTexte();
  const langue = useLangue();
  const route = useRoute();
  const pret = useApplication((a) => a.pret);
  const panne = useApplication((a) => a.panne);
  const premierLancement = useApplication((a) => a.etat?.premier_lancement ?? false);
  const animations = useApplication((a) => a.parametres?.animations ?? 'systeme');

  // Branchement sur le cœur, une seule fois. Le retour de `demarrer` débranche tout.
  useEffect(() => demarrer(coeur), []);

  useEffect(() => {
    document.documentElement.lang = langue;
    document.documentElement.dataset.animations = animations;
  }, [langue, animations]);

  // Titre de la fenêtre : le jeu sur sa fiche, « Succès · le jeu » sur ses succès, sinon le nom de l'écran.
  const id_jeu = route.ecran === 'jeu' || route.ecran === 'succes' ? route.id_jeu : null;
  const titreDuJeu = useApplication((a) => (id_jeu === null ? null : (a.jeux?.find((jeu) => jeu.id === id_jeu)?.titre ?? null)));
  useEffect(() => {
    const ecran = t(TITRES[route.ecran]);
    const morceaux = route.ecran === 'jeu' ? [titreDuJeu ?? ecran] : route.ecran === 'succes' && titreDuJeu !== null ? [ecran, titreDuJeu] : [ecran];
    document.title = [...morceaux, t('app.nom')].join(' · ');
  }, [route.ecran, titreDuJeu, t]);

  if (!pret) return <Ouverture />;
  if (panne !== null) {
    return (
      <div style={{ position: 'fixed', inset: 'var(--marge-fenetre)', display: 'grid', placeItems: 'center', padding: 'var(--e8)', borderRadius: 'var(--rayon-fenetre)', background: 'var(--fond)' }}>
        <ErreurPleine erreur={panne} centre reessayer={() => location.reload()} />
      </div>
    );
  }
  // Premier lancement : l'accueil remplace toute l'application, sans rail ni recherche.
  if (premierLancement) {
    return (
      <>
        <FenetreSeule>
          <PremierLancement />
        </FenetreSeule>
        <PileDAvis />
      </>
    );
  }
  return (
    <Coque>
      <Ecran route={route} />
    </Coque>
  );
}
