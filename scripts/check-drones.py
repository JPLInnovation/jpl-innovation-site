"""
The drone pages' own checks (/work/drone/ and /work/mini-drone/), in real Chrome.

    npm run build
    python scripts/check-drones.py [--port 4403]

  - both themes at 1440, 768 and 390 px: one h1, no sideways scroll, every heading and part of the text files on the page
  - the parts lists add up: each table's rows to its subtotal, the receipt's lines to their tables and to the total
  - the title block's text keeps 4.5:1 on the plate, the tables' text on the page
  - the headline decodes back into its own words; with reduced motion the renders are lit from the start
  - the 3D chapter still starts (3D chosen, 1440 px)

Each check prints PASS or FAIL; the exit code is the number of failures.
"""

import argparse
import importlib.util
import os
import re
import subprocess

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)


def text_of(path):
    return open(os.path.join(ROOT, path), encoding="utf-8").read()


def strings(src, key):
    """The quoted values of `key: '…'` (or "…") in a text file."""
    return [a or b for a, b in re.findall(key + r":\s*(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")", src)]


def expected(page):
    """Today's headings and parts, from the page's text file (the words the page must still show)."""
    if page == "drone":
        src = text_of("src/text/projects/drone.ts")
        show = text_of("src/text/showcase/drone.ts")
        groups = src[src.index("export const partGroups") :]
        heads = ["F450 4G Drone", *strings(src, "progressHeading"), *strings(src, "systemsHeading"), *strings(src, "heading")[:0]]
        heads += strings(groups, "title") + strings(show, "heading") + strings(show, "title")
        heads += strings(src[src.index("export const earlierWork") :], "title")
        heads += [t for t in strings(src[src.index("export const roadmap") :], "title")][:6]
        heads += ["Power", "Flight control", "Live video"]
        return heads, strings(groups, "name")
    src = text_of("src/text/projects/mini-drone.ts")
    groups = src[src.index("export const partGroups") :]
    heads = ["Mini Arduino Drone", *strings(src, "progressHeading"), *strings(src, "systemsHeading")]
    heads += strings(groups, "title") + strings(src[src.index("export const roadmap") :], "title")[:5] + ["Radio & control", "Power"]
    return heads, strings(groups, "name")


def norm(s):
    return re.sub(r"\s+", " ", s.replace("\\'", "'")).strip()


def open_page(browser, base, path, theme, width, extra="", reduced=False):
    page = browser.new_page(viewport={"width": width, "height": 900 if width > 500 else 844}, reduced_motion="reduce" if reduced else "no-preference")
    page.add_init_script(cl.INIT % {"theme": theme, "extra": extra})
    page.goto(base + path, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(500)
    return page


VND = r"(\d{1,3}(?:\.\d{3})*)\s*₫"
SUMS = """() => {
  const n = (s) => { const m = (s || '').match(/(\\d{1,3}(?:\\.\\d{3})*)\\s*₫/); return m ? Number(m[1].replace(/\\./g, '')) : null; };
  const tables = [...document.querySelectorAll('.bom-group')].map((g) => ({
    title: g.querySelector('h3').textContent.trim(),
    rows: [...g.querySelectorAll('tbody tr')].map((r) => n(r.querySelector('.c-price')?.textContent)),
    subtotal: n(g.querySelector('tfoot .c-price')?.textContent),
  }));
  const lines = [...document.querySelectorAll('.receipt-lines li')].map((li) => ({
    title: li.querySelector('.receipt-name').textContent.trim(), sum: li.querySelector('.receipt-sum').textContent.trim(),
  }));
  const totalEl = document.querySelector('.receipt-total-n');
  const countEl = totalEl.querySelector('[data-count]') || totalEl;
  return { tables, lines, total: Number(countEl.dataset.count || 'NaN'), heading: document.querySelector('#parts-heading').textContent.trim() };
}"""


def check_sums(page, name):
    s = page.evaluate(SUMS)
    rows = sum(len(t["rows"]) for t in s["tables"])
    cl.report(s["heading"].startswith(f"{rows} "), f"{name}: the heading counts the rows ({s['heading']!r}, {rows} rows)")
    priced = any(t["subtotal"] is not None for t in s["tables"])
    if priced:
        grand = 0
        for t, line in zip(s["tables"], s["lines"]):
            add = sum(r or 0 for r in t["rows"])
            grand += add
            cl.report(t["subtotal"] == add, f"{name}: {t['title']} rows add up to its subtotal ({add} = {t['subtotal']})")
            got = int(re.search(VND, line["sum"]).group(1).replace(".", ""))
            cl.report(line["title"] == t["title"] and got == add, f"{name}: the receipt's {line['title']} line is its table's subtotal ({got})")
        cl.report(s["total"] == grand, f"{name}: the receipt's total is the sum of every priced row ({s['total']} = {grand})")
    else:
        for t, line in zip(s["tables"], s["lines"]):
            cl.report(line["sum"].startswith(f"{len(t['rows'])} "), f"{name}: the receipt's {line['title']} line counts its table ({line['sum']})")
        cl.report(s["total"] == rows, f"{name}: the receipt's total counts every part ({s['total']} = {rows})")


CONTRAST = """(sel) => [...document.querySelectorAll(sel)].slice(0, 6).map((el) => {
  let bg = null, e = el;
  while (e && !bg) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\\(.*,\\s*0\\)$|transparent/.test(c)) bg = c; e = e.parentElement; }
  return { fg: getComputedStyle(el).color, bg: bg || getComputedStyle(document.body).backgroundColor };
})"""


def check_contrast(page, name, sel, what, floor=4.5):
    worst = 99
    for pair in page.evaluate(CONTRAST, sel):
        fg = page.evaluate(cl.RESOLVE, pair["fg"])
        bg = page.evaluate(cl.RESOLVE, pair["bg"])
        worst = min(worst, cl.contrast(fg, bg))
    cl.report(worst >= floor, f"{name}: {what} contrast {worst:.2f} (>= {floor})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4403)
    args = ap.parse_args()
    os.chdir(ROOT)
    proc = cl.serve(args.port)
    base = f"http://localhost:{args.port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            for slug in ("drone", "mini-drone"):
                path = f"/work/{slug}/"
                heads, parts = expected("drone" if slug == "drone" else "mini")
                for theme in ("dark", "light"):
                    for width in (1440, 768, 390):
                        name = f"{slug} {theme} {width}"
                        page = open_page(browser, base, path, theme, width)
                        h1 = page.locator("h1").count()
                        cl.report(h1 == 1, f"{name}: one h1 ({h1})")
                        sw, iw = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
                        cl.report(sw <= iw, f"{name}: no sideways scroll ({sw} <= {iw})")
                        if width == 1440:
                            body = norm(page.evaluate("document.body.textContent"))
                            missing = [h for h in heads + parts if norm(h) not in body]
                            cl.report(not missing, f"{name}: every heading and part is on the page ({len(heads)} headings, {len(parts)} parts) {missing[:4]}")
                            hs = norm(" | ".join(page.evaluate("[...document.querySelectorAll('h2, h3')].map((h) => h.textContent)")))
                            cl.report(all(norm(h) in hs for h in heads if h not in ("F450 4G Drone", "Mini Arduino Drone")), f"{name}: the headings are headings")
                            check_sums(page, name)
                            check_contrast(page, name, ".plate .title-block dd", "title block values")
                            check_contrast(page, name, ".plate .title-block dt", "title block labels")
                            check_contrast(page, name, ".bom-table tbody th, .bom-table td.c-why", "parts list text")
                            check_contrast(page, name, ".revs-desc", "roadmap text")
                            # the headline decodes, then is its own words again
                            page.evaluate("document.querySelector('[data-decode]').scrollIntoView({ block: 'center' })")
                            page.wait_for_timeout(1600)
                            words = page.evaluate("[document.querySelector('[data-decode]').textContent, document.querySelector('[data-decode]').hasAttribute('data-decoding')]")
                            cl.report(words[0] == ("F450 4G Drone" if slug == "drone" else "Mini Arduino Drone") and not words[1], f"{name}: the headline decodes into its words ({words[0]!r})")
                        page.close()
                # reduced motion: the pictures are lit and the plate is open from the start
                page = open_page(browser, base, path, "dark", 1440, reduced=True)
                page.evaluate("document.querySelector('.plate').scrollIntoView()")
                page.wait_for_timeout(300)
                lit = page.evaluate("getComputedStyle(document.querySelector('.plate .lit-on, .plate svg')).opacity")
                scale = page.evaluate("getComputedStyle(document.querySelector('.plate')).scale")
                cl.report(lit == "1" and scale in ("none", "1"), f"{slug} reduced motion: the plate is lit and open (opacity {lit}, scale {scale})")
                page.close()
            # the 3D chapter still starts
            page = open_page(browser, base, "/work/drone/", "dark", 1440, extra="localStorage.setItem('experience', '3d');")
            try:
                page.wait_for_function("document.querySelector('.dch')?.hasAttribute('data-live')", timeout=40000)
                live = True
            except Exception:
                live = False
            read = page.evaluate("document.querySelector('.dch').hasAttribute('data-read')")
            cl.report(live and not read, f"3D chapter: started (data-live {live}, plain page {read})")
            if live:
                page.evaluate("scrollTo(0, innerHeight * 2.05)")
                page.wait_for_timeout(1800)
                on = page.evaluate("getComputedStyle(document.querySelector('#reveal')).opacity")
                cl.report(float(on) > 0.9, f"3D chapter: the reveal's words show at its stop (opacity {on})")
                os.makedirs("screenshots/drones", exist_ok=True)
                page.screenshot(path="screenshots/drones/3d-reveal.png")
            page.close()
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    raise SystemExit(cl.failures)


if __name__ == "__main__":
    main()
