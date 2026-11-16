"""
The plain page's picture of the KitBot chapter (src/components/FrcChapter.astro, `.kch-field-still`): a still of the 3D
itself, the KitBot on the 2026 field as it shoots into its HUB (the stakes), taken in real Chrome on the real GPU with
the words, the HUD and the site's header hidden. Shown with reduced motion, on phones and in Classic.

    npm run build
    python scripts/bake-field-still.py [--port 4413]     writes public/chapter/frc/field-still.webp and -800.webp

Run it again whenever the field or the robot changes, then build again.
"""
import argparse, importlib.util, io, os, subprocess
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)
OUT = os.path.join(ROOT, "public", "chapter", "frc")
STOP = 1  # the stakes: the robot, the shot in the air and the HUB
HIDE = """header, .frc-cols, #kitbot :is(.kch-panels, .kch-hud, .kch-map, .kch-frame, .kch-veil, .kch-caption, .kch-gate, .kch-skip),
  #kitbot .stage-label { visibility: hidden !important; }
  html { scrollbar-width: none; }"""

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=4413)
args = ap.parse_args()
proc = cl.serve(args.port)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=False)
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.add_init_script(cl.INIT % {"theme": "dark", "extra": "localStorage.setItem('experience', '3d');"})
        page.goto(f"http://localhost:{args.port}/work/frc/", wait_until="load")
        page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
        page.evaluate("document.querySelector('#kitbot').scrollIntoView()")
        page.wait_for_function("document.querySelector('#kitbot').hasAttribute('data-live')", timeout=60000)
        page.evaluate(f"(() => {{ const t = document.querySelector('#kitbot .kch-track'); scrollTo(0, t.getBoundingClientRect().top + scrollY + {STOP} * innerHeight); }})()")
        page.wait_for_timeout(3000)
        page.add_style_tag(content=HIDE)
        page.wait_for_timeout(400)
        shot = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
        browser.close()
finally:
    subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

shot.save(os.path.join(OUT, "field-still.webp"), "WEBP", quality=80, method=6)
shot.resize((800, 450), Image.LANCZOS).save(os.path.join(OUT, "field-still-800.webp"), "WEBP", quality=80, method=6)
for name in ("field-still.webp", "field-still-800.webp"):
    print(name, os.path.getsize(os.path.join(OUT, name)), "bytes")
