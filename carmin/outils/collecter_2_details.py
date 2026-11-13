import json,subprocess,urllib.parse,time,sys,random
def get(url,tries=3):
    for a in range(tries):
        r=subprocess.run(["curl","-sS","-m","40","--compressed","-w","\n%{http_code}",url],capture_output=True,text=True)
        body,_,code=r.stdout.rpartition("\n")
        if code=="200":
            try: return json.loads(body)
            except Exception: pass
        if code in ("400","403","404"): return {"_http":code}
        time.sleep(2*(a+1))
    return {"_http":"fail"}
def svc(path,body): return get("https://api.steampowered.com/"+path+"?input_json="+urllib.parse.quote(json.dumps(body,separators=(',',':'))))
ctx={"language":"french","country_code":"FR"}
items=json.load(open('items_raw.json'))
sel=[x for x in items if x.get("success")==1 and x.get("type")==0 and x.get("visible") and x.get("assets",{}).get("library_capsule")
     and not ({1,3,4}&set(x.get('content_descriptorids',[]))) and x.get('reviews',{}).get('summary_filtered',{}).get('review_count',0)>=200
     and not x.get('is_coming_soon') and x.get('release',{}).get('steam_release_date')]
sel=sel[:1960]
ids=[x['appid'] for x in sel]
rnd=random.Random(20261111)
# installés : 120 jeux Steam, plutôt populaires (les autres installés seront des jeux non-Steam)
poids=[1.0/(1+i/250) for i in range(len(ids))]
inst=[]
while len(inst)<120:
    c=rnd.choices(ids,weights=poids)[0]
    if c not in inst: inst.append(c)
riches=list(inst)
for c in ids:
    if len(riches)>=300: break
    if c not in riches: riches.append(c)
json.dump({"ids":ids,"installes":inst,"riches":riches},open('selection.json','w'))
print("selection",len(ids),len(inst),len(riches),flush=True)
# A. détails légers pour tous
det=[]
for i in range(0,len(ids),150):
    d=svc("IStoreBrowseService/GetItems/v1/",{"ids":[{"appid":a} for a in ids[i:i+150]],"context":ctx,"data_request":{"include_screenshots":True,"include_ratings":True,"include_supported_languages":True}})
    det+=d.get("response",{}).get("store_items",[]); print("A",i,len(det),flush=True); time.sleep(0.7)
json.dump(det,open('details_all.json','w'),ensure_ascii=False)
# B. description complète + bandes-annonces pour les jeux riches
full=[]
for i in range(0,len(riches),60):
    d=svc("IStoreBrowseService/GetItems/v1/",{"ids":[{"appid":a} for a in riches[i:i+60]],"context":ctx,"data_request":{"include_full_description":True,"include_trailers":True}})
    full+=d.get("response",{}).get("store_items",[]); print("B",i,len(full),flush=True); time.sleep(0.7)
json.dump(full,open('details_riches.json','w'),ensure_ascii=False)
# C. noms des tags (FR + EN)
tagids=sorted({t for x in sel for t in x.get('tagids',[])})
tags=[]
for i in range(0,len(tagids),60):
    q="&".join(f"tagids%5B{j}%5D={t}" for j,t in enumerate(tagids[i:i+60]))
    d=get("https://api.steampowered.com/IStoreService/GetLocalizedNameForTags/v1/?language=french&"+q)
    tags+=d.get("response",{}).get("tags",[]); time.sleep(0.5)
json.dump(tags,open('tags.json','w'),ensure_ascii=False); print("C tags",len(tags),"/",len(tagids),flush=True)
# D. succès FR pour les jeux riches
ach={}
for n,a in enumerate(riches):
    d=get(f"https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/?appid={a}&language=french")
    ach[a]=d.get("response",{}).get("achievements",[]) if "_http" not in d else None
    if n%25==0: print("D",n,flush=True)
    time.sleep(0.45)
json.dump(ach,open('succes_raw.json','w'),ensure_ascii=False)
# E. annonces FR pour 45 jeux (installés d'abord)
news={}
for n,a in enumerate(riches[:45]):
    d=get(f"https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid={a}&offset=0&count=6&l=french")
    news[a]=d.get("events",[]) if "_http" not in d else None
    if n%10==0: print("E",n,flush=True)
    time.sleep(0.8)
json.dump(news,open('news_raw.json','w'),ensure_ascii=False)
print("DONE",flush=True)
