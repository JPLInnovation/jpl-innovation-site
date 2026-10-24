"""
The pages on the 3D studio's screens, as tall screenshots cut into tiles (public/studio/screens/), and the list of tiles
the studio reads (src/lib/studio/screens.json). The screens scroll with the mouse wheel, so the text has to be sharp:
each page is shot at its real size, and a tile is only loaded when it scrolls into view.

    monitor  the build guide's reading column, from the top to the end of the parts list (desktop layout)
    laptop   Camera POV, the F450's ground station (desktop, 1280 wide)
    phone    the build guide's pre-flight checklist, stage 13 (phone, 390 wide)

Run it after the build guide or Camera POV changes:
    npm run build
    npx astro preview          (in another terminal)
    python scripts/studio-screens.py [--url http://localhost:4321] [--executable path/to/chrome]
Needs Python Playwright, and Chrome (or a Chromium given with --executable). Replaces the older single screenshots
(public/studio/research.webp and site.webp).
"""
import argparse
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "studio" / "screens"
MANIFEST = ROOT / "src" / "lib" / "studio" / "screens.json"
TILE = 2048  # tile height in CSS pixels

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://localhost:4321")
parser.add_argument("--executable", help="a Chrome or Chromium to use instead of the installed Chrome")
args = parser.parse_args()
OUT.mkdir(parents=True, exist_ok=True)


def shoot(page, name, top, height, width, left=0):
    """Cuts the page from `top` (CSS px) for `height`, `width` wide from `left`, into tiles; returns the manifest entry."""
    files = []
    for i, y in enumerate(range(0, height, TILE)):
        path = OUT / f"{name}-{i}.jpg"
        page.screenshot(path=str(path), full_page=True, type="jpeg", quality=82,
                        clip={"x": left, "y": top + y, "width": width, "height": min(TILE, height - y)})
        files.append(f"/studio/screens/{path.name}")
    print(f"{name}: {width} x {height}, {len(files)} tiles")
    return {"width": width, "height": height, "tile": TILE, "files": files}


screens = {}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.executable) if args.executable else p.chromium.launch(channel="chrome")

    page = browser.new_page(viewport={"width": 1280, "height": 760}, color_scheme="light")
    page.goto(args.url + "/work/drone/build-guide/", wait_until="networkidle")
    time.sleep(1.5)
    end = page.evaluate("Math.round(document.getElementById('s02').getBoundingClientRect().top + scrollY)")
    # Only the reading column (the stage list on its left is navigation), so the text is bigger on the monitor.
    left, width = page.evaluate("(() => { const r = document.querySelector('main').getBoundingClientRect(); return [Math.floor(r.left) - 16, Math.ceil(r.width) + 32]; })()")
    screens["guide"] = shoot(page, "guide", 0, end, width, left)

    page = browser.new_page(viewport={"width": 1280, "height": 820})
    page.goto(args.url + "/work/drone/camera-pov/", wait_until="networkidle")
    time.sleep(4)  # let the demo flight put numbers on the gauges
    screens["pov"] = shoot(page, "pov", 0, page.evaluate("document.documentElement.scrollHeight"), 1280)

    page = browser.new_page(viewport={"width": 390, "height": 844}, color_scheme="light", is_mobile=True, has_touch=True)
    page.goto(args.url + "/work/drone/build-guide/", wait_until="networkidle")
    time.sleep(1.5)
    top, height = page.evaluate("(() => { const r = document.getElementById('s13').getBoundingClientRect(); return [Math.round(r.top + scrollY), Math.round(r.height)]; })()")
    screens["checklist"] = shoot(page, "checklist", top, height, 390)

    browser.close()

MANIFEST.write_text(json.dumps(screens, indent="\t") + "\n", encoding="utf-8")
print(f"wrote {MANIFEST.relative_to(ROOT)}")
