"""
The members pages' checks (the spec's section 10), in real Chrome, on the built site.

    npm run build
    python scripts/check-members.py --port 4406      its own preview on that port
    python scripts/check-members.py --url URL        or a server that is already running

The crew sheet: every person, signed off; tabbing to a person lights them up and dims the others; pointing does too.
Each person's sheet (the slugs come from the crew sheet's links): one h1, the greeting, the name at full width
without overflow, the map with their places and one stop per step of their path, a spanner per skill, the
achievements as a table, the story word by word; Khoa's real portrait. Both themes; 1440, 768 and 390 px; no
horizontal scroll; no skipped heading levels.
"""

import argparse
import importlib.util
import os
import subprocess

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)

SIZES = [(1440, 900), (768, 1024), (390, 844)]

HEADINGS = """() => { const levels = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => +h.tagName[1]);
  let ok = levels[0] === 1; for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) ok = false;
  return { ok, levels: levels.join(''), h1: document.querySelectorAll('h1').length }; }"""

LIT = """() => [...document.querySelectorAll('.person')].map((p) => ({
  colour: +getComputedStyle(p.querySelector('.portrait__colour')).opacity,
  veil: +getComputedStyle(p.querySelector('.portrait__veil')).opacity,
  run: +getComputedStyle(p.querySelector('.person__run')).opacity }))"""


def open_page(browser, base, path, theme, size=(1440, 900)):
    page = browser.new_page(viewport={"width": size[0], "height": size[1]})
    page.add_init_script(cl.INIT % {"theme": theme, "extra": ""})
    page.goto(base + path, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(500)
    return page


def overflow(page):
    return page.evaluate("document.documentElement.scrollWidth - innerWidth")


def check_crew(browser, base):
    slugs = []
    for theme in ("dark", "light"):
        page = open_page(browser, base, "/members/", theme)
        people = page.evaluate("""() => [...document.querySelectorAll('.person')].map((p) => ({
          href: p.querySelector('.person__name a').getAttribute('href'), label: p.querySelector('.person__label').textContent.trim(),
          sign: p.querySelector('.person__sign').textContent.trim(), img: p.querySelector('.portrait__colour').currentSrc }))""")
        cl.report(len(people) >= 2 and all(p["href"].startswith("/members/") for p in people), f"{theme} /members/: {len(people)} people on the crew sheet")
        labels = [p["label"] for p in people]
        cl.report(labels[:2] == ["Drawn by", "Checked by"], f"{theme} /members/: signed off {labels}")
        cl.report(all(p["sign"] for p in people), f"{theme} /members/: every person has a signature")
        h = page.evaluate(HEADINGS)
        cl.report(h["ok"] and h["h1"] == 1, f"{theme} /members/: one h1, no skipped heading levels ({h['levels']})")
        # keyboard: Tab into the first person
        lit = None
        for _ in range(30):
            page.keyboard.press("Tab")
            inside = page.evaluate("(() => { const p = document.activeElement.closest('.person'); return p ? [...document.querySelectorAll('.person')].indexOf(p) : -1; })()")
            if inside >= 0:
                page.wait_for_timeout(900)
                lit = (inside, page.evaluate(LIT))
                break
        ok = lit is not None and lit[1][lit[0]]["colour"] > 0.95 and lit[1][lit[0]]["run"] > 0.95 and all(
            s["veil"] > 0.5 for i, s in enumerate(lit[1]) if i != lit[0])
        cl.report(ok, f"{theme} /members/: tabbing to a person lights them up and dims the others ({lit})")
        if lit:
            ring = page.evaluate("getComputedStyle(document.activeElement.closest('.person__card')).outlineStyle")
            cl.report(ring != "none", f"{theme} /members/: the focused person shows a focus ring ({ring})")
        page.keyboard.press("Escape")
        page.evaluate("document.activeElement.blur()")
        # pointer: hover the second person
        page.mouse.move(5, 5)
        page.hover(".person:nth-child(2) .person__plate", force=True)
        page.wait_for_timeout(900)
        s = page.evaluate(LIT)
        cl.report(s[1]["colour"] > 0.95 and s[0]["veil"] > 0.5, f"{theme} /members/: pointing at a person lights them up ({s})")
        page.close()
        slugs = [p["href"] for p in people]
    for w, hgt in SIZES:
        page = open_page(browser, base, "/members/", "dark", (w, hgt))
        o = overflow(page)
        cl.report(o <= 0, f"/members/ at {w}: no horizontal scroll ({o})")
        page.close()
    return slugs


def check_person(browser, base, path):
    for theme in ("dark", "light"):
        page = open_page(browser, base, path, theme)
        h = page.evaluate(HEADINGS)
        cl.report(h["ok"] and h["h1"] == 1, f"{theme} {path}: one h1, no skipped heading levels ({h['levels']})")
        if theme == "dark":
            got = page.evaluate("""() => ({
              hello: (document.querySelector('.hero__hello') || {}).textContent || '',
              name: document.querySelector('h1').textContent.trim(),
              places: document.querySelectorAll('.map__places li').length,
              mapPlaces: document.querySelectorAll('.vnmap__place').length,
              path: document.querySelectorAll('.map__path li').length,
              stops: document.querySelectorAll('.vnmap__stop').length,
              route: !!document.querySelector('.vnmap__route'),
              tools: document.querySelectorAll('.tool').length,
              spanners: [...document.querySelectorAll('.tool__spanner')].map((s) => Math.round(s.getBoundingClientRect().height)),
              levels: [...document.querySelectorAll('.tool__level')].map((l) => l.textContent.trim()),
              rows: document.querySelectorAll('.parts tbody tr').length,
              words: document.querySelectorAll('.story__text [data-words]').length,
              wordSpans: document.querySelectorAll('.story__text .motion-word').length,
              img: (document.querySelector('.intro__portrait img') || {}).currentSrc || '',
              imgOk: (() => { const i = document.querySelector('.intro__portrait img'); return !!i && i.complete && i.naturalWidth > 0; })() })""")
            cl.report(got["hello"].startswith("Xin chào, mình là"), f"{path}: the greeting ({got['hello']!r})")
            cl.report(got["places"] == got["mapPlaces"] and got["places"] >= 1, f"{path}: every place is on the map ({got['mapPlaces']} of {got['places']})")
            cl.report(got["stops"] == got["path"] and got["route"] == (got["path"] > 0), f"{path}: one stop on the route per step of the path ({got['stops']} for {got['path']})")
            order = {"Advanced": 3, "Proficient": 2, "Developing": 1}
            sized = all(
                (order.get(a, 0) - order.get(b, 0)) * (x - y) >= 0
                for a, x in zip(got["levels"], got["spanners"]) for b, y in zip(got["levels"], got["spanners"]))
            cl.report(got["tools"] >= 1 and sized, f"{path}: a spanner per skill, sized by level ({list(zip(got['levels'], got['spanners']))})")
            cl.report(got["rows"] >= 1, f"{path}: achievements as a table ({got['rows']} rows)")
            page.evaluate("scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(600)
            spans = page.evaluate("document.querySelectorAll('.story__text .motion-word').length")
            cl.report(got["words"] >= 1 and spans > 20, f"{path}: the story lights up word by word ({got['words']} paragraphs, {spans} words)")
            cl.report(got["imgOk"] and "10951" not in got["img"], f"{path}: a real portrait ({got['img'].split('/')[-1]})")
            if "khoa" in path:
                cl.report("khoa" in got["img"], f"{path}: Khoa's own portrait, not the team logo")
        page.close()
    for w, hgt in SIZES:
        page = open_page(browser, base, path, "dark", (w, hgt))
        page.wait_for_timeout(400)
        fit = page.evaluate("""() => { const h = document.querySelector('[data-name-fit]'); const r = document.createRange(); r.selectNodeContents(h);
          const spans = [...h.querySelectorAll('span')].map((s) => s.getBoundingClientRect().width);
          return { box: h.clientWidth, text: r.getBoundingClientRect().width, word: Math.max(...spans), wide: getComputedStyle(h).whiteSpace === 'nowrap', size: parseFloat(getComputedStyle(h).fontSize) }; }""")
        used = fit["text"] if fit["wide"] else fit["word"]
        full = used >= 0.9 * fit["box"] or fit["size"] >= 239
        cl.report(used <= fit["box"] + 1 and full, f"{path} at {w}: the name fills the width without overflow ({used:.0f} of {fit['box']} px, {fit['size']:.0f} px type)")
        o = overflow(page)
        cl.report(o <= 0, f"{path} at {w}: no horizontal scroll ({o})")
        page.close()


def check_reduced(browser, base, path):
    page = browser.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    page.add_init_script(cl.INIT % {"theme": "dark", "extra": ""})
    page.goto(base + path, wait_until="load")
    page.wait_for_timeout(1200)
    hidden = page.evaluate("[...document.querySelectorAll('main *')].filter((e) => e.closest('.person__run, .portrait, [aria-hidden=true]') === null && e.children.length === 0 && e.textContent.trim() && +getComputedStyle(e).opacity < 0.5).length")
    cl.report(hidden == 0, f"reduced motion {path}: all text is there ({hidden} faded)")
    page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--port", type=int, default=4406)
    args = parser.parse_args()
    proc = None if args.url else cl.serve(args.port)
    base = (args.url or f"http://localhost:{args.port}").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            slugs = check_crew(browser, base)
            cl.report(len(slugs) >= 2, f"person pages found: {slugs}")
            for path in slugs:
                check_person(browser, base, path)
            check_reduced(browser, base, "/members/")
            check_reduced(browser, base, slugs[0] if slugs else "/members/jayden/")
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    raise SystemExit(cl.failures)


if __name__ == "__main__":
    main()
