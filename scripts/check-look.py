"""
The redesign's page checks (docs/superpowers/plans/2026-11-15-redesign-phase1-foundation.md), in real Chrome.

    npm run build
    python scripts/check-look.py                 starts `astro preview` on port 4391 itself, and stops it after
    python scripts/check-look.py --url URL       or checks a server that is already running

Each check prints PASS or FAIL with what it measured; the exit code is the number of failures.
"""

import argparse
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

PAGES = ["/", "/work/", "/members/", "/about/"]
SPEC = {"dark": {"field": "#0a174e", "ink": "#f2eedf"}, "light": {"field": "#f2eedf", "ink": "#0a174e"}}

# Classic mode, intros already seen, the chosen theme. Runs before any page script.
INIT = """
try {
  localStorage.setItem('experience', 'classic');
  localStorage.setItem('theme', '%(theme)s');
  %(extra)s
  ['jpl', 'frc', 'drone'].forEach((k) => sessionStorage.setItem(k + '-intro-seen', '1'));
} catch (e) {}
"""

# Resolves a colour expression to rgb through a probe element, so color-mix() and var() come back as numbers.
RESOLVE = """(expr) => {
  const probe = document.createElement('div');
  probe.style.color = expr;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  const canvas = document.createElement('canvas').getContext('2d');
  canvas.fillStyle = c; canvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}"""

failures = 0


def report(ok, what):
    global failures
    print(("PASS " if ok else "FAIL ") + what)
    if not ok:
        failures += 1


def hex_rgb(h):
    h = h.lstrip("#")
    return [int(h[i : i + 2], 16) for i in (0, 2, 4)]


def contrast(a, b):
    def lum(c):
        def ch(v):
            v /= 255
            return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

        r, g, b2 = (ch(x) for x in c)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b2

    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def close(a, b, tol=3):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def open_page(browser, base, path, theme, extra=""):
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(INIT % {"theme": theme, "extra": extra})
    page.goto(base + path, wait_until="load")
    page.wait_for_timeout(600)
    return page


def check_tokens(browser, base):
    for theme in ("dark", "light"):
        for path in PAGES:
            page = open_page(browser, base, path, theme)
            resolve = lambda expr: page.evaluate(RESOLVE, expr)
            field = resolve("var(--field)")
            report(close(field, hex_rgb(SPEC[theme]["field"])), f"{theme} {path} --field = {field} (spec {SPEC[theme]['field']})")
            ink = resolve("var(--ink)")
            sheet = resolve("var(--sheet)")
            ratio = contrast(ink, sheet)
            report(ratio >= 4.5, f"{theme} {path} ink on sheet contrast {ratio:.2f} (>= 4.5)")
            page.close()


def serve():
    proc = subprocess.Popen("npx astro preview --port 4391", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            urllib.request.urlopen("http://localhost:4391/", timeout=1)
            return proc
        except Exception:
            time.sleep(0.5)
    proc.kill()
    sys.exit("preview server did not start")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    args = parser.parse_args()
    proc = None if args.url else serve()
    base = (args.url or "http://localhost:4391").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            check_tokens(browser, base)
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{failures} failure(s)")
    sys.exit(failures)


if __name__ == "__main__":
    main()
