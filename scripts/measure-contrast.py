# Companion to measure-contrast.mjs: reads its JSON and prints the contrast of each text box over what is behind it.
# Usage: python scripts/measure-contrast.py OUTDIR/c-THEME-WIDTH.json [HOW_MANY_TO_LIST]
import json, sys
from PIL import Image
def lin(c):
    c/=255
    return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(r,g,b): return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def ratio(a,b):
    hi,lo=max(a,b),min(a,b)
    return (hi+0.05)/(lo+0.05)
data=json.load(open(sys.argv[1]))
worst=[]
for sc in data:
    im=Image.open(sc['shot']).convert('RGB'); W,H=im.size
    for it in sc['items']:
        x0,y0=int(max(0,it['x'])),int(max(0,it['y'])); x1,y1=int(min(W,it['x']+it['w'])),int(min(H,it['y']+it['h']))
        if x1<=x0 or y1<=y0: continue
        box=im.crop((x0,y0,x1,y1))
        px=list(box.get_flattened_data()) if hasattr(box,'get_flattened_data') else list(box.getdata())
        step=max(1,len(px)//400)
        rs=[]
        tr,tg,tb=it['color']; a=it['alpha']
        tl=None
        for (r,g,b) in px[::step]:
            er=tr*a+r*(1-a); eg=tg*a+g*(1-a); eb=tb*a+b*(1-a)
            rs.append(ratio(lum(er,eg,eb),lum(r,g,b)))
        rs.sort()
        low=rs[max(0,int(len(rs)*0.03))]   # 3rd percentile: ignores a few stray pixels
        big = it['size']>=24 or (it['size']>=18.66 and it['weight']>=700)
        need=3.0 if big else 4.5
        worst.append((low,need,sc['scene'],it['text'],round(it['size']),it['weight'],round(a,2)))
worst.sort()
fails=[w for w in worst if w[0]<w[1]]
print(f"{len(worst)} text boxes, {len(fails)} below AA (worst {worst[0][0]:.2f})" if worst else "no text")
for w in (fails or worst)[:int(sys.argv[2]) if len(sys.argv)>2 else 12]:
    print(f"  {w[0]:.2f} (need {w[1]})  scene={w[2]}  size={w[4]} w={w[5]} a={w[6]}  \"{w[3]}\"")
