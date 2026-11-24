#!/bin/bash
# fz.js = fzbase.js with blkaudit.js spliced in
python3 - <<'PY'
s=open('fzbase.js').read();b=open('blkaudit.js').read()
import re
i=s.index("/* deep corner-block audit");j=s.index("const N=+process.argv[2]||100")
s=s[:i]+b+s[j:]
open('fz.js','w').write(s)
PY
python3 mkh.py fz.js >/dev/null && cp h.mjs hfz.mjs && node --check hfz.mjs
python3 mkh.py ld.js >/dev/null && cp h.mjs hldu.mjs && node --check hldu.mjs
