"""
Renders the stills for the drone page's "Part by part" showcase: public/showcase/drone/<feature-id>.webp.
Phones, reduced motion and browsers without WebGL show them in place of the 3D (src/components/showcase.tsx);
a feature without its file just shows its text.

    npm run build
    npx astro preview                       (in another terminal; serves http://localhost:4321)
    python scripts/showcase-stills.py       (then build again: the page picks the pictures up by itself)

Options: --url (default http://localhost:4321/work/drone/), --out (default public/showcase/drone).
Needs Python Playwright (pip install playwright) and Google Chrome, which it drives (channel="chrome").
WebP: with Pillow (pip install pillow) if it's installed, otherwise through sharp, which ships with Astro.

How: ?showcase=capture makes the 3D stage fill the window, window.__showcase.go(n) shows stop n, and
window.__showcase.capture() returns the 3D alone (no labels or dots) as a PNG with a transparent background, so the
same picture works on the light and the dark theme.
"""

import argparse
import base64
import io
import pathlib
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIZE = {"width": 1200, "height": 900}  # the cards show the pictures at 4:3


def write_webp(png: bytes, path: pathlib.Path) -> None:
    try:
        from PIL import Image
    except ImportError:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(png)
        script = "require('sharp')(process.argv[1]).webp({ quality: 82, alphaQuality: 90 }).toFile(process.argv[2])"
        subprocess.run(["node", "-e", script, tmp.name, str(path)], cwd=ROOT, check=True)
        pathlib.Path(tmp.name).unlink()
        return
    Image.open(io.BytesIO(png)).save(path, "WEBP", quality=82, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://localhost:4321/work/drone/")
    parser.add_argument("--out", default=str(ROOT / "public" / "showcase" / "drone"))
    args = parser.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport=SIZE, device_scale_factor=1, reduced_motion="no-preference")
        page.goto(args.url.split("?")[0] + "?showcase=capture")
        page.locator(".showcase").scroll_into_view_if_needed()  # the showcase loads when it comes into view
        page.wait_for_function("() => window.__showcase", timeout=60_000)  # after the page's intro
        ids = page.eval_on_selector_all(".showcase-feature", "els => els.map((el) => el.id)")
        for n, feature in enumerate(ids):
            data_url = page.evaluate("(n) => { window.__showcase.go(n); return window.__showcase.capture(); }", n)
            path = out / f"{feature}.webp"
            write_webp(base64.b64decode(data_url.split(",", 1)[1]), path)
            print(f"{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")
        browser.close()


if __name__ == "__main__":
    main()
