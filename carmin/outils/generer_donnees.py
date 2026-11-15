#!/usr/bin/env python3
"""Génère la bibliothèque factice du launcher à partir de vraies réponses du magasin Steam.

Usage : python3 generer_donnees.py <dossier_des_reponses_brutes> <dossier_de_sortie>

Entrées (réponses réelles enregistrées le 11/11/2026, données publiques uniquement) :
  items_raw.json, details_all.json, details_riches.json   IStoreBrowseService/GetItems
  tags.json                                               IStoreService/GetLocalizedNameForTags
  succes_raw.json                                         IPlayerService/GetGameAchievements
  news_raw.json                                           store /events/ajaxgetpartnereventspageable
  selection.json                                          jeux retenus, installés, « riches »

Tout ce qui est personnel est INVENTÉ avec un tirage fixe (même graine = mêmes fichiers) :
jeux installés, temps de jeu, sessions, succès débloqués, amis, profil, couleurs dominantes.
"""
import colorsys, gzip, hashlib, html, json, math, os, random, re, sys, unicodedata
from datetime import datetime, timedelta, timezone

BRUT, SORTIE = sys.argv[1], sys.argv[2]
GRAINE = 20261111
MAINTENANT = datetime(2026, 11, 11, 19, 0, 0, tzinfo=timezone.utc)
INSTALL_LAUNCHER = datetime(2026, 7, 10, 18, 0, 0, tzinfo=timezone.utc)

BASE_ASSETS = "https://shared.akamai.steamstatic.com/store_item_assets/"
BASE_SUCCES = "https://shared.akamai.steamstatic.com/community_assets/images/apps/"
BASE_CLAN = "https://clan.akamai.steamstatic.com/images/"   # vérifié le 11/11/2026 (40 images sur 40)

# Énumération ELanguage de Steam (de mémoire ; 0, 1, 2, 3 et 5 confirmés par les réponses réelles).
LANGUES = {0: "en", 1: "de", 2: "fr", 3: "it", 4: "ko", 5: "es", 6: "zh-CN", 7: "zh-TW", 8: "ru", 9: "th",
           10: "ja", 11: "pt", 12: "pl", 13: "da", 14: "nl", 15: "fi", 16: "no", 17: "sv", 18: "hu", 19: "cs",
           20: "ro", 21: "tr", 22: "pt-BR", 23: "bg", 24: "el", 25: "ar", 26: "uk", 27: "es-419", 28: "vi",
           30: "id"}

rnd = random.Random(GRAINE)


def charge(nom):
    chemin = os.path.join(BRUT, nom)
    if os.path.exists(chemin + ".gz"):
        with gzip.open(chemin + ".gz", "rt", encoding="utf-8") as f:
            return json.load(f)
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def ecrit(nom, donnees):
    chemin = os.path.join(SORTIE, nom)
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(donnees, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(chemin)


def iso(d):
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_ts(ts):
    return iso(datetime.fromtimestamp(ts, tz=timezone.utc))


ARTICLES = re.compile(r"^(the|a|an|le|la|les|l'|un|une|des)\s+", re.I)


def titre_tri(titre):
    t = unicodedata.normalize("NFKD", titre)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[®™©]", "", t).lower().strip()
    t = ARTICLES.sub("", t)
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    return t or titre.lower()


def couleur(cle):
    """Couleur sourde et stable tirée de l'identifiant (inventée : pas d'accès aux images)."""
    h = int(hashlib.sha1(str(cle).encode()).hexdigest()[:8], 16)
    teinte, sat, lum = (h % 360) / 360.0, 0.28 + ((h >> 9) % 25) / 100.0, 0.26 + ((h >> 15) % 16) / 100.0
    q = lum * (1 + sat) if lum < 0.5 else lum + sat - lum * sat
    p = 2 * lum - q

    def canal(t):
        t %= 1
        if t < 1 / 6: return p + (q - p) * 6 * t
        if t < 1 / 2: return q
        if t < 2 / 3: return p + (q - p) * (2 / 3 - t) * 6
        return p
    return "#%02x%02x%02x" % tuple(round(canal(teinte + d) * 255) for d in (1 / 3, 0, -1 / 3))


def url_asset(assets, cle):
    nom = assets.get(cle)
    if not nom:
        return None
    return BASE_ASSETS + assets["asset_url_format"].replace("${FILENAME}", nom)


# ───────────── BBCode de Steam -> HTML sûr (le cœur Rust fera ce travail dans la vraie application) ─────────────

SIMPLE = {"b": "strong", "i": "em", "u": "u", "strike": "s", "h1": "h3", "h2": "h3", "h3": "h4", "h4": "h4", "h5": "h4",
          "quote": "blockquote", "code": "code", "p": "p", "td": "td", "th": "th", "tr": "tr", "table": "table"}
# Seules les balises connues de Steam sont retirées : un texte entre crochets ordinaire reste du texte.
CONNUES = ("p|b|i|u|strike|h[1-5]|list|olist|url|img|quote|code|table|tr|td|th|hr|spoiler|noparse|previewyoutube|video|carousel|"
           "dynamiclink|c|expand|center|color|size|pullquote|sticker|roomeffect")


def url_sure(u, appid=None):
    """Ne laisse passer que du https, après remplacement des marqueurs de Steam."""
    u = html.unescape(u).strip().strip('"').strip("'")
    u = u.replace("{STEAM_CLAN_IMAGE}", BASE_CLAN.rstrip("/"))
    if appid:
        u = u.replace("{STEAM_APP_IMAGE}", f"{BASE_ASSETS}steam/apps/{appid}")
    return html.escape(u, quote=True) if re.match(r"^https://[^\s\"'<>{}]+$", u) else None


def bbcode_vers_html(texte, appid=None):
    t = texte.replace("\r\n", "\n").replace("\\[", "\x00").replace("\\]", "\x01")     # crochets échappés par Steam
    t = html.escape(t, quote=False)

    def image(m):
        u = url_sure(m.group(1) or m.group(2) or "", appid)
        return f'<img src="{u}" loading="lazy" alt="">' if u else ""
    t = re.sub(r'\[img(?:\s+[^\]]*?src="?([^"\]\s]+)"?[^\]]*)?\](?:([^\[]*)\[/img\])?', image, t, flags=re.I)

    def lien(m):
        u = url_sure(m.group(1), appid)
        return f'<a href="{u}" rel="noopener noreferrer">{m.group(2)}</a>' if u else m.group(2)
    t = re.sub(r"\[url=([^\]]+)\](.*?)\[/url\]", lien, t, flags=re.S | re.I)
    t = re.sub(r"\[dynamiclink\s+href=([^\]]+)\](.*?)\[/dynamiclink\]", lambda m: lien(m) if m.group(2).strip() else "", t, flags=re.S | re.I)

    def lien_nu(m):
        u = url_sure(m.group(1), appid)
        return f'<a href="{u}" rel="noopener noreferrer">{m.group(1)}</a>' if u else m.group(1)
    t = re.sub(r"\[url\]([^\[]*)\[/url\]", lien_nu, t, flags=re.I)
    t = re.sub(r'\[previewyoutube="?([\w-]+)[^\]]*\]\s*\[/previewyoutube\]',
               r'<p><a href="https://www.youtube.com/watch?v=\1" rel="noopener noreferrer">YouTube</a></p>', t, flags=re.I)
    t = re.sub(r"\[(o?)list\]", lambda m: "<ol>" if m.group(1) else "<ul>", t, flags=re.I)
    t = re.sub(r"\[/(o?)list\]", lambda m: "</li></ol>" if m.group(1) else "</li></ul>", t, flags=re.I)
    t = re.sub(r"\[\*\]", "</li><li>", t)
    t = re.sub(r"\[/\*\]", "", t)
    t = re.sub(r"<(ul|ol)>\s*</li>", r"<\1>", t)
    for bb, balise in SIMPLE.items():
        t = re.sub(rf"\[{bb}(?:[\s=][^\]]*)?\]", f"<{balise}>", t, flags=re.I)
        t = re.sub(rf"\[/{bb}\]", f"</{balise}>", t, flags=re.I)
    t = re.sub(r"\[hr\]\s*(\[/hr\])?", "<hr>", t, flags=re.I)
    t = re.sub(rf"\[/?(?:{CONNUES})(?:[\s=][^\]\n]*)?\]", "", t, flags=re.I)
    t = t.replace("\x00", "[").replace("\x01", "]")
    t = re.sub(r"\n{2,}", "<br><br>", t.strip())
    t = t.replace("\n", "<br>")
    blocs = r"ul|ol|li|h3|h4|p|table|tr|td|th|blockquote|hr"
    t = re.sub(rf"(<br>\s*)+(</?(?:{blocs})>)", r"\2", t)
    t = re.sub(rf"(</?(?:{blocs})>)(\s*<br>)+", r"\1", t)
    t = re.sub(r"<(p|li|strong|em|u|h3|h4)>\s*</\1>", "", t)
    t = re.sub(r"<(p|li)>\s*</\1>", "", t)
    return t


def texte_brut(h, longueur=220):
    t = re.sub(r"<p><a [^>]*>YouTube</a></p>", "", h)
    t = re.sub(r"<(br|/p|/li|/h3|/h4|/td)>", " ", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= longueur else t[:longueur].rsplit(" ", 1)[0] + "…"


# ───────────── Chargement ─────────────

sel = charge("selection.json")
items = {x["appid"]: x for x in charge("items_raw.json") if x.get("success") == 1}
details = {x["appid"]: x for x in charge("details_all.json") if x.get("success") == 1}
riches = {x["appid"]: x for x in charge("details_riches.json") if x.get("success") == 1}
succes_brut = {int(k): v for k, v in charge("succes_raw.json").items()}
news_brut = {int(k): v for k, v in charge("news_raw.json").items()}
tags_brut = charge("tags.json")

STEAM_INSTALLES = set(sel["installes"][:110])
jeux, fiches, sources_detail = [], {}, {}

# ───────────── Jeux Steam ─────────────

for rang, appid in enumerate(sel["ids"]):
    it = items[appid]
    id_jeu = len(jeux) + 1
    r = random.Random(GRAINE * 31 + appid)
    a = it["assets"]
    installe = appid in STEAM_INSTALLES
    sortie = datetime.fromtimestamp(it["release"]["steam_release_date"], tz=timezone.utc)
    debut_possible = max(sortie, datetime(2013, 3, 1, tzinfo=timezone.utc))
    ajoute = debut_possible + (MAINTENANT - debut_possible) * (r.random() ** 0.7)

    # Temps de jeu (inventé) : les jeux installés sont joués, un tiers du reste n'a jamais été lancé.
    if installe:
        minutes = int(min(180000, r.lognormvariate(7.4, 1.3)))
        recent = r.random() < 0.42
    else:
        minutes = 0 if r.random() < 0.34 else int(min(90000, r.lognormvariate(5.6, 1.5)))
        recent = False
    minutes_2sem = int(min(minutes, r.lognormvariate(5.3, 0.9))) if recent else 0
    if minutes == 0:
        dernier = None
    elif recent:
        dernier = MAINTENANT - timedelta(hours=r.uniform(1, 24 * 13))
        ajoute = min(ajoute, dernier - timedelta(days=r.uniform(1, 40)))
    else:
        dernier = ajoute + (MAINTENANT - timedelta(days=15) - ajoute) * r.random() if ajoute < MAINTENANT - timedelta(days=16) else ajoute + timedelta(hours=2)

    ajoute = max(debut_possible, ajoute)
    if dernier and dernier < ajoute:
        dernier = min(MAINTENANT - timedelta(hours=1), ajoute + timedelta(hours=3))
    cat = it.get("categories", {})
    joueurs = set(cat.get("supported_player_categoryids", []))
    modes = [m for m, ids in (("solo", {2}), ("multi", {1, 20, 36, 37, 47, 49}), ("coop", {9, 38, 39, 48})) if joueurs & ids]
    manettes = set(cat.get("controller_categoryids", []))
    rs = it.get("reviews", {}).get("summary_filtered")
    sans_jaquette = r.random() < 0.02          # 2 % sans image, pour dessiner la jaquette générée
    jaquette = None if sans_jaquette else url_asset(a, "library_capsule")
    icone = BASE_SUCCES + f"{appid}/{a['community_icon']}.jpg" if a.get("community_icon") else None    # vérifié le 11/11/2026

    liste_succes = succes_brut.get(appid)
    jeu = {
        "id": id_jeu, "titre": it["name"], "titre_tri": titre_tri(it["name"]),
        "sources": ["steam"], "steam_appid": appid, "installe": installe,
        "taille_octets": int(min(180e9, r.lognormvariate(23.4, 1.1))) if installe else None,
        "ajoute_le": iso(ajoute), "favori": installe and r.random() < 0.12, "masque": (not installe) and r.random() < 0.015,
        "temps": {"minutes_total": minutes, "minutes_2sem": minutes_2sem, "dernier_lancement": iso(dernier) if dernier else None, "origine": "steam"},
        "jaquette": jaquette, "icone": icone, "couleur_dominante": couleur(appid),
        "tags": it.get("tagids", [])[:6], "modes": modes,
        "manette": "complete" if 28 in manettes else "partielle" if 18 in manettes else None,
        "avis": {"nombre": rs["review_count"], "pct_positifs": rs["percent_positive"], "score": rs["review_score"]} if rs else None,
        "date_sortie": iso(sortie),
        "succes": {"total": len(liste_succes), "debloques": 0} if liste_succes else None,
    }
    jeux.append(jeu)

    # Fiche du magasin
    d, rr = details.get(appid, {}), riches.get(appid, {})
    bi = it.get("basic_info", {})
    captures = []
    for c in sorted(d.get("screenshots", {}).get("all_ages_screenshots", []), key=lambda c: c.get("ordinal", 0))[:6]:
        base, _, suite = (BASE_ASSETS + c["filename"]).partition(".jpg")
        captures.append({"miniature": base + ".600x338.jpg" + suite, "pleine": base + ".1920x1080.jpg" + suite})
    gr = d.get("game_rating")
    classification = {"organisme": "PEGI", "valeur": gr["rating"], "descripteurs": gr.get("descriptors", [])} if gr and gr.get("agency") == 2 and gr.get("rating") else None
    langues = [{"code": LANGUES[l["elanguage"]], "interface": bool(l.get("supported")), "audio": bool(l.get("full_audio")), "sous_titres": bool(l.get("subtitles"))}
               for l in d.get("supported_languages", []) if l.get("elanguage") in LANGUES and l.get("eadditionallanguage", -1) == -1]
    desc = rr.get("full_description_bbcode")
    ancien_style = "/" not in a.get("library_capsule", "x/")     # anciens jeux : adresses fixes encore valables
    fiches[id_jeu] = {
        "hero": url_asset(a, "library_hero"),
        "logo": BASE_ASSETS + f"steam/apps/{appid}/logo.png" if ancien_style else None,     # ancienne adresse fixe : 39 sur 40 répondent
        "en_tete": url_asset(a, "header"),
        "fiche": {
            "id_jeu": id_jeu, "langue": "fr", "description_courte": bi.get("short_description", "").replace("\r\n", " ").strip(),
            "description_html": bbcode_vers_html(desc, appid) if desc else None,
            "developpeurs": [x["name"] for x in bi.get("developers", [])], "editeurs": [x["name"] for x in bi.get("publishers", [])],
            "captures": captures, "acces_anticipe": bool(it.get("is_early_access")), "classification": classification, "langues": langues,
            "joueurs_en_ligne": int(rs["review_count"] ** 0.62 * r.uniform(0.4, 2.2)) if rs and appid in riches else None,
            "url_magasin": "https://store.steampowered.com/" + it["store_url_path"],
        },
    }
    nom_dossier = re.sub(r'[<>:"/\\|?*®™]', "", it["name"]).strip()
    sources_detail[id_jeu] = [{"source": "steam", "id_source": str(appid), "installe": installe,
                               "dossier": f"D:\\SteamLibrary\\steamapps\\common\\{nom_dossier}" if installe else None,
                               "exe": None, "taille_octets": jeu["taille_octets"], "vu_le": iso(MAINTENANT - timedelta(minutes=12))}]

# Quelques jeux Steam installés existent aussi chez GOG (cas « deux sources », F-27).
for jeu in [j for j in jeux if j["installe"]][5:13]:
    jeu["sources"].append("gog")
    sources_detail[jeu["id"]].append({"source": "gog", "id_source": str(1200000000 + jeu["id"]), "installe": False, "dossier": None, "exe": None,
                                      "taille_octets": None, "vu_le": iso(MAINTENANT - timedelta(minutes=12))})

# ───────────── Jeux hors Steam (tous installés : un scan ne trouve que ce qui est sur le disque) ─────────────

HORS_STEAM = {
    "epic": ["Fortnite", "Rocket League", "Alan Wake 2", "Fall Guys", "Genshin Impact", "Kingdom Hearts III", "Tony Hawk's Pro Skater 1 + 2",
             "The Outer Worlds", "Control", "Death Stranding", "Unreal Tournament", "Tetris Effect: Connected", "Infinity Blade", "Shadow Complex Remastered"],
    "gog": ["Heroes of Might and Magic III: Complete", "Baldur's Gate II: Enhanced Edition", "Planescape: Torment", "Theme Hospital", "Dungeon Keeper Gold",
            "SimCity 2000 Special Edition", "Gwent", "Warcraft II Battle.net Edition", "Diablo + Hellfire", "Rayman 2: The Great Escape",
            "Little Big Adventure 2", "Outcast 1.1", "Syberia"],
    "manuel": ["Minecraft", "League of Legends", "Valorant", "World of Warcraft", "Hearthstone", "osu!", "Star Citizen", "Trackmania",
               "Old School RuneScape", "Mon prototype (Unity)", "Dofus", "Escape from Tarkov", "L'émulateur du grenier"],
}
for source, titres in HORS_STEAM.items():
    for n, titre in enumerate(titres):
        id_jeu = len(jeux) + 1
        r = random.Random(GRAINE * 17 + id_jeu)
        ajoute = INSTALL_LAUNCHER + (MAINTENANT - INSTALL_LAUNCHER) * r.random() * 0.6
        joue = r.random() < 0.8
        taille = int(min(150e9, r.lognormvariate(22.6, 1.3)))
        jeux.append({
            "id": id_jeu, "titre": titre, "titre_tri": titre_tri(titre), "sources": [source], "steam_appid": None, "installe": True,
            "taille_octets": taille, "ajoute_le": iso(ajoute), "favori": r.random() < 0.15, "masque": False,
            "temps": {"minutes_total": 0, "minutes_2sem": 0, "dernier_lancement": None, "origine": "local"},   # rempli plus bas par les sessions
            "jaquette": None, "icone": None, "couleur_dominante": couleur(titre), "tags": [], "modes": [], "manette": None, "avis": None,
            "date_sortie": None, "succes": None, "_joue": joue,
        })
        dossier = {"epic": "C:\\Program Files\\Epic Games\\", "gog": "D:\\GOG Games\\", "manuel": "D:\\Jeux\\"}[source] + re.sub(r'[<>:"/\\|?*!]', "", titre)
        fiches[id_jeu] = {"hero": None, "logo": None, "en_tete": None, "fiche": None}
        sources_detail[id_jeu] = [{"source": source, "id_source": f"{source}-{n + 1:03d}" if source != "manuel" else dossier + "\\jeu.exe",
                                   "installe": True, "dossier": dossier, "exe": dossier + "\\jeu.exe", "taille_octets": taille,
                                   "vu_le": iso(MAINTENANT - timedelta(minutes=12))}]

# ───────────── Sessions mesurées par le launcher depuis son installation ─────────────

sessions = []


def ajoute_sessions(jeu, nombre, r, jusqu_a):
    depuis = max(INSTALL_LAUNCHER, datetime.strptime(jeu["ajoute_le"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc))
    if jusqu_a <= depuis + timedelta(hours=1):
        jusqu_a = min(MAINTENANT - timedelta(hours=1), depuis + timedelta(days=2))
    if jusqu_a <= depuis:
        return
    for n in range(nombre):
        jour = depuis + (jusqu_a - depuis) * r.random()
        debut = jour.replace(hour=int(min(23, max(8, r.gauss(20, 2.6)))), minute=r.randrange(60), second=r.randrange(60))
        if n == 0 or not depuis <= debut <= jusqu_a:
            debut = jusqu_a if n == 0 else jour
        duree = r.randrange(4, 20) if r.random() < 0.06 else int(min(6 * 3600, r.lognormvariate(8.3, 0.75)))   # 6 % de faux départs (< 20 s)
        sessions.append({"id_jeu": jeu["id"], "debut": debut, "fin": debut + timedelta(seconds=duree), "duree_s": duree,
                         "origine": "launcher" if r.random() < 0.8 else "detectee"})


for jeu in jeux:
    r = random.Random(GRAINE * 7 + jeu["id"])
    if jeu["temps"]["origine"] == "steam":
        dernier = jeu["temps"]["dernier_lancement"]
        if not jeu["installe"] or not dernier or dernier < iso(INSTALL_LAUNCHER):
            continue
        fin = datetime.strptime(dernier, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        ajoute_sessions(jeu, 3 + int(r.expovariate(1 / 9)), r, fin)
    elif jeu.pop("_joue"):
        ajoute_sessions(jeu, 2 + int(r.expovariate(1 / 14)), r, MAINTENANT - timedelta(hours=r.uniform(2, 24 * 40)))

sessions.sort(key=lambda s: s["debut"])
par_jeu = {}
for n, s in enumerate(sessions, 1):
    s["id"] = n
    par_jeu.setdefault(s["id_jeu"], []).append(s)
for jeu in jeux:
    jeu.pop("_joue", None)
    ss = par_jeu.get(jeu["id"], [])
    if not ss:
        continue
    reelles = [s for s in ss if s["duree_s"] >= 20]
    if jeu["temps"]["origine"] == "local":       # jeu hors Steam : le temps affiché est celui du launcher
        jeu["temps"]["minutes_total"] = sum(s["duree_s"] for s in reelles) // 60
        jeu["temps"]["minutes_2sem"] = sum(s["duree_s"] for s in reelles if s["debut"] > MAINTENANT - timedelta(days=14)) // 60
        jeu["temps"]["dernier_lancement"] = iso(max(s["debut"] for s in ss))
    else:                                        # jeu Steam : le temps Steam fait foi et couvre au moins les sessions locales
        jeu["temps"]["minutes_total"] = max(jeu["temps"]["minutes_total"], sum(s["duree_s"] for s in reelles) // 60 + 30)
        jeu["temps"]["dernier_lancement"] = iso(max(s["debut"] for s in ss))
sessions_json = [{"id": s["id"], "id_jeu": s["id_jeu"], "debut": iso(s["debut"]), "fin": iso(s["fin"]), "duree_s": s["duree_s"], "origine": s["origine"]} for s in sessions]

# ───────────── Succès : liste réelle en français, progression inventée ─────────────

succes = {}
for jeu in jeux:
    brut = succes_brut.get(jeu["steam_appid"]) if jeu["steam_appid"] else None
    if not brut:
        continue
    r = random.Random(GRAINE * 3 + jeu["id"])
    minutes = jeu["temps"]["minutes_total"]
    avancee = 0 if minutes == 0 else min(1.0, math.log10(1 + minutes / 60) / 2.4) * r.uniform(0.6, 1.25)
    dernier = jeu["temps"]["dernier_lancement"]
    fin = datetime.strptime(dernier, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) if dernier else MAINTENANT
    debut = datetime.strptime(jeu["ajoute_le"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    liste = []
    for s in brut:
        pct = float(s["player_percent_unlocked"]) if s.get("player_percent_unlocked") not in (None, "") else None
        chance = min(0.97, ((pct or 5) / 100) ** max(0.15, 1.15 - avancee)) if avancee > 0 else 0
        ok = r.random() < chance
        quand = debut + (fin - debut) * r.random() if ok and fin > debut else (fin if ok else None)
        liste.append({"api_name": s["internal_name"], "nom": s.get("localized_name") or s["internal_name"],
                      "description": s.get("localized_desc") or None, "secret": bool(s.get("hidden")),
                      "icone": BASE_SUCCES + f"{jeu['steam_appid']}/{s['icon']}", "icone_grise": BASE_SUCCES + f"{jeu['steam_appid']}/{s['icon_gray']}",
                      "pct_mondial": pct, "debloque": ok, "debloque_le": iso(quand) if quand else None})
    nb = sum(1 for s in liste if s["debloque"])
    jeu["succes"] = {"total": len(liste), "debloques": nb}
    succes[jeu["id"]] = {"id_jeu": jeu["id"], "langue": "fr", "total": len(liste), "debloques": nb, "progression_erreur": None, "liste": liste}

# ───────────── Actualités : vraies annonces, converties et nettoyées ─────────────

par_appid = {j["steam_appid"]: j for j in jeux if j["steam_appid"]}
actualites = []
for appid, evenements in news_brut.items():
    jeu = par_appid.get(appid)
    for ev in evenements or []:
        ab = ev.get("announcement_body") or {}
        if not jeu or not ab.get("body") or not ev.get("event_name"):
            continue
        corps = bbcode_vers_html(ab["body"])
        image = None
        try:
            jd = json.loads(ev.get("jsondata") or "{}")
            jd = jd if isinstance(jd, dict) else {}
            fichiers = jd.get("localized_capsule_image") or jd.get("localized_title_image") or []
            nom = next((f for f in [fichiers[2] if len(fichiers) > 2 else None, fichiers[0] if fichiers else None] if f), None)
            if nom and re.match(r"^[\w.-]+$", nom):
                image = f"{BASE_CLAN}{ab.get('clanid')}/{nom}"
        except (ValueError, TypeError, AttributeError):
            pass
        actualites.append({
            "id": str(ev["gid"]), "id_jeu": jeu["id"], "steam_appid": appid, "titre": ev["event_name"].strip(),
            "resume": texte_brut(corps), "html_sur": corps, "langue": {0: "en", 2: "fr"}.get(ab.get("language"), "autre"),
            "type": "mise_a_jour" if ev.get("event_type") in (12, 13) else "annonce", "date": iso_ts(ev["rtime32_start_time"]),
            "url": f"https://store.steampowered.com/news/app/{appid}/view/{ev['gid']}", "image": image,
        })
actualites.sort(key=lambda a: a["date"], reverse=True)

# ───────────── Amis et profil (entièrement inventés) ─────────────

PSEUDOS = ["Kaelis", "MamieGaming", "le_poulpe", "Zed_Mortel", "Aurore", "TonioDuSud", "pixel_fantome", "Myrtille", "GrosMinet42", "Ombeline",
           "Sk4r", "BaronPerché", "noisette", "Yuna.exe", "Capitaine_Flemme", "Lazuli", "Raph", "Tartiflette_Royale", "Io", "MaxLaMenace",
           "Sélène", "DocBrun", "petit_tonnerre", "Vesper", "Ganymède", "Chouquette", "N0X", "Félix", "LaBrume", "Oursin", "Camomille",
           "Hector", "Zéphyr", "mille_pattes", "Orion_77", "Clémentine", "Baltazar", "sardine", "Nyx", "Papy_Fragueur", "Élise", "Rouille",
           "Gaspard", "Mistral", "KiwiBleu", "Astrid", "Bob", "Wanda"]


# Emblèmes des avatars inventés, dessinés dans un carré de 64 : forme pleine, détails en aplat, détails au trait.
EMBLEMES = [
    ("M37 6 16 36h13l-4 22 23-32H35z", "", ""),                                                                    # éclair
    ("M32 5 55 16v20c0 11-10 18-23 23C19 54 9 47 9 36V16z", "M21 27l11 9 11-9v8l-11 9-11-9z", ""),                  # écu
    ("M41 9a23 23 0 1 0 14 35 19 19 0 0 1-14-35z", "", ""),                                                        # croissant
    ("M9 11l15 12h16l15-12-4 27-19 19-19-19z", "M20 32l9 3-7 4zM44 32l-9 3 7 4z", ""),                              # loup
    ("M10 45 7 19l14 11 11-18 11 18 14-11-3 26zM11 49h42v6H11z", "", ""),                                          # couronne
    ("M32 5c2 11 15 15 15 30a15 15 0 0 1-30 0c0-7 3-10 6-14 1 5 4 6 6 6 1-8-1-14 3-22z", "M32 34c3 4 6 6 6 11a6 6 0 0 1-12 0c0-4 4-6 6-11z", ""),  # flamme
    ("M32 7l7.3 15.6 17 2.1-12.5 11.8 3.3 16.9L32 45.6l-15.1 7.8 3.3-16.9L7.7 24.7l17-2.1z", "", ""),               # étoile
    ("M32 6a22 22 0 0 0-22 22v17l8 12h28l8-12V28A22 22 0 0 0 32 6z", "M14 27h36v9H37l-5 6-5-6H14z", ""),            # casque
    ("M5 32c8-12 18-18 27-18s19 6 27 18c-8 12-18 18-27 18S13 44 5 32z", "M32 22a10 10 0 1 0 .1 0zM32 28.5a3.5 3.5 0 1 1-.1 0z", ""),  # œil
    ("M32 3l5 9v27h9v6H36v12h-8V45H18v-6h9V12z", "", ""),                                                          # épée
    ("M32 7a21 21 0 0 0-21 21c0 8 4 12 8 15v10h26V43c4-3 8-7 8-15A21 21 0 0 0 32 7z", "M24 24a5.5 6 0 1 0 .1 0zM40 24a5.5 6 0 1 0 .1 0zM32 36l-3.5 6h7z", "M27 47v6M32 47v6M37 47v6"),  # crâne
    ("M32 7l23 23H43L32 19 21 30H9zM32 31l23 23H43L32 43 21 54H9z", "", ""),                                        # chevrons
    ("M11 10l13 11h16l13-11v28a21 19 0 0 1-42 0z", "M21 33l8 3-7 4zM43 33l-8 3 7 4zM30 44h4l-2 3z", ""),            # félin
    ("M24 9h16v15h15v16H40v15H24V40H9V24h15z", "M32 27a5 5 0 1 0 .1 0z", ""),                                       # croix directionnelle
    ("M20 11h24l13 15-25 29L7 26z", "", "M9 26h46M20 12l12 14 12-14M32 26v27"),                                    # gemme
    ("M32 16a16 16 0 1 0 .1 0z", "", "ANNEAU"),                                                                    # planète
]


def teinte_hex(teinte, saturation, lumiere):
    r, v, b = colorsys.hls_to_rgb((teinte % 360) / 360.0, lumiere, saturation)
    return "#%02x%02x%02x" % (round(r * 255), round(v * 255), round(b * 255))


def avatar_svg(rang):
    """Avatar inventé : un emblème sur un dégradé, comme une icône de profil de joueur.

    Le rang, et non un tirage, choisit l'emblème et la teinte : deux amis voisins dans la liste ne se
    ressemblent jamais (7 est premier avec 16, et 137,5° est l'angle d'or).
    """
    plein, aplat, trait = EMBLEMES[(rang * 7 + 3) % len(EMBLEMES)]
    teinte = rang * 137.5 + 20
    if rang % 3 == 1:        # un tiers des avatars : emblème coloré sur fond sombre
        haut, bas, encre, creux = teinte_hex(teinte, 0.34, 0.2), teinte_hex(teinte + 30, 0.4, 0.09), teinte_hex(teinte, 0.82, 0.64), teinte_hex(teinte + 30, 0.4, 0.1)
    else:
        haut, bas, encre, creux = teinte_hex(teinte, 0.62, 0.5), teinte_hex(teinte + 42, 0.66, 0.22), "#f5f7fa", teinte_hex(teinte + 30, 0.6, 0.26)
    details = f"<path d='{aplat}' fill='{creux}'/>" if aplat else ""
    if trait == "ANNEAU":
        details += f"<ellipse cx='32' cy='32' rx='27' ry='8' fill='none' stroke='{encre}' stroke-width='4' transform='rotate(-22 32 32)'/>"
    elif trait:
        details += f"<path d='{trait}' fill='none' stroke='{creux}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>"
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
           f"<defs><linearGradient id='f' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{haut}'/><stop offset='1' stop-color='{bas}'/></linearGradient></defs>"
           "<rect width='64' height='64' fill='url(#f)'/><path d='M-8 44 44-8h20L-8 64z' fill='#fff' opacity='.07'/>"
           "<g transform='translate(32 32) scale(.74) translate(-32 -32)'>"
           f"<path d='{plein}' fill='#000' opacity='.28' transform='translate(2.5 3.5)'/><path d='{plein}' fill='{encre}'/>{details}</g></svg>")
    return "data:image/svg+xml;utf8," + svg.replace("#", "%23")


r = random.Random(GRAINE)
populaires = [j for j in jeux if j["steam_appid"] and "multi" in j["modes"]][:60]
statuts = ["en_jeu"] * 8 + ["en_ligne"] * 8 + ["absent"] * 4 + ["occupe"] * 2
# Trois amis dont Steam n'a pas rendu l'avatar : l'interface dessine alors leur initiale.
SANS_AVATAR = {5, 21, 37}
# Un jeu du magasin Steam que nous n'avons pas : le cœur en donne quand même la jaquette.
HORS_BIBLIOTHEQUE = 1086940
amis = []
for n, pseudo in enumerate(PSEUDOS):
    statut = statuts[n] if n < len(statuts) else "hors_ligne"
    en_jeu = None
    if statut == "en_jeu":
        if n == 3:
            it = items[HORS_BIBLIOTHEQUE]
            assert HORS_BIBLIOTHEQUE not in sel["ids"]
            en_jeu = {"titre": it["name"], "steam_appid": HORS_BIBLIOTHEQUE, "id_jeu": None,
                      "jaquette": url_asset(it["assets"], "library_capsule"), "couleur_dominante": couleur(HORS_BIBLIOTHEQUE)}
        elif n == 5:
            # Un jeu hors Steam lancé par un raccourci : Steam n'en donne que le nom.
            en_jeu = {"titre": "Minecraft", "steam_appid": None, "id_jeu": None, "jaquette": None, "couleur_dominante": None}
        elif n in (6, 7):
            # Trois amis dans la même partie : l'écran Amis les réunit.
            en_jeu = dict(amis[2]["jeu_en_cours"])
        else:
            j = r.choice(populaires)
            en_jeu = {"titre": j["titre"], "steam_appid": j["steam_appid"], "id_jeu": j["id"],
                      "jaquette": j["jaquette"], "couleur_dominante": j["couleur_dominante"]}
    amis.append({"steamid": str(76561199000000000 + 1000 + n), "pseudo": pseudo, "avatar": None if n in SANS_AVATAR else avatar_svg(n),
                 "statut": statut, "jeu_en_cours": en_jeu,
                 "derniere_connexion": iso(MAINTENANT - timedelta(hours=r.lognormvariate(4, 1.6))) if statut == "hors_ligne" else None,
                 "ami_depuis": iso(datetime(2014, 1, 1, tzinfo=timezone.utc) + timedelta(days=r.uniform(0, 4600)))})

profil = {"steamid": "76561199000000001", "pseudo": "Nova", "avatar": avatar_svg(len(PSEUDOS) + 6)}
etat = {"version": "0.0.0-maquette", "en_ligne": True, "niveau": "personnel", "steam_installe": True, "cle": "valide", "premier_lancement": False,
        "scan": {"en_cours": False, "dernier": iso(MAINTENANT - timedelta(minutes=12)), "jeux_trouves": sum(1 for j in jeux if j["installe"])},
        "session_en_cours": None, "jeux_possedes_erreur": None, "sources_coupees": [], "mise_a_jour": None}
parametres = {"langue": "fr", "dossiers_a_scanner": ["D:\\Jeux"], "demarrer_avec_windows": False, "reduire_dans_la_zone_de_notification": True,
              "animations": "systeme",
              "sources_en_ligne": {"fiches_magasin": True, "succes_publics": True, "actualites": True, "visuels_magasin": True, "joueurs_en_ligne": True},
              "rapports_de_plantage": False, "reveler_les_succes_secrets": False,
              "affichage": {"vue": "grille", "taille_jaquettes": 180, "tri": "dernier_lancement", "ordre": "decroissant", "montrer_les_jeux_masques": False}}

utilises = {t for j in jeux for t in j["tags"]}
referentiels = {
    "fr": {"langue": "fr", "tags": sorted(({"id": t["tagid"], "nom": t["name"]} for t in tags_brut if t["tagid"] in utilises), key=lambda t: t["nom"].lower())},
    "en": {"langue": "en", "tags": sorted(({"id": t["tagid"], "nom": t["english_name"]} for t in tags_brut if t["tagid"] in utilises), key=lambda t: t["nom"].lower())},
}

# ───────────── Écriture ─────────────

tailles = {}
tailles["jeux.json"] = ecrit("jeux.json", jeux)
tailles["sessions.json"] = ecrit("sessions.json", sessions_json)
tailles["amis.json"] = ecrit("amis.json", amis)
tailles["actualites.json"] = ecrit("actualites.json", actualites)
tailles["referentiels.json"] = ecrit("referentiels.json", referentiels)
tailles["etat.json"] = ecrit("etat.json", {"etat": etat, "profil": profil, "parametres": parametres})
# Fiches et succès découpés par paquets de 100 identifiants : l'interface ne charge que le paquet du jeu ouvert.
paquets_f, paquets_s = {}, {}
for id_jeu, f in fiches.items():
    paquets_f.setdefault((id_jeu - 1) // 100, {})[str(id_jeu)] = {**f, "sources": sources_detail[id_jeu]}
for id_jeu, s in succes.items():
    paquets_s.setdefault((id_jeu - 1) // 100, {})[str(id_jeu)] = s
tailles["fiches/"] = sum(ecrit(f"fiches/{n:02d}.json", p) for n, p in paquets_f.items())
tailles["succes/"] = sum(ecrit(f"succes/{n:02d}.json", p) for n, p in paquets_s.items())

bilan = {
    "jeux": len(jeux), "steam": sum(1 for j in jeux if j["steam_appid"]), "hors_steam": sum(1 for j in jeux if not j["steam_appid"]),
    "installes": sum(1 for j in jeux if j["installe"]), "sans_jaquette": sum(1 for j in jeux if not j["jaquette"]),
    "jamais_lances": sum(1 for j in jeux if j["temps"]["minutes_total"] == 0), "favoris": sum(1 for j in jeux if j["favori"]),
    "masques": sum(1 for j in jeux if j["masque"]), "sessions": len(sessions_json), "jeux_avec_succes": len(succes),
    "succes_total": sum(s["total"] for s in succes.values()), "amis": len(amis), "actualites": len(actualites),
    "actualites_fr": sum(1 for a in actualites if a["langue"] == "fr"), "tags": len(referentiels["fr"]["tags"]),
    "fiches_avec_description_longue": sum(1 for f in fiches.values() if f["fiche"] and f["fiche"]["description_html"]),
    "octets": tailles,
}
ecrit("bilan.json", bilan)
print(json.dumps(bilan, ensure_ascii=False, indent=1))
