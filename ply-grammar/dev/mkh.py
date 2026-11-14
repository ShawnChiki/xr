import sys
pre=open('pre.js').read();geom=open('geom.js').read();s=open(sys.argv[2] if len(sys.argv)>2 else 'post.js').read()
hdr="import * as THREE from 'three';import {createRequire} from 'module';const require=createRequire(import.meta.url);globalThis.ClipperLib=require('clipper-lib');\n"
body=pre.split('\n',4)[4]
core=s[:s.index('/* ---------------- three.js scene')]
pm=s[s.index('/* ---------------- panel meshes'):s.index('/* ---------------- rebuild')]
test=open(sys.argv[1]).read()
open('h.mjs','w').write(hdr+"const V=THREE.Vector3,Q=THREE.Quaternion;\n"+body+geom+core+pm+test)
