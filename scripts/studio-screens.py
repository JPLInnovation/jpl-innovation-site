"""
Screenshots of the live pages that play on the studio's screens (src/lib/studio/room.ts): the build guide on the
desk monitor, this site on the laptop. Real pages, so what's on the screens is always what we actually made.

    npm run build && npx astro preview           (serves http://localhost:4321)
    python scripts/studio-screens.py              -> public/studio/research.webp, public/studio/site.webp

Options: --url (default http://localhost:4321), --executable (a Chrome or Chromium, if Playwright's isn't installed).
Needs Python Playwright; the WebP files are made by sharp (ships with Astro).
"""

import argparse
import pathlib
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = {
    # file: (path, width, height of the part kept, colour scheme)
    "research": ("/work/drone/build-guide/#s01", 1280, 3600, "light"),
    "site": ("/work/", 1280, 800, "dark"),
}
SHARP = "require('sharp')(process.argv[1]).resize({ width: Number(process.argv[3]) }).webp({ quality: 74 }).toFile(process.argv[2])"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://localhost:4321")
    parser.add_argument("--executable")
    args = parser.parse_args()
    out = ROOT / "public" / "studio"
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.executable) if args.executable else p.chromium.launch()
        for name, (path, width, height, scheme) in SHOTS.items():
            page = browser.new_page(viewport={"width": width, "height": 800}, color_scheme=scheme, reduced_motion="reduce")
            page.add_init_script(f"try{{localStorage.setItem('theme','{scheme}')}}catch(e){{}}")
            page.goto(args.url + path, wait_until="load")
            page.keyboard.press("Escape")
            page.wait_for_timeout(1500)
            y = page.evaluate("scrollY")
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                page.screenshot(path=tmp.name, full_page=True, clip={"x": 0, "y": y, "width": width, "height": height})
            target = out / f"{name}.webp"
            subprocess.run(["node", "-e", SHARP, tmp.name, str(target), "1024"], cwd=ROOT, check=True)
            pathlib.Path(tmp.name).unlink()
            print(target.relative_to(ROOT), target.stat().st_size // 1024, "KB")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
