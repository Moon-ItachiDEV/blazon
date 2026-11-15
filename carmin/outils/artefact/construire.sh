#!/usr/bin/env bash
# Construit la version artefact (testable dans un navigateur, iPad compris) dans le dossier donné.
# Usage : outils/artefact/construire.sh <sortie> [cache_images]
set -euo pipefail
cd "$(dirname "$0")/../.."
SORTIE="${1:?dossier de sortie}"
CACHE="${2:-$SORTIE-cache}"
VITE_ARTEFACT=1 npx vite build --outDir "$SORTIE" --emptyOutDir
python3 outils/artefact/images.py "$CACHE" "$SORTIE"
# La page d'un artefact est enveloppée par l'hôte (ni doctype, ni html, ni head, ni body), et l'hôte
# n'accepte de feuille de styles externe que de Google Fonts : les styles et les polices latines
# sont donc mis dans la page.
python3 - "$SORTIE" <<'PY'
import base64, pathlib, re, sys
d = pathlib.Path(sys.argv[1])
js = next(d.glob('assets/index-*.js')).name
css_f = next(d.glob('assets/index-*.css'))
css = css_f.read_text(encoding='utf-8')
def police(m):
    nom = m.group(1)
    if 'latin' not in nom:
        return 'url(data:font/woff2;base64,)'
    return 'url(data:font/woff2;base64,' + base64.b64encode((d / 'assets' / nom).read_bytes()).decode() + ')'
css = re.sub(r'url\(\./([^)]+\.woff2)\)', police, css)
(d / 'blazon.html').write_text(f"""<meta charset="utf-8">
<title>Blazon</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#060c18">
<style>{css}</style>
<div id="racine"></div>
<script type="module" src="./assets/{js}"></script>
""", encoding='utf-8')
PY
echo "Prêt : $SORTIE/blazon.html"
