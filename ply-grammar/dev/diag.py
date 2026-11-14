import math
def f(x):return f"{x:.2f}".rstrip('0').rstrip('.')
def dim(k,x1,y1,x2,y2,label,tx=None,ty=None,anchor='middle',tick=3.5):
    dx,dy=x2-x1,y2-y1;L=math.hypot(dx,dy);nx,ny=-dy/L*tick,dx/L*tick
    if tx is None:
        mx,my=(x1+x2)/2,(y1+y2)/2;tx,ty=mx,my-5 if abs(dy)<1e-6 else my
    s=f'<g class="dm" data-d="{k}"><line class="hit" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>'
    s+=f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>'
    for x,y in [(x1,y1),(x2,y2)]:s+=f'<line x1="{f(x-nx)}" y1="{f(y-ny)}" x2="{f(x+nx)}" y2="{f(y+ny)}"/>'
    return s+f'<text x="{f(tx)}" y="{f(ty)}" text-anchor="{anchor}">{label}</text></g>'
def call(k,x,y,lx,ly,label,tx,ty,anchor='start',extra=''):
    return (f'<g class="dm" data-d="{k}">{extra}<circle cx="{f(x)}" cy="{f(y)}" r="1.6"/><line class="hit" x1="{f(x)}" y1="{f(y)}" x2="{f(lx)}" y2="{f(ly)}"/>'
            f'<line class="lead" x1="{f(x)}" y1="{f(y)}" x2="{f(lx)}" y2="{f(ly)}"/><text x="{f(tx)}" y="{f(ty)}" text-anchor="{anchor}">{label}</text></g>')
def svg(w,h,body,lbl):return f'<svg class="dg" viewBox="0 0 {w} {h}" role="img" aria-label="{lbl}">{body}</svg>'
def poly(pts,cls):return f'<polygon class="{cls}" points="{" ".join(f(x)+","+f(y) for x,y in pts)}"/>'
def rect(x,y,w,h,cls):return f'<rect class="{cls}" x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}"/>'
def txt(x,y,s,anchor='start'):return f'<text class="t" x="{f(x)}" y="{f(y)}" text-anchor="{anchor}">{s}</text>'
D={}
# build
b=rect(30,34,120,24,'w')+''.join(f'<line class="ply" x1="31" y1="{y}" x2="149" y2="{y}"/>' for y in (40,46,52))
b+=dim('fullThk',22,34,22,58,'Full-size sheet',90,27)
b+=f'<g class="dm" data-d="scaleDen"><line class="hit" x1="158" y1="46" x2="188" y2="46"/><line x1="158" y1="46" x2="186" y2="46"/><path d="M182,42 L188,46 L182,50"/><text x="173" y="38" text-anchor="middle">Scale 1:n</text></g>'
b+=rect(196,43,60,6,'w')+dim('stock',264,43,264,49,'Model stock',226,64)
b+=txt(140,84,'The model is cut from your stock; joints size to it.','middle')
D['Build']=svg(280,92,b,'Full-size sheet, scale and model stock')
# fingers
y=10
b=f'<path class="w" d="M10,{12+y} H140 V{56+y} H114 V{30+y} H88 V{56+y} H62 V{30+y} H36 V{56+y} H10 Z"/>'
b+=f'<path class="w2" d="M10,{80+y} H140 V{60+y} H111 V{33+y} H91 V{60+y} H59 V{33+y} H39 V{60+y} H10 Z"/>'
b+=dim('finger',62,15,88,15,'Finger width',75,10)
b+=call('fitTol',37.5,45+y,37.5,96,'Fit gap',37.5,106,'middle')
b+=rect(160,40,102,16,'w')+rect(240,60,16,52,'w2')+'<line class="ds" x1="256" y1="30" x2="256" y2="118"/>'
b+=dim('sand',256,34,262,34,'Sanding allowance',264,27,'end')
b+=call('fitTol',248,58,215,86,'Fit gap',212,89,'end')
b+=txt(160,112,'section view')
D['Fingers']=svg(280,122,b,'Finger width, fit gap and sanding allowance')
# ribs
b=rect(10,14,108,36,'w')+''.join(f'<line class="rib" x1="{x}" y1="14" x2="{x}" y2="50"/>' for x in (46,82))+'<line class="rib" x1="10" y1="32" x2="118" y2="32"/>'
b+=dim('ribMax',46,58,82,58,'Max rib spacing',88,61,'start')
b+=txt(132,28,'Plan: ribs run both ways and')+txt(132,40,'half-lap where they cross.')
Y=76
b+=rect(10,Y+14,260,14,'w')
for x in (60,128,196):b+=rect(x-3,Y+14,30,14,'bg')
b+=f'<path class="w2" d="M30,{Y+80} V{Y+28} H60 V{Y+8} H84 V{Y+28} H128 V{Y+8} H152 V{Y+28} H196 V{Y+8} H220 V{Y+28} H250 V{Y+80} Z"/>'
b+=dim('tabW',128,Y+1,152,Y+1,'Tab width',140,Y-3)
b+=dim('slotEdgeMin',10,Y+8,57,Y+8,'Min wood',33,Y+4)
b+=call('tabExtra',220,Y+10,232,Y+2,'Tab stands proud',276,Y-2,'end')
b+=call('slotTol',85.5,Y+21,104,Y+40,'Slot fit gap',106,Y+43)
b+=dim('tabMargin',30,Y+88,60,Y+88,'End margin',45,Y+98)
b+=dim('tabGap',72,Y+88,140,Y+88,'Tab spacing',106,Y+98)
b+=txt(250,Y+74,'rib','end')
D['Ribs &amp; tabs']=svg(280,Y+102,b,'Rib spacing, tab and slot sizes')
# corner blocks
O=(170,128);t=12;u2=(.5,-.866);n2=(-.866,-.5)
Ci=(163.07,116);L2=96
e_out=(O[0]+L2*u2[0],O[1]+L2*u2[1]);e_in=(e_out[0]+t*n2[0],e_out[1]+t*n2[1])
b=poly([(14,116),Ci,O,(14,128)],'w')+poly([Ci,O,e_out,e_in],'w')
leg=52;dP=(-1,0)
P=lambda d,s:(Ci[0]+d[0]*s,Ci[1]+d[1]*s)
A1,A2,B1,B2=P(dP,4),P(dP,leg),P(u2,leg),P(u2,4)
dp=26;I=(Ci[0]+dp/.866*(dP[0]+u2[0]),Ci[1]+dp/.866*(dP[1]+u2[1]))
b+=poly([A1,A2,(A2[0],A2[1]-dp),I,(B1[0]+dp*n2[0],B1[1]+dp*n2[1]),B1,B2],'w2')
on=(-n2[0],-n2[1]);q=lambda p,a,s:(p[0]+a[0]*s,p[1]+a[1]*s)
b+=rect(Ci[0]-36,116,20,14,'w2')
c=P(u2,26);b+=poly([q(c,u2,-10),q(c,u2,10),q(q(c,u2,10),on,t+2),q(q(c,u2,-10),on,t+2)],'w2')
dep=15
for d_ in (9,44):x=Ci[0]-d_;b+=f'<line class="scr" x1="{f(x)}" y1="128" x2="{f(x)}" y2="{116-dep}"/>'
for s_ in (44,9):p0=q(P(u2,s_),on,t);p1=q(P(u2,s_),n2,dep);b+=f'<line class="scr" x1="{f(p0[0])}" y1="{f(p0[1])}" x2="{f(p1[0])}" y2="{f(p1[1])}"/>'
b+=call('cleatScrews',Ci[0]-44,108,84,86,'Screws per wall',14,82,'start')
b+=dim('cleatLeg',A2[0],139,Ci[0],139,'Leg length',(A2[0]+Ci[0])/2,149)
b+=dim('cleatDepth',A2[0]-7,116,A2[0]-7,116-dp,'Leg depth',A2[0]-12,107,'end')
b+=rect(14,14,136,10,'w')+''.join(rect(x,24,12,10,'w2') for x in (30,70,110))
b+=dim('cleatSpacing',36,42,76,42,'Spacing',56,52)+txt(156,22,'along the joint, from inside')
b+=txt(14,168,'Screws stagger so their tips stay apart.')
D['Corner blocks']=svg(280,176,b,'Corner block legs, screws and spacing')
# pilot holes
b=rect(10,30,120,14,'w')+rect(100,44,14,68,'w2')
b+='<line class="scr" x1="107" y1="26" x2="107" y2="92"/><line class="scr" x1="102" y1="26" x2="112" y2="26"/>'
b+=dim('screwLen',122,30,122,92,'Screw length',118,124,'middle')
b+=call('screwD',107,37,72,16,'Pilot hole',70,15,'end')
b+='<g class="dm" data-d="screwAngle"><path class="hit" d="M86,44 A14 14 0 0 0 100,58"/><path d="M86,44 A14 14 0 0 0 100,58"/><text x="84" y="70" text-anchor="end">Max angle off 90°</text></g>'
b+=rect(150,40,122,30,'w')+rect(176,26,80,14,'w')
b+='<circle class="sd" cx="196" cy="33" r="2.2"/><circle class="sd" cx="236" cy="33" r="2.2"/>'
b+=dim('fingerScrewGap',196,16,236,16,'Spacing on a finger',216,11)
b+='<line class="ds" x1="150" y1="20" x2="150" y2="84"/>'
b+=dim('screwCorner',150,80,196,80,'Corner clearance',173,92)
b+=call('screwMin',236,45,246,98,'Min screw spacing',272,108,'end','<circle class="kz" cx="236" cy="33" r="12"/>')
D['Pilot holes']=svg(280,128,b,'Screw length, pilot hole, spacing and clearances')
# labels
b=rect(30,12,220,76,'w')+'<text class="lb" x="140" y="62" text-anchor="middle" font-size="30">A3</text><text class="lb" x="140" y="81" text-anchor="middle" font-size="9">3B&gt;5D</text>'
b+=dim('labelH',176,40,176,62,'Part label',181,55,'start')
b+=dim('edgeLabelH',112,74,112,81,'Edge label',107,80,'end')
b+='<line class="ds" x1="30" y1="88" x2="250" y2="88"/>'
D['Labels']=svg(280,96,b,'Part label and edge label heights')
# cutting
b=rect(10,78,260,24,'sp')+rect(10,48,260,30,'w')+rect(120,48,20,34,'bg')
b+='<line class="ds" x1="114" y1="60" x2="146" y2="60"/><line class="ds" x1="114" y1="72" x2="146" y2="72"/>'
b+=rect(120,14,20,40,'bit')
b+=dim('bitD',120,8,140,8,'Cut bit Ø',114,11,'end')
b+=dim('stepdown',152,48,152,60,'Depth per pass',157,57,'start')
b+=dim('overcut',152,78,152,82,'Cut past sheet',157,85,'start')
b+=txt(16,98,'spoilboard')
D['Cutting']=svg(280,106,b,'Bit diameter, depth per pass and cut past sheet')
# toolpath corners
b='<path class="w" d="M16,30 H110 V68.69 A8 8 0 0 0 121.31,80 H158.69 A8 8 0 0 0 170,68.69 V30 H260 V118 H16 Z"/>'
b+='<circle class="bc" cx="115.66" cy="74.34" r="8"/>'
b+='<path class="tp" d="M118,16 V72 L115.66,74.34 L118,72 H162 L164.34,74.34 L162,72 V16"/>'
b+='<path class="tp" d="M268,112 V32 L258,22 H184"/><path class="ds" d="M268,32 V22 H258"/>'
b+=call('dogExtra',115.66,74.34,104,92,'Extra dog-ear depth',101,95,'end')
b+=call('dogW',115.66,74.34,104,104,'Dog-ear notch width',101,107,'end')
b+=call('chamfer',263,27,236,50,'Chamfer',232,53,'end')
b+=txt(186,16,'bit-center path')
D['Toolpath corners']=svg(280,124,b,'Dog-ears on inside corners and outside chamfer')
# engraving
b=rect(10,30,260,46,'w')+poly([(52,30),(68,30),(60,44)],'bg')+poly([(144,30),(168,30),(156,50.8)],'bg')+rect(248,30,14,8,'bg')
b+='<g class="dm" data-d="engTool"><path d="M56,37 Q60,34 64,37"/><text x="60" y="22" text-anchor="middle">V-bit angle</text></g>'
b+=dim('engDepth',74,30,74,44,'Label depth',79,41,'start')
b+=dim('pokeDepth',174,30,174,50.8,'Screw mark depth',179,48,'start')
b+=dim('engFlatD',248,22,262,22,'Flat bit Ø',255,15)
D['Engraving']=svg(280,84,b,'Engraving bit, label depth and screw mark depth')
# laser
b=rect(20,20,116,36,'w')+rect(144,20,116,36,'w')+'<line class="tp" x1="140" y1="14" x2="140" y2="62"/>'
b+=dim('kerf',136,12,144,12,'Kerf width',140,8)
b+=txt(140,72,'Cut lines sit half a kerf outside each part','middle')
D['Laser']=svg(280,78,b,'Laser kerf width')
# sheet
b=rect(10,14,240,92,'sh')+rect(22,22,70,40,'w')+rect(100,22,60,40,'w')+rect(22,70,96,28,'w')+rect(168,22,52,76,'w')
b+=dim('sheetW',10,116,250,116,'Width',130,126)
b+=f'<g class="dm" data-d="sheetH"><line class="hit" x1="258" y1="14" x2="258" y2="106"/><line x1="258" y1="14" x2="258" y2="106"/><line x1="254.5" y1="14" x2="261.5" y2="14"/><line x1="254.5" y1="106" x2="261.5" y2="106"/><text x="0" y="0" transform="translate(265 60) rotate(90)" text-anchor="middle">Height</text></g>'
b+=dim('gap',92,18,100,18,'Spacing',96,10)
D['Sheet']=svg(280,130,b,'Sheet width, height and part spacing')

# test
b='<line class="ln2" x1="10" y1="100" x2="270" y2="100"/>'
b+=f'<g class="dm" data-d="mu"><path d="'+''.join(f'M{x},100 l-6,8 ' for x in range(20,272,12))+'"/><text x="12" y="118">Ground grip</text></g>'
b+=poly([(110,100),(200,100),(200,52),(166,28),(110,28)],'w')
b+='<circle cx="152" cy="70" r="3" class="sd"/><line class="ds" x1="152" y1="70" x2="152" y2="100"/>'
b+=dim('arm',152,108,200,108,'tipping arm',176,118)
b+='<circle cx="200" cy="100" r="2.4" class="sd"/>'
b+='<g class="dm" data-d="pushX"><line class="hit" x1="50" y1="32" x2="106" y2="32"/><line x1="50" y1="32" x2="104" y2="32"/><path d="M98,27 L106,32 L98,37"/><text x="50" y="24">Push or kick</text></g>'
b+='<g class="dm" data-d="landG"><line class="hit" x1="138" y1="2" x2="138" y2="26"/><line x1="138" y1="4" x2="138" y2="24"/><path d="M133,18 L138,26 L143,18"/><text x="146" y="14">Landing</text></g>'
b+=txt(206,64,'tips when')+txt(206,76,'push × height')+txt(206,88,'> weight × arm')
D['Jumper']=svg(280,124,b,'Push, landing and ground grip on an obstacle')

# sharp bits
b=poly([(14,92),(124,92),(124,50),(40,50),(20,16),(30,50),(14,50)],'w')
b+='<path class="ds" d="M19,87 H119 V55 H19 Z"/>'+rect(156,50,110,42,'w2')
b+='<path class="lead" d="M132,71 H148"/><path class="lead" d="M143,67 L148,71 L143,75"/>'
b+=call('cleanR',119,71,140,30,'Cleanup distance',142,26,'start')
b+=txt(70,108,'drawn: in, then out','middle')+txt(211,108,'cut: sliver gone','middle')
D['Sharp bits']=svg(280,116,b,'Outline shrunk by the cleanup distance and grown back, removing a sliver')
# big parts
b=rect(10,24,130,62,'w')+rect(140,24,130,62,'w2')
b+='<path class="w" d="M138,38 H149 A7.2 7.2 0 1 1 149,46 H138 Z"/><path class="w2" d="M142,64 H131 A7.2 7.2 0 1 0 131,72 H142 Z"/>'
b+='<line class="ds" x1="140" y1="16" x2="140" y2="94"/>'
b+=dim('keyGap',100,42,100,68,'Key spacing',94,58,'end')
b+=txt(144,14,'seam')+txt(140,108,'glue the keys and mallet them together flat','middle')
D['Big parts']=svg(280,116,b,'A part split at a seam and joined by alternating puzzle keys')
