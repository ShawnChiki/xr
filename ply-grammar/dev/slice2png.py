import json,sys
from PIL import Image,ImageDraw
# slice2png.py name... -> name.png (with legend)
ims=[]
for n in sys.argv[1:]:
    m=json.load(open(n+'.json'));im=Image.frombytes('RGB',(m['W'],m['H']),open(n+'.rgb','rb').read())
    cap=Image.new('RGB',(im.width,im.height+14*((len(m['legend'])+5)//6)+18),(255,255,255));cap.paste(im,(0,18));d=ImageDraw.Draw(cap);d.text((3,3),n,fill=(0,0,0))
    for i,(lab,c) in enumerate(m['legend']):
        x=3+(i%6)*80;y=im.height+18+14*(i//6);d.rectangle([x,y+2,x+9,y+11],fill=tuple(c));d.text((x+12,y),lab,fill=(0,0,0))
    ims.append(cap)
W=sum(i.width for i in ims)+10*len(ims);H=max(i.height for i in ims);out=Image.new('RGB',(W,H),(200,200,200));x=0
for i in ims:out.paste(i,(x,0));x+=i.width+10
out.save(sys.argv[1]+'.png');print(sys.argv[1]+'.png',out.size)
