"""
Renders the stills for a page's scroll showcase, for each feature: public/showcase/<page>/<feature-id>.webp and
.avif at 1600 x 1200 (2x) and <feature-id>-800.webp / -800.avif at 800 x 600 (1x). The cards pick the size and
format they need (src/components/showcase.tsx). They're drawn by the site's own 3D stage on its high quality tier
(?quality=high: ambient occlusion, soft contact shadows, the full material finishes).
Phones, reduced motion and browsers without WebGL show them in place of the 3D (src/components/showcase.tsx);
a feature without its file just shows its text.

    npm run build
    npx astro preview                                   (in another terminal; serves http://localhost:4321)
    python scripts/showcase-stills.py                   the drone page's "Part by part"
    python scripts/showcase-stills.py --page robot      the FRC page's "The 2026 robot in 3D"
    (then build again: the pages pick the pictures up by themselves)

Options: --page (drone or robot), --url (default: that page on http://localhost:4321), --out (default
public/showcase/<page>), --executable (a Chrome or Chromium to drive, if neither below is found).
Needs Python Playwright (pip install playwright). It drives Google Chrome (channel="chrome") when it's installed,
and otherwise Playwright's own Chromium (python -m playwright install chromium).
The WebP and AVIF files are made by sharp, which ships with Astro (node_modules/sharp).

How: ?showcase=capture makes the 3D stage fill the window, window.__showcase.go(n) shows stop n (with any animation
posed for it), and window.__showcase.capture() returns the 3D alone (no labels or dots) as a PNG with a transparent
background, so the same picture works on the light and the dark theme. Its edges are faded out here, the same way
the page fades the live 3D, so close-ups dissolve instead of ending in a straight line.
"""

import argparse
import base64
import pathlib
import subprocess
import tempfile

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIZE = {"width": 1600, "height": 1200}  # the cards show the pictures at 4:3; this is the 2x size
SMALL = 800  # the 1x width
PAGES = {"drone": "/work/drone/", "robot": "/work/frc/"}
# The pages whose cards offer AVIF (src/components/showcase.tsx). The drone chapter's Classic cards
# (src/components/DroneChapter.astro) use WebP only, so the drone gets no AVIF copies.
AVIF = {"robot"}
# WebGL without a GPU, for Playwright's own Chromium (Chrome finds its own way).
GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

# The capture with its edges faded out, as in the page's CSS mask: clamp(1.5rem, 7%, 4rem) on each side.
FADE = """(url) => new Promise((done) => {
    const img = new Image();
    img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = "destination-in";
        for (const [w, h, size] of [[c.width, 0, c.width], [0, c.height, c.height]]) {
            const f = Math.min(64, Math.max(24, 0.07 * size)) / size;
            const ramp = g.createLinearGradient(0, 0, w, h);
            ramp.addColorStop(0, "rgba(0,0,0,0)");
            ramp.addColorStop(f, "#000");
            ramp.addColorStop(1 - f, "#000");
            ramp.addColorStop(1, "rgba(0,0,0,0)");
            g.fillStyle = ramp;
            g.fillRect(0, 0, c.width, c.height);
        }
        done(c.toDataURL("image/png"));
    };
    img.src = url;
})"""


# From one PNG: 2x and 1x WebP, and AVIF too where the page offers it (all keep the transparent background).
SHARP = """
const sharp = require('sharp');
const [png, base, small, avif] = process.argv.slice(1);
(async () => {
  for (const [suffix, width] of [['', null], ['-' + small, Number(small)]]) {
    const img = () => (width ? sharp(png).resize({ width }) : sharp(png));
    await img().webp({ quality: 78, alphaQuality: 85, effort: 6 }).toFile(base + suffix + '.webp');
    if (avif === '1') await img().avif({ quality: 55, effort: 6 }).toFile(base + suffix + '.avif');
  }
})().catch((e) => { console.error(e); process.exit(1); });
"""


def write_pictures(png: bytes, base: pathlib.Path, avif: bool) -> None:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(png)
    subprocess.run(["node", "-e", SHARP, tmp.name, str(base), str(SMALL), "1" if avif else "0"], cwd=ROOT, check=True)
    pathlib.Path(tmp.name).unlink()


def launch(p, executable: str | None):
    if executable:
        return p.chromium.launch(executable_path=executable, args=GL_ARGS)
    try:
        return p.chromium.launch(channel="chrome")
    except PlaywrightError:
        print("Google Chrome not found, using Playwright's Chromium.")
        return p.chromium.launch(args=GL_ARGS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--page", choices=sorted(PAGES), default="drone")
    parser.add_argument("--url")
    parser.add_argument("--out")
    parser.add_argument("--executable")
    parser.add_argument("--feature", help="Render only this feature ID")
    args = parser.parse_args()
    url = args.url or f"http://localhost:4321{PAGES[args.page]}"
    out = pathlib.Path(args.out or ROOT / "public" / "showcase" / args.page)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = launch(p, args.executable)
        page = browser.new_page(viewport=SIZE, device_scale_factor=1, reduced_motion="no-preference")
        page.goto(url.split("?")[0] + "?showcase=capture&quality=high")
        page.keyboard.press("Escape")  # skips the page's logo intro, if it has one
        page.locator(".showcase").scroll_into_view_if_needed()  # the showcase loads when it comes into view
        page.wait_for_function("() => window.__showcase", timeout=120_000)
        ids = page.eval_on_selector_all(".showcase-feature", "els => els.map((el) => el.id)")
        if args.feature and args.feature not in ids:
            raise ValueError(f"Unknown feature: {args.feature}; available: {', '.join(ids)}")
        for n, feature in enumerate(ids):
            if args.feature and feature != args.feature:
                continue
            data_url = page.evaluate(f"(n) => {{ window.__showcase.go(n); return ({FADE})(window.__showcase.capture()); }}", n)
            base = out / feature
            write_pictures(base64.b64decode(data_url.split(",", 1)[1]), base, args.page in AVIF)
            kinds = [".webp", f"-{SMALL}.webp"] + ([".avif", f"-{SMALL}.avif"] if args.page in AVIF else [])
            sizes = ", ".join(f"{(base.parent / (base.name + s)).stat().st_size // 1024} KB {s.lstrip('-')}" for s in kinds)
            print(f"{base.relative_to(ROOT) if base.is_relative_to(ROOT) else base}: {sizes}")
        browser.close()


if __name__ == "__main__":
    main()
