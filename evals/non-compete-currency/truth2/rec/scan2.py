import re,glob,os,sys
D=os.path.expanduser('~/Projects/open-agreements/practice-guides/non-compete/us/')
skip={'american-samoa','cnmi','guam','puerto-rico','virgin-islands','index','log','ftc-rule-status'}
pat=re.compile(r'((January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 202[4-7]|\(eff\.[^)]*\)|effective (on )?(passage|approval))')
for f in sorted(glob.glob(D+'*.md')):
    s=os.path.basename(f)[:-3]
    if s in skip: continue
    if len(sys.argv)>1 and s not in sys.argv[1:]: continue
    txt=open(f).read()
    print('=====',s)
    last=-1000
    for m in pat.finditer(txt):
        if m.start()-last<250: continue
        last=m.start()
        w=txt[max(0,m.start()-180):m.end()+120].replace('\n',' ')
        if 'Ryan' in w or 'SET ASIDE' in w: continue
        print('  >',w)
