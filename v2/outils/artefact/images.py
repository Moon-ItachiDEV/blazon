"""
Prépare les images de la version « artefact » (testable dans un navigateur, sans accès à Steam).

Une page d'artefact ne peut charger aucune image d'un autre site. On télécharge donc une partie
des images des données factices, on les réduit en WebP, et on les range dans des paquets
(`img/<famille>-NN.webp` : un WebP valide en tête, les suivants collés derrière) avec un index : empreinte de l'adresse d'origine -> [paquet, début, longueur].
Le front-end (src/artefact/) remplace les adresses Steam par une image d'attente et va chercher
la bonne tranche du paquet quand l'image approche de l'écran.

Usage : python3 outils/artefact/images.py <dossier_cache> <dossier_sortie>
"""
import concurrent.futures as cf
import hashlib
import io
import json
import os
import sys
from pathlib import Path

import requests
from PIL import Image

RACINE = Path(__file__).resolve().parents[2] / 'donnees-factices'
CACHE = Path(sys.argv[1])
SORTIE = Path(sys.argv[2])
TAILLE_PAQUET = 1_500_000


def empreinte(texte: str) -> str:
    """cyrb53, identique à src/artefact/empreinte.ts."""
    h1, h2 = 0xDEADBEEF, 0x41C6CE57
    m = 0xFFFFFFFF
    for ch in (ord(c) for c in texte):
        h1 = ((h1 ^ ch) * 2654435761) & m
        h2 = ((h2 ^ ch) * 1597334677) & m
    h1 = ((h1 ^ (h1 >> 16)) * 2246822507) & m
    h1 ^= ((h2 ^ (h2 >> 13)) * 3266489909) & m
    h2 = ((h2 ^ (h2 >> 16)) * 2246822507) & m
    h2 ^= ((h1 ^ (h1 >> 13)) * 3266489909) & m
    return format((2097151 & h2) * 4294967296 + (h1 & m), 'x')


def lire(nom):
    return json.load(open(RACINE / nom, encoding='utf-8'))


jeux = lire('jeux.json')
fiches = {}
for f in sorted((RACINE / 'fiches').glob('*.json')):
    fiches.update(json.load(open(f, encoding='utf-8')))
succes = {}
for f in sorted((RACINE / 'succes').glob('*.json')):
    succes.update(json.load(open(f, encoding='utf-8')))
amis = lire('amis.json')
actualites = lire('actualites.json')

recents = sorted(jeux, key=lambda j: j['temps']['dernier_lancement'] or '', reverse=True)
par_temps = sorted(jeux, key=lambda j: j['temps']['minutes_total'] or 0, reverse=True)
prioritaires = set()
prioritaires |= {j['id'] for j in jeux if j['installe']}
prioritaires |= {j['id'] for j in recents[:60]}
prioritaires |= {j['id'] for j in par_temps[:40]}
prioritaires |= {j['id'] for j in jeux if j['favori']}
prioritaires |= {a['jeu_en_cours']['id_jeu'] for a in amis if a.get('jeu_en_cours') and a['jeu_en_cours'].get('id_jeu')}
ordre = [j['id'] for j in recents]

# (famille, adresse, alias éventuel vers une autre adresse)
demandes = []  # (famille, url)
alias = {}  # url -> url dont on reprend l'image
for j in recents:
    if j['jaquette']:
        demandes.append(('jaquette', j['jaquette']))
for j in recents:
    if j['icone']:
        demandes.append(('icone', j['icone']))
for a in amis:
    e = a.get('jeu_en_cours') or {}
    if e.get('jaquette'):
        demandes.append(('jaquette', e['jaquette']))
for id_jeu in ordre:
    if id_jeu not in prioritaires:
        continue
    f = fiches.get(str(id_jeu))
    if not f:
        continue
    for cle in ('hero', 'logo', 'en_tete'):
        if f.get(cle):
            demandes.append((cle, f[cle]))
    for c in (f.get('fiche') or {}).get('captures', [])[:4]:
        demandes.append(('capture', c['miniature']))
        alias[c['pleine']] = c['miniature']
avec_succes = [i for i in [j['id'] for j in par_temps] if str(i) in succes][:70]
for id_jeu in avec_succes:
    for s in succes[str(id_jeu)].get('liste', []):
        u = s['icone'] if s.get('debloque') else s['icone_grise']
        if u:
            demandes.append(('succes', u))
for a in actualites[:160]:
    if a.get('image') and 'steamstatic' in a['image']:
        demandes.append(('actualite', a['image']))

vus = set()
demandes = [d for d in demandes if not (d[1] in vus or vus.add(d[1]))]
print('images demandées :', len(demandes), 'jeux prioritaires :', len(prioritaires), file=sys.stderr)

REGLAGES = {
    'jaquette': (240, 360, 68, True),
    'icone': (64, 64, 75, True),
    'hero': (1400, None, 62, False),
    'logo': (640, None, 82, False),
    'en_tete': (460, None, 70, False),
    'capture': (640, None, 60, False),
    'succes': (64, 64, 72, True),
    'actualite': (720, None, 64, False),
}

session = requests.Session()
session.verify = os.environ.get('REQUESTS_CA_BUNDLE', '/root/.ccr/ca-bundle.crt')
CACHE.mkdir(parents=True, exist_ok=True)


def traiter(demande):
    famille, url = demande
    chemin = CACHE / (hashlib.sha1((url + repr(REGLAGES[famille])).encode()).hexdigest() + '.webp')
    if chemin.exists():
        return demande, chemin.read_bytes() or None
    try:
        r = session.get(url, timeout=30)
        if r.status_code != 200:
            chemin.write_bytes(b'')
            return demande, None
        im = Image.open(io.BytesIO(r.content))
        im.load()
        largeur, hauteur, qualite, couvrir = REGLAGES[famille]
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if hauteur is None:
            if im.width > largeur:
                im = im.resize((largeur, round(im.height * largeur / im.width)), Image.LANCZOS)
        else:
            im.thumbnail((largeur, hauteur), Image.LANCZOS)
        tampon = io.BytesIO()
        im.save(tampon, 'WEBP', quality=qualite, method=5)
        donnees = tampon.getvalue()
        chemin.write_bytes(donnees)
        return demande, donnees
    except Exception as erreur:  # image morte, format inattendu : la page dessinera son repli
        print('échec', url, erreur, file=sys.stderr)
        chemin.write_bytes(b'')
        return demande, None


resultats = {}
with cf.ThreadPoolExecutor(24) as pool:
    for n, (demande, donnees) in enumerate(pool.map(traiter, demandes)):
        if donnees:
            resultats[demande[1]] = (demande[0], donnees)
        if n % 1000 == 0:
            print(n, '/', len(demandes), file=sys.stderr)

SORTIE.mkdir(parents=True, exist_ok=True)
(SORTIE / 'img').mkdir(exist_ok=True)
paquets = []
index = {}
courant = {}
for famille, url in demandes:
    if url not in resultats:
        continue
    _, donnees = resultats[url]
    tampon = courant.get(famille)
    if tampon is None or len(tampon[1]) + len(donnees) > TAILLE_PAQUET:
        nom = f'img/{famille}-{sum(1 for p in paquets if p.startswith("img/" + famille + "-")):02d}.webp'
        paquets.append(nom)
        tampon = courant[famille] = (len(paquets) - 1, bytearray())
        tampons = globals().setdefault('_tampons', {})
        tampons[tampon[0]] = tampon[1]
    index[empreinte(url)] = [tampon[0], len(tampon[1]), len(donnees)]
    tampon[1].extend(donnees)
for url, cible in alias.items():
    if empreinte(cible) in index:
        index[empreinte(url)] = index[empreinte(cible)]
for numero, octets in globals().get('_tampons', {}).items():
    (SORTIE / paquets[numero]).write_bytes(bytes(octets))
json.dump({'paquets': paquets, 'images': index}, open(SORTIE / 'img' / 'index.json', 'w'), separators=(',', ':'))
total = sum(len(v[1]) for v in resultats.values())
print(f'{len(index)} adresses, {len(paquets)} paquets, {total / 1e6:.1f} Mo', file=sys.stderr)
