#!/bin/bash
# two.sh design.json PART "OTHER,OTHER" : try the two-move exit of PART against the listed parts
D=$1 PART=$2 OTH=$3 JS='(()=>{const mp=mergeSplices(r.panels.filter(p=>p.part&&p.part.length));const P=mp.map(asmPart);const g=l=>P.find(p=>p.label===l);const A=g(process.env.PART),O=process.env.OTH.split(",").map(g);const out=[];const f2=v=>v.toArray().map(x=>+x.toFixed(2)).join(",");
 for(const s1 of [.75*1.45,.75*1.45*1.8,3,5])for(const d1 of [A.n.clone(),A.n.clone().negate()]){const r1=asmSweep(A,O,d1,s1);if(!r1.ok){out.push("unseat "+f2(d1)+" by "+s1.toFixed(2)+": hits "+r1.by.label+" at "+r1.s);continue}const o=d1.clone().multiplyScalar(s1);for(const d2 of [...asmDirs(A,O),...asmAlong(A)]){if(Math.abs(d2.dot(d1))>.9)continue;const rr=asmSweepFrom(A,O,o,d2);out.push("  unseat "+s1.toFixed(2)+" then "+f2(d2)+": "+(rr.ok?"OK":"hits "+rr.by.label+" at "+rr.s))}}return out})()' node hldu.mjs | python3 -c "
import json,sys
for l in json.load(sys.stdin):print(l)"
