import json,sys,os
from PIL import Image,ImageDraw
# sheet.py dir out.png [cols] : contact sheet of block sections
d=sys.argv[1];idx=json.load(open(d+'/index.json'));cols=int(sys.argv[3]) if len(sys.argv)>3 else 5
tiles=[]
for e in idx:
    im=Image.frombytes('RGB',(e['W'],e['H']),open(f"{d}/{e['label']}.rgb",'rb').read())
    cap=Image.new('RGB',(max(im.width,330),im.height+16+12*((len(e['legend'])+3)//4)),(255,255,255));cap.paste(im,(0,16));dr=ImageDraw.Draw(cap)
    dr.text((2,2),f"{e['label']} {e['joint']}{' INSIDE' if e['rfx'] else ''}{' RIB' if e['rib'] else ''}",fill=(0,0,0))
    for i,(lab,c) in enumerate(e['legend']):
        x=2+(i%4)*80;y=im.height+16+12*(i//4);dr.rectangle([x,y+2,x+8,y+10],fill=tuple(c));dr.text((x+11,y),lab,fill=(0,0,0))
    tiles.append(cap)
if not tiles:print('no blocks');sys.exit()
tw=max(t.width for t in tiles)+8;rows=[tiles[i:i+cols] for i in range(0,len(tiles),cols)];hs=[max(t.height for t in r)+8 for r in rows]
out=Image.new('RGB',(tw*cols,sum(hs)),(200,200,200));y=0
for r,h in zip(rows,hs):
    for i,t in enumerate(r):out.paste(t,(i*tw+4,y+4))
    y+=h
out.save(sys.argv[2]);print(sys.argv[2],out.size,len(tiles),'blocks')
