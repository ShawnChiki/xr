import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
const V=THREE.Vector3, Q=THREE.Quaternion;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

/* ---------------- settings ----------------
   Design sizes (fingers, tabs, ribs, screw layout) are full size and scale with the model.
   Gaps, bits, labels and sheets are as cut. */
const FULL_DEF={machine:'cnc',fitTol:.02,sand:.03,slotTol:.02,tabExtra:.06,screws:true,screwD:.16,labelH:2,edgeLabelH:1,sheetW:96,sheetH:48,gap:.5,
  bitD:.25,overcut:.02,stepdown:.25,engDepth:.06,pokeDepth:.125,engFlatD:.0625,dogW:.002,dogExtra:0,chamfer:0,kerf:.006,feed:200,sheetCost:95,screwCost:.06,shopRate:75,cleanR:.25,keyGap:12};
const MODEL_DEF={machine:'laser',fitTol:.003,sand:.004,slotTol:.003,tabExtra:.01,screws:false,screwD:.03,labelH:.18,edgeLabelH:.09,sheetW:24,sheetH:18,gap:.12,
  bitD:.0625,overcut:.005,stepdown:.03,engDepth:.01,pokeDepth:.02,engFlatD:.0156,dogW:.001,dogExtra:0,chamfer:0,kerf:.006,feed:30,sheetCost:6,screwCost:0,shopRate:0,cleanR:.03,keyGap:3};
const S=Object.assign({scaleDen:1,fullThk:.75,stock:.09375,finger:6,ribs:true,waffle:true,slotEdgeMin:.75,ribMax:16,ribAxis:'long',tabW:3,tabGap:10,tabMargin:3,fingerScrews:2,fingerScrewGap:4,screwMark:'poke',
  screwLen:1.625,screwEvery:1,screwCorner:2,screwMin:1,screwAngle:15,skipFlagged:false,labels:true,explode:false,
  engTool:'v60',dogEars:true,showPaths:true,xrScale:'life',ribScrews:true,cleats:true,cleatSpacing:6,cleatLeg:5,cleatScrews:2,sanded:false,look:'color',glue:false,jumperLb:180,landG:3,pushX:1,mu:.5,plyPcf:42,secOn:false,secAx:'x',secPos:.5,secFlip:false,splice:true,screwFix:true,priceOn:true},FULL_DEF);
const scl=()=>1/S.scaleDen;                                            // model units (full-size inches) -> as cut
const thkModel=()=>S.scaleDen===1?S.fullThk:S.stock*S.scaleDen;       // panel thickness in model units
const PAL=['#E2366B','#8FCB2E','#2F6BFF','#FF8A1F','#19B5A1','#B03BE0','#F2C524','#FF4B3A','#4FC1FF','#6E52FF','#2FBF5B','#FF6FB0'];
const BLOCK_PAL=['#FF8A1F','#B03BE0','#8FCB2E','#2F6BFF','#E2366B','#19B5A1','#F2C524','#4FC1FF'];
const letter=i=>{let s='';do{s=String.fromCharCode(65+i%26)+s;i=Math.floor(i/26)-1}while(i>=0);return s};
const gcd=(a,b)=>b?gcd(b,a%b):a;
const frac=x=>{for(const d of [2,4,8,16,32,64]){const n=Math.round(x*d);if(n>0&&Math.abs(n/d-x)<1e-4){const w=Math.floor(n/d),r=n%d,g=gcd(r,d);return (w?w+(r?' ':''):'')+(r?(r/g)+'/'+(d/g):'')+'"'}}return (+x.toFixed(3))+'"'};

