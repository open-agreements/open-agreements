import re,glob,os,sys
D=os.path.expanduser('~/Projects/open-agreements/practice-guides/non-compete/us/')
skip={'american-samoa','cnmi','guam','puerto-rico','virgin-islands','index','log','ftc-rule-status'}
pat=re.compile(r'(effective|took effect|takes effect|take effect|enacted|signed|in force|operative|became law)',re.I)
yr=re.compile(r'202[4-7]')
for f in sorted(glob.glob(D+'*.md')):
    s=os.path.basename(f)[:-3]
    if s in skip: continue
    if len(sys.argv)>1 and s not in sys.argv[1:]: continue
    txt=open(f).read()
    print('=====',s)
    seen=set()
    for m in pat.finditer(txt):
        a=max(0,m.start()-220); b=min(len(txt),m.end()+220)
        w=txt[a:b]
        if not yr.search(w): continue
        if re.search(r'(retrieved|accessed|last.verified)',w,re.I) and not re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December) \d',w): continue
        k=a//300
        if k in seen: continue
        seen.add(k)
        print('  >',w.replace('\n',' '))
