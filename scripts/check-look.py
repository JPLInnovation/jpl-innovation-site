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
    # the logo intro plays on every full load; wait for it to hand over (html.splash goes)
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
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


# A sheet over the field, composited the way the eye sees it (the field behind, the sheet's own colour on top).
SHEET_ON_FIELD = """() => {
  const field = getComputedStyle(document.body).backgroundColor;
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:100px';
  document.body.appendChild(sheet);
  const fill = getComputedStyle(sheet).backgroundColor;
  const ink = getComputedStyle(sheet).color;
  sheet.remove();
  const ctx = document.createElement('canvas').getContext('2d');
  const px = (...styles) => { ctx.clearRect(0, 0, 1, 1); for (const s of styles) { ctx.fillStyle = s; ctx.fillRect(0, 0, 1, 1); } return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  return { back: px(field, fill), ink: px(ink), fill };
}"""


def check_surface(browser, base):
    # (a) a stored Solid holds before the first paint
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(INIT % {"theme": "dark", "extra": "localStorage.setItem('surface', 'solid');"})
    page.add_init_script("document.addEventListener('DOMContentLoaded', () => { window.__solidAtDcl = document.documentElement.classList.contains('solid'); });")
    page.goto(base + "/work/", wait_until="load")
    report(page.evaluate("window.__solidAtDcl === true"), "stored surface=solid: html.solid already set at DOMContentLoaded")
    page.close()
    # (b) the lens on Chrome; without backdrop-filter url() support, plain frosted glass, never opaque
    page = open_page(browser, base, "/work/", "dark", "localStorage.setItem('surface', 'glass');")
    report(page.evaluate("document.documentElement.classList.contains('lens')"), "Chrome with glass: html.lens on")
    page.close()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("const s = CSS.supports.bind(CSS); CSS.supports = (p, v) => (typeof v === 'string' && v.includes('url(') ? false : s(p, v));")
    page.add_init_script(INIT % {"theme": "dark", "extra": "localStorage.setItem('surface', 'glass');"})
    page.goto(base + "/work/", wait_until="load")
    fill = page.evaluate(SHEET_ON_FIELD)["fill"]
    report(not page.evaluate("document.documentElement.classList.contains('lens')"), "no url() support: no html.lens")
    report("/ 1)" not in fill and fill.count(",") >= 3 or "0." in fill, f"no url() support: the sheet stays see-through ({fill})")
    page.close()
    # (c) ink on a sheet, every theme and style
    for theme in ("light", "dark"):
        for style in ("glass", "solid"):
            page = open_page(browser, base, "/work/", theme, f"localStorage.setItem('surface', '{style}');")
            r = page.evaluate(SHEET_ON_FIELD)
            ratio = contrast(r["ink"], r["back"])
            report(ratio >= 4.5, f"{theme} + {style}: ink on a sheet over the field {ratio:.2f} (>= 4.5)")
            page.close()


def check_field(browser, base):
    # (a) a classic page: drawing
    page = open_page(browser, base, "/work/", "dark")
    a = page.evaluate("window.__field && window.__field.frames")
    page.mouse.move(400, 300)
    page.mouse.wheel(0, 300)
    page.wait_for_timeout(700)
    b = page.evaluate("window.__field && window.__field.frames")
    report(page.evaluate("window.__field && window.__field.paused === false") and b > a, f"/work/ classic: the field is drawing ({a} -> {b} frames)")
    # (c) a hidden tab: paused
    page.evaluate("Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(300)
    c = page.evaluate("window.__field.frames")
    page.wait_for_timeout(500)
    report(page.evaluate("window.__field.paused") and page.evaluate("window.__field.frames") == c, "hidden tab: the field is paused and draws nothing")
    page.close()
    # (b) the 3D studio: paused under it
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("try { localStorage.setItem('experience', '3d'); localStorage.setItem('hook-seen', '1'); localStorage.setItem('theme', 'dark'); } catch (e) {}")
    page.goto(base + "/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_function("document.querySelector('[data-studio]:not([data-read])')", timeout=15000)
    page.wait_for_timeout(800)
    report(page.evaluate("window.__field && window.__field.paused === true"), "home in 3D mode: the field is paused under the studio")
    page.close()


TITLE = """() => { const h = document.querySelector('main h1'); const cs = getComputedStyle(h);
  return { clip: cs.backgroundClip || cs.webkitBackgroundClip, color: cs.color, text: h.textContent.trim(), image: cs.backgroundImage }; }"""


def check_living(browser, base):
    for style in ("glass", "solid"):
        page = open_page(browser, base, "/work/", "dark", f"localStorage.setItem('surface', '{style}');")
        t = page.evaluate(TITLE)
        ink = page.evaluate(RESOLVE, "var(--ink)")
        report(bool(t["text"]), f"{style}: the page title still has its words ({t['text']!r})")
        if style == "glass":
            report("text" in t["clip"] and "gradient" in t["image"], f"glass: the page title carries living colour (clip {t['clip']})")
            report("rgba(0, 0, 0, 0)" in t["color"] or "transparent" in t["color"], f"glass: letters show the light ({t['color']})")
            violet = any(v in t["image"] for v in ("124, 58, 237", "139, 92, 246", "rgb(128, 0, 255)"))
            report(not violet, "glass: no violet in the living colour")
        else:
            col = page.evaluate(RESOLVE, t["color"])
            report(t["image"] == "none" and close(col, ink), f"solid: the page title is plain ink ({col} vs {ink}, image {t['image']})")
        page.close()


def make_stills(browser, base):
    """The blueprint space's still pictures (shown where the field can't run): the field alone, page content hidden."""
    from PIL import Image
    for theme in ("dark", "light"):
        page = open_page(browser, base, "/work/", theme)
        page.add_style_tag(content="body > *:not(.site-bg) { visibility: hidden !important; } html { scrollbar-width: none; }")
        page.wait_for_timeout(1500)
        page.screenshot(path=f"public/look/field-still-{theme}.png")
        im = Image.open(f"public/look/field-still-{theme}.png").convert("RGB")
        im.save(f"public/look/field-still-{theme}.webp", "WEBP", quality=70, method=6)
        import os
        os.remove(f"public/look/field-still-{theme}.png")
        size = os.path.getsize(f"public/look/field-still-{theme}.webp")
        report(size <= 120_000, f"still {theme}: {size // 1000} KB (<= 120 KB)")
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
    parser.add_argument("--make-stills", action="store_true", help="write public/look/field-still-*.webp and stop")
    args = parser.parse_args()
    proc = None if args.url else serve()
    base = (args.url or "http://localhost:4391").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            if args.make_stills:
                make_stills(browser, base)
            else:
                check_tokens(browser, base)
                check_surface(browser, base)
                check_field(browser, base)
                check_living(browser, base)
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{failures} failure(s)")
    sys.exit(failures)


if __name__ == "__main__":
    main()
