"""
The redesign's page checks (docs/superpowers/plans/2026-11-15-redesign-phase1-foundation.md), in real Chrome.

    npm run build
    python scripts/check-look.py                 starts `astro preview` on port 4391 itself, and stops it after
    python scripts/check-look.py --url URL       or checks a server that is already running

Each check prints PASS or FAIL with what it measured; the exit code is the number of failures.
"""

import argparse
import re
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


def alpha(css_colour):
    """The alpha of a computed colour (rgb(), rgba(), oklab(... / a)); 1 when it has none."""
    m = re.search(r"/\s*([\d.]+)\s*\)", css_colour) or re.search(r"rgba\([^)]*,\s*([\d.]+)\s*\)", css_colour)
    return float(m.group(1)) if m else 1.0


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
    report(alpha(fill) < 1, f"no url() support: the sheet stays see-through ({fill})")
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
    check_blueprint(browser, base)


SCROLL_TO = "(at) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * at)"


def check_blueprint(browser, base):
    """Phase 2's living blueprint: each page's drawing, drafted by the scroll; day sections; the still."""
    page = open_page(browser, base, "/work/drone/", "dark")
    page.mouse.move(700, 400)
    page.wait_for_timeout(800)
    top = page.evaluate("window.__field.reveal")
    page.evaluate(SCROLL_TO, 0.6)
    page.wait_for_timeout(1500)
    mid = page.evaluate("window.__field.reveal")
    report(page.evaluate("window.__field.drawing") == "f450" and top < 0.05 and mid > 0.5,
           f"/work/drone/: the F450 is drafted as the page scrolls (reveal {top:.2f} -> {mid:.2f})")
    page.close()
    # A page with no drawing of its own: the badge, and never a black square (content hidden, sample the floor).
    page = open_page(browser, base, "/about/", "dark")
    page.add_style_tag(content="body > *:not(.site-bg) { visibility: hidden !important; }")
    page.evaluate(SCROLL_TO, 0.95)
    page.mouse.move(700, 400)
    page.wait_for_timeout(2000)
    from PIL import Image
    import io
    shot = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
    dark_px = sum(1 for x in range(0, 1440, 40) for y in range(450, 900, 40) if sum(shot.getpixel((x, y))) < 12)
    report(page.evaluate("window.__field.drawing") == "badge" and dark_px == 0,
           f"/about/: the badge drawing, no black square on the floor ({dark_px} black samples)")
    page.close()
    # A section marked data-field="day" turns the dark world to day while it is under the middle of the screen.
    page = open_page(browser, base, "/work/", "dark")
    page.evaluate("""() => { const s = document.createElement('section'); s.dataset.field = 'day'; s.style.height = '200vh';
      document.querySelector('main').prepend(s); document.dispatchEvent(new Event('astro:after-swap')); }""")
    page.mouse.move(700, 400)
    page.mouse.wheel(0, 200)
    page.wait_for_timeout(1500)
    night = page.evaluate("window.__field.night")
    report(night < 0.15, f"a data-field=day section turns the field to day (night {night:.2f})")
    page.close()
    # Reduced motion: the still picture (with the drawing complete, made by --make-stills), no canvas.
    page = browser.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    page.add_init_script(INIT % {"theme": "dark", "extra": ""})
    page.goto(base + "/about/", wait_until="load")
    page.wait_for_timeout(1500)
    still = page.evaluate("""() => { const c = document.querySelector('[data-blueprint]'); const img = document.querySelector('.site-bg__still--dark');
      return { canvas: c ? !c.hidden && getComputedStyle(c).display !== 'none' : false, still: !!img && getComputedStyle(img).opacity === '1' && img.complete && img.naturalWidth > 0 }; }""")
    report(not still["canvas"] and still["still"], f"reduced motion: the still picture instead of the field ({still})")
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


BOX = """(sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left, r.right]; }"""
LINK = """(label) => { const a = [...document.querySelectorAll('[data-nav] a')].find((x) => x.textContent.trim() === label);
  const r = a.getBoundingClientRect(); return [r.left, r.right, r.top + r.height / 2]; }"""


def check_header(browser, base):
    page = open_page(browser, base, "/work/drone/", "dark")
    pill = page.evaluate(BOX, "[data-pill]")
    work = page.evaluate(LINK, "Work")
    report(abs(pill[0] - work[0]) <= 2 and abs(pill[1] - work[1]) <= 2, f"/work/drone/: the pill rests under Work ({pill} vs {work[:2]})")
    about = page.evaluate(LINK, "About")
    page.mouse.move(about[0] - 400, about[2] + 300)  # start away from the nav
    page.wait_for_timeout(100)
    # sample the pill's widest point while it travels (the drop), then where it lands
    page.evaluate("""() => { window.__pillMax = 0; const p = document.querySelector('[data-pill]');
      const tick = () => { window.__pillMax = Math.max(window.__pillMax, p.getBoundingClientRect().width); if (performance.now() - t0 < 700) requestAnimationFrame(tick); };
      const t0 = performance.now(); requestAnimationFrame(tick); }""")
    page.mouse.move((about[0] + about[1]) / 2, about[2], steps=4)
    page.wait_for_timeout(700)
    mid = [0, page.evaluate("window.__pillMax")]
    there = page.evaluate(BOX, "[data-pill]")
    report(mid[1] - mid[0] > (work[1] - work[0]) + 20 and abs(there[1] - about[1]) <= 2,
           f"pointing at About: the pill stretches ({mid}) and reaches it ({there} vs {about[:2]})")
    page.mouse.move(700, 600)
    page.wait_for_timeout(600)
    back = page.evaluate(BOX, "[data-pill]")
    report(abs(back[0] - work[0]) <= 2, f"pointer gone: the pill settles back under Work ({back})")
    # keyboard: Tab until a nav link has focus; the pill follows it
    followed = False
    for _ in range(12):
        page.keyboard.press("Tab")
        focused = page.evaluate("document.activeElement && document.activeElement.closest('[data-nav]') ? document.activeElement.textContent.trim() : null")
        if focused:
            page.wait_for_timeout(500)
            link = page.evaluate(LINK, focused)
            box = page.evaluate(BOX, "[data-pill]")
            followed = abs(box[0] - link[0]) <= 2
            break
    report(followed, f"keyboard: Tab reaches the nav and the pill follows focus ({focused})")
    page.close()
    # phones: the menu opens and closes as before
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.add_init_script(INIT % {"theme": "dark", "extra": ""})
    page.goto(base + "/work/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(500)
    OPEN = "document.querySelector('[data-site-header]').hasAttribute('data-menu-open')"

    def becomes(state):
        try:
            page.wait_for_function(OPEN if state else f"!({OPEN})", timeout=2000)
            page.wait_for_timeout(350)  # let the panel's own transition finish before the next step
            return True
        except Exception:
            return False

    page.click("[data-menu-button]"); a = becomes(True)
    page.keyboard.press("Escape"); b = becomes(False)
    page.click("[data-menu-button]"); becomes(True)
    # an outside tap on empty ground (not a link), as a thumb would
    page.evaluate("document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))"); c = becomes(False)
    page.click("[data-menu-button]"); becomes(True)
    try:
        # tap the link where it is, as a thumb does: Playwright's click() would scroll it into view first, and the menu
        # closes itself on scroll by design, so the tap would land on a closed menu
        x, y = page.evaluate("(() => { const r = document.querySelectorAll('#mobile-menu a')[1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        page.mouse.click(x, y)
        d = becomes(False)
    except Exception as error:
        print("   menu state:", page.evaluate(OPEN), str(error).splitlines()[0])
        d = False
    report(a and b and c and d, f"390 px: the phone menu opens, and closes on Escape, an outside tap and a link tap ({a} {b} {c} {d})")
    page.close()


def check_forced_dark(browser, base):
    """Sections that force the dark look inside the light theme (the drone chapter) keep light text on their ground."""
    page = open_page(browser, base, "/work/drone/", "light")
    r = page.evaluate("""() => { const el = document.querySelector('.dark h1, .dark h2');
      if (!el) return null; let bg = el, c;
      while (bg && ((c = getComputedStyle(bg).backgroundColor) === 'rgba(0, 0, 0, 0)' || c === 'transparent')) bg = bg.parentElement;
      return { text: getComputedStyle(el).color, back: bg ? getComputedStyle(bg).backgroundColor : 'rgb(255, 255, 255)', words: el.textContent.trim().slice(0, 40) }; }""")
    if r is None:
        report(False, "/work/drone/ light: no forced-dark heading found")
    else:
        ratio = contrast(page.evaluate(RESOLVE, r["text"]), page.evaluate(RESOLVE, r["back"]))
        report(ratio >= 4.5, f"/work/drone/ light: forced-dark heading {r['words']!r} contrast {ratio:.2f} (>= 4.5)")
    page.close()


FOCUS_JS = """() => {
  const transparent = (c) => c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
  const a = document.activeElement;
  const cs = getComputedStyle(a);
  let d = a, bg = 'rgb(255, 255, 255)';
  while (d) { const c = getComputedStyle(d).backgroundColor; if (!transparent(c)) { bg = c; break; } d = d.parentElement; }
  return { outline: cs.outlineColor, style: cs.outlineStyle, back: bg };
}"""


def check_review_fixes(browser, base):
    """The phase 1 review's findings, each pinned (docs/superpowers/plans/2026-11-15-redesign-phase1-foundation.md)."""
    # 1. leaving the 3D home for a classic page, the field keeps drawing (it must not mistake the wake for a slow device)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("try { localStorage.setItem('experience', '3d'); localStorage.setItem('hook-seen', '1'); localStorage.setItem('theme', 'dark'); } catch (e) {}")
    page.goto(base + "/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(1500)
    page.click("[data-nav] a[href='/work/']")
    page.wait_for_function("location.pathname === '/work/'", timeout=10000)
    page.wait_for_timeout(800)
    for _ in range(40):
        page.mouse.wheel(0, 120)
        page.wait_for_timeout(150)
    f = page.evaluate("window.__field")
    report(not f["fallback"] and not f["paused"], f"3D home -> /work/: after 6 s of scrolling the field still draws ({f})")
    page.close()
    # 5. a fallback (no WebGL2) keeps its still picture across a page change
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' && this.matches('[data-blueprint]') ? null : g.call(this, t, ...a); };")
    page.add_init_script(INIT % {"theme": "dark", "extra": ""})
    page.goto(base + "/work/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.click("[data-nav] a[href='/about/']")
    page.wait_for_function("location.pathname === '/about/'", timeout=10000)
    page.wait_for_timeout(900)
    op = page.evaluate("getComputedStyle(document.querySelector('.site-bg__still--dark')).opacity")
    report(op == "1", f"no WebGL2: the still picture survives a page change (opacity {op})")
    page.close()
    # 9. the field publishes its night/day for later phases; 3. the rim light follows the pointer (the header is a sheet)
    page = open_page(browser, base, "/work/", "dark", "localStorage.setItem('surface', 'glass');")
    page.mouse.move(300, 300)
    page.wait_for_timeout(500)
    night = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--field-night').trim()")
    try:
        ok = 0.9 <= float(night) <= 1
    except ValueError:
        ok = False
    report(ok, f"--field-night is published ({night!r})")
    page.mouse.move(700, 30)
    page.wait_for_timeout(700)
    rim = page.evaluate("getComputedStyle(document.querySelector('[data-site-header]'), '::before').getPropertyValue('--rim-strength').trim()")
    report(float(rim or 0) > 0, f"the header's rim catches the pointer (::before --rim-strength {rim!r})")
    page.close()
    # 7. Solid: the scrolled header stays filled
    page = open_page(browser, base, "/work/", "dark", "localStorage.setItem('surface', 'solid');")
    page.mouse.wheel(0, 600)
    page.wait_for_timeout(600)
    bg = page.evaluate("getComputedStyle(document.querySelector('[data-site-header]')).backgroundColor")
    report(alpha(bg) == 1, f"solid: the scrolled header is filled ({bg})")
    page.close()
    # 6. the lens only on Chromium (Firefox and Safari accept the syntax but don't draw it)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });")
    page.add_init_script(INIT % {"theme": "dark", "extra": "localStorage.setItem('surface', 'glass');"})
    page.goto(base + "/work/", wait_until="load")
    report(not page.evaluate("document.documentElement.classList.contains('lens')"), "a browser without Chromium's userAgentData: no lens")
    page.close()
    # 4 and 14. the drone intro: its letter layer keeps its box, and no teal is left
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(INIT % {"theme": "dark", "extra": ""})
    page.goto(base + "/work/drone/", wait_until="domcontentloaded")
    pos = page.evaluate("(() => { const e = document.querySelector('.ds-letters'); return e ? getComputedStyle(e).position : 'missing'; })()")
    report(pos == "absolute", f"drone intro: the letter layer is placed absolutely ({pos})")
    shadow = page.evaluate("(() => { const e = document.querySelector('.ds-ripple'); return e ? getComputedStyle(e).boxShadow : ''; })()")
    teal = any(int(g) > int(r) + 40 and int(b) > int(r) + 40 for r, g, b in re.findall(r"rgba?\((\d+), (\d+), (\d+)", shadow))
    report(not teal, f"drone intro: no teal glow on the ripple ({shadow[:60]})")
    page.close()
    # 10. light theme: the first-visit cards' focus ring is visible (3:1 on what is behind it)
    page = open_page(browser, base, "/work/", "light")
    page.evaluate("document.getElementById('experience-dialog').showModal()")
    page.keyboard.press("Shift+Tab")  # the second card has autofocus; back to the first, from the keyboard
    page.wait_for_timeout(200)
    ring = page.evaluate(FOCUS_JS)
    ratio = contrast(page.evaluate(RESOLVE, ring["outline"]), page.evaluate(RESOLVE, ring["back"]))
    report(ring["style"] != "none" and ratio >= 3, f"light: the experience cards' focus ring {ratio:.2f} (>= 3, style {ring['style']})")
    page.close()


def make_stills(browser, base):
    """The blueprint space's still pictures (shown where the field can't run): the field alone, page content hidden."""
    from PIL import Image
    for theme in ("dark", "light"):
        page = open_page(browser, base, "/about/", theme)
        page.add_style_tag(content="body > *:not(.site-bg) { visibility: hidden !important; } html { scrollbar-width: none; }")
        # The end of the page: the flight's last view, the badge drawing complete.
        page.evaluate(SCROLL_TO, 0.97)
        page.mouse.move(720, 450)
        page.wait_for_timeout(2500)
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
                check_header(browser, base)
                check_forced_dark(browser, base)
                check_review_fixes(browser, base)
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{failures} failure(s)")
    sys.exit(failures)


if __name__ == "__main__":
    main()
