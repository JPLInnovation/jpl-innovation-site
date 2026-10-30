"""
Pictures of the home studio's scenes for read mode (phones, reduced motion, no 3D; src/components/Studio.astro):
public/studio/scenes/<scene>.webp at 1600 x 900 and <scene>-800.webp at 800 x 450. Drawn by the studio itself on its
high quality tier, in the dark theme (the room at night, the way it opens).

    npm run build
    npx astro preview                                   (in another terminal; serves http://localhost:4321)
    python scripts/studio-stills.py
    (then build again)

Options: --url (default http://localhost:4321/), --only title,sketch (some scenes), --executable (a Chrome or
Chromium to drive). Needs Python Playwright; the WebP files are made by sharp (ships with Astro).

How: ?studio=capture hides the text and the ruler, and window.__studio.go(n) puts the camera straight on scene n.
"""

import argparse
import pathlib
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIZE = {"width": 1600, "height": 900}
SMALL = 800
# WebGL without a GPU, for Playwright's own Chromium.
GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
SHARP = "require('sharp')(process.argv[1]).resize({ width: Number(process.argv[3]) }).webp({ quality: 78 }).toFile(process.argv[2])"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://localhost:4321/")
    parser.add_argument("--only")
    parser.add_argument("--executable")
    args = parser.parse_args()
    out = ROOT / "public" / "studio" / "scenes"
    out.mkdir(parents=True, exist_ok=True)
    only = set(args.only.split(",")) if args.only else None
    with sync_playwright() as p:
        launch = {"args": GL_ARGS}
        if args.executable:
            launch["executable_path"] = args.executable
        browser = p.chromium.launch(**launch)
        page = browser.new_page(viewport=SIZE, color_scheme="dark")
        page.add_init_script("try{localStorage.setItem('theme','dark')}catch(e){}")
        page.goto(args.url + "?studio=capture&quality=high", wait_until="load")
        page.wait_for_function("window.__studio", timeout=180000)
        page.add_style_tag(content="[data-site-header]{display:none!important}")
        page.wait_for_timeout(4000)
        ids = page.evaluate("window.__studio.ids")
        for i, scene in enumerate(ids):
            if only and scene not in only:
                continue
            page.evaluate(f"window.__studio.go({i})")
            page.wait_for_timeout(12000)  # the lamp, the drone's LED, the whiteboard writing itself out (the drone never lifts off: not flown yet)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                page.locator(".studio-stage canvas").screenshot(path=tmp.name)
            for width, name in ((SIZE["width"], f"{scene}.webp"), (SMALL, f"{scene}-{SMALL}.webp")):
                subprocess.run(["node", "-e", SHARP, tmp.name, str(out / name), str(width)], cwd=ROOT, check=True)
            pathlib.Path(tmp.name).unlink()
            print(f"public/studio/scenes/{scene}.webp", (out / f"{scene}.webp").stat().st_size // 1024, "KB")
        browser.close()


if __name__ == "__main__":
    main()
