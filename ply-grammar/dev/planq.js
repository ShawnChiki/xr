globalThis.PLANQ=r=>{const ps=mergeSplices(r.panels.filter(p=>p.part?.length)),faces=ps.filter(p=>p.kind==='face');const pl=planAssembly(ps,basePanel(faces).label);
  return {stuck:pl.steps.filter(s=>s.stuck).map(s=>pl.parts[s.i].label+'['+s.stuck.join('/')+']'),clash:pl.clash.length,steps:pl.steps.length,
    order:pl.steps.map(s=>pl.parts[s.i].label+(s.with.length?'+'+s.with.map(j=>pl.parts[j].label).join('+'):'')).join(' ')}};
