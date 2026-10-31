"""Render all 14 exact CAD views at native 3840 x 2160.
Run npm run build and npm run preview first. Requires Python Playwright and Chrome.
Outputs responsive WebP/AVIF assets; the temporary PNGs stay in ignored .taste-skill.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,subprocess,json,sys
Path('.taste-skill').mkdir(exist_ok=True)
out=Path('public/showcase/robot'); out.mkdir(exist_ok=True)
sharp="""const sharp=require('sharp');const [src,out]=process.argv.slice(1); (async()=>{for(const width of [3840,1600,800]){await sharp(src).resize(width).webp({quality:95,alphaQuality:100,effort:5}).toFile(out+(width===1600?'':'-'+width)+'.webp'); if(width!==3840) await sharp(src).resize(width).avif({quality:85,effort:4}).toFile(out+(width===1600?'':'-'+width)+'.avif');}})();"""
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome')
 page=b.new_page(viewport={'width':3840,'height':2160},device_scale_factor=1,reduced_motion='reduce')
 page.on('pageerror',lambda e:print('ERROR',e,flush=True))
 page.goto('http://127.0.0.1:4321/work/frc/?showcase=capture&quality=high',wait_until='domcontentloaded');page.keyboard.press('Escape')
 page.wait_for_function('!!window.__showcase',timeout=180000)
 print('Canvas',page.locator('[data-kch-stage] canvas').evaluate('(c)=>[c.width,c.height]'),flush=True)
 ids=page.locator('[data-kch]').evaluate('(e)=>JSON.parse(e.dataset.stops)')
 for n,id in enumerate(ids):
  if len(sys.argv)>1 and id not in sys.argv[1:]: continue
  png=page.evaluate('(n)=>{window.__showcase.go(n-3); return window.__showcase.capture()}',n)
  path=Path('.taste-skill')/f'exact-{id}.png';path.write_bytes(base64.b64decode(png.split(',')[1]))
  subprocess.run(['node','-e',sharp,str(path),str(out/id)],check=True)
  print('Rendered',id,flush=True)
 b.close()
