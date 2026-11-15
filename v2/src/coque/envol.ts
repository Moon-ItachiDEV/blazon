/**
 * L'envol : quand on ouvre la fiche d'un jeu en cliquant sur sa jaquette (grille, dernières parties,
 * rail, recherche…), la jaquette quitte sa place et s'agrandit jusqu'à devenir l'affiche de la fiche.
 *
 * Le navigateur sait animer un élément d'un écran à l'autre s'il porte le même nom de transition des
 * deux côtés (View Transitions). L'affiche de la fiche porte `jaquette-envol` ; ici, juste avant le
 * changement d'écran, on donne ce nom à la jaquette cliquée. Un seul écouteur, en phase de capture,
 * pour toute l'application : aucun écran n'a à s'en occuper.
 */
const NOM = 'jaquette-envol';

export function installerLEnvol(): () => void {
  const auClic = (evenement: MouseEvent) => {
    if (evenement.button !== 0 || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
    const lien = (evenement.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#/jeu/"]');
    if (lien === null || lien === undefined || /\/succes/.test(lien.getAttribute('href') ?? '')) return;
    const image = lien.querySelector<HTMLElement>('img, [data-jaquette]') ?? lien;
    image.style.setProperty('view-transition-name', NOM);
    // Le nom ne doit exister qu'une fois par écran : on le retire dès que la transition a photographié l'ancien.
    setTimeout(() => image.style.removeProperty('view-transition-name'), 1200);
  };
  document.addEventListener('click', auClic, true);
  return () => document.removeEventListener('click', auClic, true);
}
