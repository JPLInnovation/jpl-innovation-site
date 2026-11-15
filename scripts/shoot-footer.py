"""
Screenshots of the footer (the back of the sheet) for looking at: each width and theme, the curtain half-way and at the
end of the page. Needs a running preview:  python scripts/shoot-footer.py --port 4408 [paths...]
Writes screenshots/footer/ (git-ignored).
"""
import argparse, importlib.util, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec); spec.loader.exec_module(cl)
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=4408)
ap.add_argument("--widths", default="1440,768,390")
ap.add_argument("paths", nargs="*", default=["", "work/", "about/"])
args = ap.parse_args()
OUT = os.path.join(ROOT, "screenshots", "footer")
os.makedirs(OUT, exist_ok=True)
SIZES = {1440: 900, 768: 1024, 390: 844}

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=False)
    for w in [int(x) for x in args.widths.split(",")]:
        for theme in ("dark", "light"):
            for path in args.paths:
                pg = b.new_page(viewport={"width": w, "height": SIZES[w]})
                pg.add_init_script(cl.INIT % {"theme": theme, "extra": ""})
                pg.goto(f"http://localhost:{args.port}/{path}", wait_until="load")
                pg.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
                name = (path.strip("/").replace("/", "-") or "home")
                end = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
                h = pg.evaluate("document.querySelector('[data-footer]').offsetHeight")
                for label, y in (("mid", end - min(h, SIZES[w]) / 2), ("end", end)):
                    pg.evaluate(f"scrollTo(0, {y})")
                    pg.wait_for_timeout(900)
                    pg.screenshot(path=os.path.join(OUT, f"{name}-{w}-{theme}-{label}.png"))
                pg.close()
    b.close()
print("saved to", OUT)
