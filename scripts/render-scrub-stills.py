"""
The home scrubber's pictures (src/components/home/Scrubber.astro): the F450 from its sketch, through its CAD render, to
the drone on the bench. Writes public/look/scrub/{sketch,bench}.webp at 1680 wide and -840.webp at 840 wide, all 3:2,
framed so the drone sits in the same place and at the same size as in the CAD render the middle stage uses
(public/showcase/drone/overview.webp, unchanged), so the scrub reads as one drone becoming real.

    npm run build
    python scripts/render-scrub-stills.py            starts `astro preview` on port 4401 itself
    python scripts/render-scrub-stills.py --url URL  or uses a server already running

  sketch  the studio's sketchbook page (src/lib/studio/sketch.ts, its words from src/text/studio.ts), drawn at 2x in a
          blank page; cropped around the drone from above.
  bench   the studio's build scene (?studio=capture, the drone on its bench mat), drawn at 2x by the studio on its high
          tier in Chrome on the real GPU; cropped around the drone. A render: the caption says so until a photograph of
          the built F450 exists.

Needs Python Playwright, Pillow, and Chrome.
"""

import argparse
import base64
import importlib.util
import io
import os
import pathlib
import subprocess
import tempfile

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "look" / "scrub"
WIDTH = 1680  # 3:2, the 2x size for the plate (about 1100 px wide at 1440)

# Where the drone sits in the CAD render shown 3:2 (its centre, and its span as a share of the width), measured on
# public/showcase/drone/overview.webp. The other two stages are cropped to match.
CENTRE = (0.54, 0.47)
SPAN = 0.72
# The sketch shows its whole page around the drone: the drone at this share of the width (the scrubber's zoom is
# SPAN / SKETCH_SPAN, in Scrubber.astro).
SKETCH_SPAN = 0.3


def crop_to(im, cx, cy, span_px, span=SPAN):
    """Crop `im` to 3:2 so the point (cx, cy) lands at CENTRE and a span of span_px is `span` of the width."""
    w = span_px / span
    h = w * 2 / 3
    # kept inside the picture (a few pixels off centre rather than a black edge)
    left = min(max(0, cx - CENTRE[0] * w), im.width - w)
    top = min(max(0, cy - CENTRE[1] * h), im.height - h)
    return im.crop((round(left), round(top), round(left + w), round(top + h)))


def save(im, name):
    OUT.mkdir(parents=True, exist_ok=True)
    big = im.convert("RGB").resize((WIDTH, WIDTH * 2 // 3), Image.LANCZOS)
    big.save(OUT / f"{name}.webp", "WEBP", quality=80, method=6)
    big.resize((WIDTH // 2, WIDTH // 3), Image.LANCZOS).save(OUT / f"{name}-840.webp", "WEBP", quality=80, method=6)
    for f in (f"{name}.webp", f"{name}-840.webp"):
        print(f, (OUT / f).stat().st_size // 1000, "KB")


ENTRY = """
import { createSketch, SKETCH_WIDTH, SKETCH_HEIGHT } from "%(root)s/src/lib/studio/sketch.ts";
import { sketchText } from "%(root)s/src/text/studio.ts";
import { roadmap } from "%(root)s/src/text/projects/drone.ts";
window.drawSketch = async (scale) => {
  await document.fonts.load('600 40px "Caveat"');
  const canvas = document.createElement("canvas");
  canvas.width = SKETCH_WIDTH * scale;
  canvas.height = SKETCH_HEIGHT * scale;
  const g = canvas.getContext("2d");
  g.scale(scale, scale);
  const sketch = createSketch({ g, redraw() {} }, sketchText, { states: roadmap.map((s) => s.state) });
  sketch.show(1);
  await new Promise((r) => setTimeout(r, 400)); // its own font reload redraws the page once
  return canvas.toDataURL("image/png");
};
"""


def render_sketch(browser):
    with tempfile.TemporaryDirectory() as tmp:
        entry = pathlib.Path(tmp) / "entry.js"
        entry.write_text(ENTRY % {"root": ROOT.as_posix()}, encoding="utf-8")
        bundle = pathlib.Path(tmp) / "sketch.js"
        js = f"require('esbuild').build({{ entryPoints: [{str(entry.as_posix())!r}], bundle: true, format: 'iife', outfile: {str(bundle.as_posix())!r}, logLevel: 'error' }})"
        subprocess.run(["node", "-e", js], cwd=ROOT, check=True)
        code = bundle.read_text(encoding="utf-8")
    font = base64.b64encode((ROOT / "public" / "fonts" / "caveat-600.woff2").read_bytes()).decode()
    page = browser.new_page()
    page.set_content(f"<style>@font-face{{font-family:Caveat;font-weight:600;src:url(data:font/woff2;base64,{font}) format('woff2')}}</style><p style='font:600 20px Caveat'>.</p>")
    page.add_script_tag(content=code)
    url = page.evaluate("window.drawSketch(2)")
    page.close()
    im = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1])))
    # The drone from above: centre (1330, 346) in page units, prop tip to prop tip about 330 wide (sketch.ts). Here it
    # spans SKETCH_SPAN of the width, the page around it; the scrubber zooms it up to the CAD render's size as it goes.
    save(crop_to(im, 1330 * 2, 346 * 2, 330 * 2, SKETCH_SPAN), "sketch")


def render_bench(browser, base):
    page = browser.new_page(viewport={"width": 3200, "height": 1800})
    page.add_init_script(
        "try { localStorage.setItem('experience', '3d'); localStorage.setItem('hook-seen', '1'); localStorage.setItem('theme', 'dark');"
        " ['jpl', 'frc', 'drone'].forEach((k) => sessionStorage.setItem(k + '-intro-seen', '1')); } catch (e) {}"
    )
    page.goto(base + "/?studio=capture&quality=high", wait_until="load")
    page.wait_for_function("window.__studio", timeout=180000)
    page.add_style_tag(content="[data-site-header]{display:none!important}")
    page.wait_for_timeout(4000)
    ids = page.evaluate("window.__studio.ids")
    page.evaluate(f"window.__studio.go({ids.index('build')})")
    page.wait_for_timeout(12000)
    im = Image.open(io.BytesIO(page.locator(".studio-stage canvas").screenshot()))
    page.close()
    if os.environ.get("SCRUB_DEBUG"):
        im.save(ROOT / "screenshots" / "bench-full.png")  # git-ignored
    # The drone on the bench mat in the build scene: centre and span measured on the 1600-wide still, times 2.
    save(crop_to(im, 1112 * 2, 445 * 2, 610 * 2), "bench")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--port", type=int, default=4401)
    parser.add_argument("--only", choices=["sketch", "bench"])
    args = parser.parse_args()
    proc = None
    if not args.url and args.only != "sketch":
        spec = importlib.util.spec_from_file_location("cl", ROOT / "scripts" / "check-look.py")
        cl = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cl)
        proc = cl.serve(args.port)
    base = (args.url or f"http://localhost:{args.port}").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            if args.only != "bench":
                render_sketch(browser)
            if args.only != "sketch":
                render_bench(browser, base)
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
