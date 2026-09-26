import re,sys
f,anchor=sys.argv[1],sys.argv[2]
lines=open(f).read().split('\n')
out=[];on=False;lvl=0
for l in lines:
    m=re.match(r'^(#+)\s',l)
    if m and on and len(m.group(1))<=lvl: break
    if m and '{#'+anchor+'}' in l: on=True;lvl=len(m.group(1))
    if on: out.append(l)
print('\n'.join(out))
