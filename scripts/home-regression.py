"""
Home regression check: Home must look the same when the 3D opening hook isn't playing (hook B, the `hook3d` flag in
src/lib/studio/engine.ts). It captures every studio scene (?studio=capture, the hook marked as seen) in both themes, and
Classic Home in both themes, then compares them with a saved baseline.

    npm run build
    npx astro preview --port 4391                       (in another terminal)
    python scripts/home-regression.py --save base       before a change: the baseline
    python scripts/home-regression.py --compare base    after it: fails if a picture differs

Pictures go to audit/regression/<name>/ (ignored by git). The studio keeps a little life of its own (dust, the
traffic outside, a breath of camera sway), so a picture passes when under 2 % of its pixels differ noticeably; each
comparison also writes a diff picture (red where it differs) to look at.

Options: --url (default http://localhost:4391), --executable (a Chrome or Chromium to drive). Needs Python Playwright,
and sharp (it ships with Astro) for the comparison.
"""

import argparse
import json
import pathlib
import subprocess
import sys

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "audit" / "regression"
GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
LIMIT = 0.02  # share of pixels that may differ noticeably

COMPARE = """
const sharp = require('sharp');
const [a, b, diffPath] = process.argv.slice(1);
(async () => {
  const [x, y] = await Promise.all([a, b].map((p) => sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) { console.log(JSON.stringify({ share: 1, size: true })); return; }
  const out = Buffer.alloc(x.data.length);
  let n = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    const d = Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2]);
    const hit = d > 48;
    if (hit) n++;
    out[i] = hit ? 255 : x.data[i] * 0.3; out[i + 1] = hit ? 0 : x.data[i + 1] * 0.3; out[i + 2] = hit ? 0 : x.data[i + 2] * 0.3; out[i + 3] = 255;
  }
  await sharp(out, { raw: x.info }).png().toFile(diffPath);
  console.log(JSON.stringify({ share: n / (x.data.length / 4) }));
})().catch((e) => { console.error(e); process.exit(1); });
"""


def launch(p, executable):
    if executable:
        return p.chromium.launch(executable_path=executable, args=GL_ARGS)
    try:
        return p.chromium.launch(channel="chrome")
    except PlaywrightError:
        return p.chromium.launch(args=GL_ARGS)


def capture(url: str, folder: pathlib.Path, executable) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = launch(p, executable)
        for theme in ["dark", "light"]:
            # The 3D studio, every scene.
            page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            page.add_init_script(f"localStorage.setItem('experience', '3d'); localStorage.setItem('theme', '{theme}'); localStorage.setItem('hook-seen', '1');")
            page.goto(url + "/?studio=capture", wait_until="networkidle")
            page.keyboard.press("Escape")
            page.wait_for_function("() => window.__studio", timeout=120_000)
            page.wait_for_timeout(5000)
            ids = page.evaluate("() => window.__studio.ids")
            for i, scene in enumerate(ids):
                page.evaluate(f"() => window.__studio.go({i})")
                page.wait_for_timeout(2200)
                page.screenshot(path=str(folder / f"3d-{theme}-{i:02d}-{scene}.png"))
            page.close()
            # Classic, the whole page, still (no reveal animations).
            page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1, reduced_motion="reduce")
            page.add_init_script(f"localStorage.setItem('experience', 'classic'); localStorage.setItem('theme', '{theme}'); localStorage.setItem('hook-seen', '1');")
            page.goto(url + "/", wait_until="networkidle")
            page.keyboard.press("Escape")
            page.wait_for_timeout(3000)
            page.screenshot(path=str(folder / f"classic-{theme}.png"), full_page=True)
            page.close()
        browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--save", metavar="NAME", help="capture a baseline")
    mode.add_argument("--compare", metavar="NAME", help="capture now and compare with this baseline")
    parser.add_argument("--url", default="http://localhost:4391")
    parser.add_argument("--executable")
    args = parser.parse_args()
    if args.save:
        capture(args.url, OUT / args.save, args.executable)
        print(f"Saved {len(list((OUT / args.save).glob('*.png')))} pictures to {OUT / args.save}")
        return
    base = OUT / args.compare
    now = OUT / (args.compare + "-now")
    capture(args.url, now, args.executable)
    failed = 0
    for picture in sorted(base.glob("*.png")):
        other = now / picture.name
        if not other.exists():
            print(f"MISSING  {picture.name}")
            failed += 1
            continue
        diff = now / ("diff-" + picture.name)
        result = json.loads(subprocess.run(["node", "-e", COMPARE, str(picture), str(other), str(diff)], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
        ok = result["share"] <= LIMIT
        failed += 0 if ok else 1
        print(f"{'ok  ' if ok else 'FAIL'}  {result['share'] * 100:5.2f} %  {picture.name}")
    print("Home unchanged." if not failed else f"{failed} picture(s) differ: see the diff-*.png in {now}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
