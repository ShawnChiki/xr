import re
exec(open('diag.py').read())
h=open('head.html').read()
h=re.sub(r'\n      <svg class="dg".*?</svg>','',h,flags=re.S)
for k,v in D.items():
    a=f'<h3>{k}</h3>';assert h.count(a)==1,k;h=h.replace(a,a+'\n      '+v)
open('head.html','w').write(h)
d='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
html=h+'<script type="module">\n'+open('pre.js').read()+open('geom.js').read()+open('post.js').read()+'</script>\n'
open('/home/claude/ply-grammar.html','w').write(html);open('m.mjs','w').write(open('pre.js').read()+open('geom.js').read()+open('post.js').read())
