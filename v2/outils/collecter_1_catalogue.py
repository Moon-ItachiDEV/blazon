import json,subprocess,urllib.parse,time,sys
def call(path,body):
    url="https://api.steampowered.com/"+path+"?input_json="+urllib.parse.quote(json.dumps(body,separators=(',',':')))
    for attempt in range(3):
        r=subprocess.run(["curl","-sS","-m","40","--compressed","-w","\n%{http_code}",url],capture_output=True,text=True)
        body_txt,_,code=r.stdout.rpartition("\n")
        if code=="200":
            return json.loads(body_txt)
        print("retry",code,file=sys.stderr); time.sleep(3*(attempt+1))
    raise SystemExit("failed "+path)
ctx={"language":"french","country_code":"FR"}
ids=[];start=0
while len(ids)<2700:
    d=call("IStoreQueryService/Query/v1/",{"query":{"start":start,"count":500,"sort":10,"filters":{"type_filters":{"include_games":True}}},"context":ctx,"data_request":{"include_basic_info":False}})
    got=[i["appid"] for i in d["response"].get("ids",[])]
    print("query start",start,"got",len(got),"total",d["response"]["metadata"].get("total_matching_records"))
    if not got: break
    ids+=got; start+=len(got); time.sleep(1)
ids=list(dict.fromkeys(ids))
json.dump(ids,open("ids.json","w"))
items=[]
for i in range(0,len(ids),150):
    d=call("IStoreBrowseService/GetItems/v1/",{"ids":[{"appid":a} for a in ids[i:i+150]],"context":ctx,"data_request":{"include_assets":True,"include_basic_info":True,"include_release":True,"include_platforms":True,"include_tag_count":8,"include_reviews":True}})
    got=d["response"].get("store_items",[])
    items+=got; print("items",i,len(got)); time.sleep(1)
json.dump(items,open("items_raw.json","w"),ensure_ascii=False)
ok=[x for x in items if x.get("success")==1 and x.get("type")==0 and x.get("visible") and x.get("assets",{}).get("library_capsule")]
print("total",len(items),"usable games",len(ok))
