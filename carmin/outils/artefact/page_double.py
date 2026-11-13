"""
Réunit deux builds « artefact » (Nuit et Arène) dans une seule page, avec un bouton pour passer de l'un à l'autre.

Les deux builds partagent les morceaux de données (mêmes noms, même contenu) et les images (img/).
Chaque thème a sa feuille de styles, mise dans un module JS (l'hôte de l'artefact refuse les
feuilles de styles externes) avec ses polices latines en base64. La page charge le thème choisi,
puis son point d'entrée. Changer de thème recharge la page avec `#nuit` ou `#arene`.

Usage : python3 outils/artefact/page_double.py <dist_nuit> <dist_arene>
Le résultat est écrit dans <dist_nuit> (blazon.html, assets/style-*.js, morceaux d'Arène).
"""
import base64
import json
import pathlib
import re
import shutil
import sys

nuit = pathlib.Path(sys.argv[1])
arene = pathlib.Path(sys.argv[2])



def module_de_style(dist: pathlib.Path, nom: str) -> tuple[str, str]:
    trouves = sorted(dist.glob('assets/index-*.css'))
    assert len(trouves) == 1, f'{dist} doit être un build propre : {trouves}'
    css_f = trouves[0]
    css = css_f.read_text(encoding='utf-8')

    def police(m):
        fichier = m.group(1)
        if 'latin' in fichier:
            octets = (dist / 'assets' / fichier).read_bytes()
            return 'url(data:font/woff2;base64,' + base64.b64encode(octets).decode() + ')'
        return 'url(data:font/woff2;base64,)'  # alphabets non latins : inutiles ici

    css = re.sub(r'url\(\./([^)]+\.woff2)\)', police, css)
    module = f'style-{nom}.js'
    (nuit / 'assets' / module).write_text('export default ' + json.dumps(css) + ';\n', encoding='utf-8')
    entree = next(dist.glob('assets/index-*.js')).name
    return module, entree


# Les points d'entrée de Nuit sont lus AVANT de recopier ceux d'Arène dans le même dossier.
style_nuit, js_nuit = module_de_style(nuit, 'nuit')
style_arene, js_arene = module_de_style(arene, 'arene')
for f in (arene / 'assets').iterdir():
    cible = nuit / 'assets' / f.name
    if not cible.exists():
        shutil.copy(f, cible)

page = f"""<meta charset="utf-8">
<title>Blazon</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#060c18">
<style>
  html, body {{ background: #060c18; margin: 0; }}
  #choix-theme {{
    position: fixed; right: 18px; bottom: 46px; z-index: 2147483000;
    display: flex; align-items: center; gap: 4px; padding: 5px;
    border-radius: 999px; background: rgb(8 12 24 / 0.86);
    border: 1px solid rgb(255 255 255 / 0.16);
    box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);
    font: 600 13px/1 -apple-system, 'SF Pro Text', 'Segoe UI', sans-serif; letter-spacing: 0.02em;
    -webkit-tap-highlight-color: transparent;
  }}
  #choix-theme span {{ padding: 0 8px 0 10px; color: rgb(255 255 255 / 0.6); }}
  #choix-theme button {{
    appearance: none; border: 0; cursor: pointer; padding: 9px 16px; border-radius: 999px;
    background: transparent; color: rgb(255 255 255 / 0.82); font: inherit;
  }}
  #choix-theme button[aria-pressed="true"] {{ color: #fff; }}
  #choix-theme button[data-theme="nuit"][aria-pressed="true"] {{ background: linear-gradient(115deg, #7c5cff, #b84dff 46%, #ff2d8a); }}
  #choix-theme button[data-theme="arene"][aria-pressed="true"] {{ background: #c8f31d; color: #10140a; }}
</style>
<div id="racine"></div>
<div id="choix-theme" role="group" aria-label="Orientation">
  <span>Orientation</span>
  <button type="button" data-theme="nuit">Nuit</button>
  <button type="button" data-theme="arene">Arène</button>
</div>
<script type="module">
  const THEMES = {{
    nuit: {{ style: './assets/{style_nuit}', entree: './assets/{js_nuit}' }},
    arene: {{ style: './assets/{style_arene}', entree: './assets/{js_arene}' }},
  }};
  const lire = () => {{ try {{ return localStorage.getItem('blazon-theme'); }} catch {{ return null; }} }};
  const ecrire = (t) => {{ try {{ localStorage.setItem('blazon-theme', t); }} catch {{}} }};
  const demande = location.hash.replace('#', '');
  let theme = demande in THEMES ? demande : lire();
  if (!(theme in THEMES)) theme = 'nuit';
  ecrire(theme);
  if (demande in THEMES) history.replaceState(null, '', location.pathname + location.search + '#/');
  for (const b of document.querySelectorAll('#choix-theme button')) {{
    b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    b.addEventListener('click', () => {{
      if (b.dataset.theme === theme) return;
      ecrire(b.dataset.theme);
      location.hash = '#' + b.dataset.theme;
      location.reload();
    }});
  }}
  const style = document.createElement('style');
  style.textContent = (await import(THEMES[theme].style)).default;
  document.head.append(style);
  await import(THEMES[theme].entree);
</script>
"""
(nuit / 'blazon.html').write_text(page, encoding='utf-8')
print('Page double prête :', nuit / 'blazon.html', js_nuit, js_arene)
