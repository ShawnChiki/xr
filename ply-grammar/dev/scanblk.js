globalThis.SCANBLK=r=>{const by={};for(const s of r.screws){if(!s.edge||!/^(J|JK)\d/.test(s.edge))continue;(by[s.edge]=by[s.edge]||new Set()).add(s.name)}
  const one=Object.entries(by).filter(([k,v])=>v.size<2).map(([k,v])=>k+':'+[...v].join('/'));const nb=r.panels.filter(p=>p.kind==='cleat').length;
  return {blocks:nb,keys:Object.keys(by).length,oneSided:one}};
