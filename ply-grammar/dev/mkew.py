import re
s=open('ew_core.js').read()
names=re.findall(r'^export (?:function|const) ([A-Za-z_]\w*)',s,flags=re.M)
ex=re.findall(r'^export \{([^}]*)\};?',s,flags=re.M)
for e in ex: names+= [x.strip() for x in e.split(',') if x.strip()]
s=re.sub(r'^export \{[^}]*\};?\s*$','',s,flags=re.M)
s=re.sub(r'^export ','',s,flags=re.M)
open('ew.js','w').write('/* ---------------- Edgewise core (from xr/edgewise/core.js): strokes -> straight edges -> flat faces ---------------- */\nconst EW=(()=>{\n'+s+'\nreturn {'+','.join(dict.fromkeys(names))+'};})();\n')
print(len(names),names)
