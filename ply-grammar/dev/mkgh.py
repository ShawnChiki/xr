"""Build the GitHub Pages copy (xr/ply-grammar/index.html) from the built page: full document, password gate on, launcher stamp."""
import sys
src=open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/ply-grammar.html').read()
out=sys.argv[2] if len(sys.argv)>2 else '/home/claude/xr/ply-grammar/index.html'
head='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script>window.PG_GATE=true</script>
</head>
<body>
'''
open(out,'w').write(head+src+'\n<script src="../updated.js"></script>\n</body>\n</html>\n')
print('wrote',out,len(src))
