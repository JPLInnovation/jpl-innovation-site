"""
The classic home's page checks (the title sheet: docs/superpowers/specs/2026-11-15-classic-redesign-design.md §7), in
real Chrome, on top of scripts/check-look.py's helpers.

    npm run build
    python scripts/check-home.py --port 4401             the checks
    python scripts/check-home.py --port 4401 --shots     and screenshots at 1440, 768 and 390, both themes (screenshots/home/)

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

SHOTS = os.path.join(ROOT, "screenshots", "home")


def open_home(browser, base, theme="dark", width=1440, height=900, extra="", reduced=False):
    page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce" if reduced else "no-preference")
    page.add_init_script(cl.INIT % {"theme": theme, "extra": extra})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(base + "/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(700)
    page.errors = errors
    return page


def home_headings():
    """Every heading the home's text file gives (src/text/home.ts), read by node so the check follows the file."""
    js = (
        "import('./src/text/home.ts').then((h) => console.log(JSON.stringify(["
        "h.hero.heading, h.hook.heading, h.servicesSection.heading, h.workSection.heading, h.mission.label,"
        "h.mission.standardsHeading, h.mission.processHeading, h.journey.heading, h.teamSection.heading,"
        "...h.services.map((s) => s.title), ...h.mission.process.map((s) => s.title), ...h.journey.milestones.map((m) => m.title),"
        "...h.verbs.map((v) => v.verb)])))"
    )
    out = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    import json

    return json.loads(out)


def check_headings(browser, base):
    page = open_home(browser, base)
    on_page = page.evaluate("[...document.querySelectorAll('.classic-home h1, .classic-home h2, .classic-home h3, .classic-home h4')].map((h) => h.textContent.replace(/\\s+/g, ' ').trim())")
    missing = [h for h in home_headings() if not any(h in x for x in on_page)]
    report_ok = not missing
    cl.report(report_ok, f"every heading from home.ts is a heading on the page (missing: {missing})")
    h1 = page.evaluate("[...document.querySelectorAll('h1')].filter((h) => h.offsetParent || h.getClientRects().length).map((h) => h.textContent.trim())")
    cl.report(len(h1) == 1 and h1[0].startswith("JPL Innovation"), f"one h1, the page heading ({h1})")
    order = page.evaluate("""() => [...document.querySelectorAll('.classic-home [data-project]')].map((e) => e.dataset.project)""")
    cl.report(order == ["drone", "lifetime", "frc", "mini-drone", "cybersecurity"], f"projects in the site's order, Lifetime after the F450 ({order})")
    logo = page.evaluate("(() => { const i = document.querySelector('.classic-home [data-project=lifetime] img'); return i ? i.getAttribute('src') : null; })()")
    cl.report(logo == "/assets/lifetime.svg", f"Lifetime's picture is its logo ({logo})")
    cl.report(not page.errors, f"no console errors on the classic home ({page.errors[:3]})")
    page.close()


def check_scrubber(browser, base):
    page = open_home(browser, base)
    s = page.locator("[role=slider][data-scrub]")
    s.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    s.focus()
    first = s.get_attribute("aria-valuetext")
    for _ in range(10):
        page.keyboard.press("ArrowRight")
    mid = s.get_attribute("aria-valuetext")
    page.keyboard.press("End")
    last = s.get_attribute("aria-valuetext")
    now = s.get_attribute("aria-valuenow")
    cl.report(first != mid != last and now == "100", f"arrow keys move the scrubber and it announces each stage ({first!r} -> {mid!r} -> {last!r}, {now})")
    caption = page.evaluate("document.querySelector('[data-scrub-caption]').textContent.trim()")
    cl.report("render" in caption.lower() and "photograph" not in caption.lower().replace("first photograph", ""),
              f"the built stage says it is a render, not a photograph ({caption!r})")
    page.keyboard.press("Home")
    # a drag across the picture scrubs it too
    box = s.bounding_box()
    page.mouse.move(box["x"] + 10, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] * 0.55, box["y"] + box["height"] / 2, steps=8)
    page.mouse.up()
    dragged = int(s.get_attribute("aria-valuenow"))
    cl.report(40 <= dragged <= 70, f"a drag scrubs the picture ({dragged})")
    vis = page.evaluate("[...document.querySelectorAll('[data-scrub-layer]')].map((l) => +getComputedStyle(l).opacity)")
    cl.report(vis[1] > 0.5, f"halfway, the CAD render shows ({vis})")
    page.close()
    # a phone: a touch drag scrubs, and the page has no sideways scroll
    page = open_home(browser, base, width=390, height=844)
    over = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    cl.report(over <= 0, f"390 px: no horizontal scroll ({over} px over)")
    page.close()


def check_reduced(browser, base):
    page = open_home(browser, base, reduced=True)
    h = page.evaluate("getComputedStyle(document.querySelector('.classic-home h1 .living, .classic-home h1')).opacity")
    cl.report(h == "1", f"reduced motion: the title is there at once (opacity {h})")
    s = page.locator("[role=slider][data-scrub]")
    s.focus()
    page.keyboard.press("End")
    cl.report(s.get_attribute("aria-valuenow") == "100", "reduced motion: the scrubber still works from the keyboard")
    page.close()


def check_3d(browser, base):
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.add_init_script("try { localStorage.setItem('experience', '3d'); localStorage.setItem('hook-seen', '1'); localStorage.setItem('theme', 'dark'); ['jpl','frc','drone'].forEach((k) => sessionStorage.setItem(k + '-intro-seen', '1')); } catch (e) {}")
    page.goto(base + "/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    ok = True
    try:
        page.wait_for_function("document.querySelector('[data-studio]:not([data-read])')", timeout=20000)
    except Exception:
        ok = False
    page.wait_for_timeout(1500)
    hidden = page.evaluate("getComputedStyle(document.querySelector('.classic-home')).display")
    cl.report(ok and hidden == "none" and not errors, f"3D mode: the studio runs, the classic page is hidden ({hidden}), no console errors ({errors[:3]})")
    page.close()


def shots(browser, base):
    os.makedirs(SHOTS, exist_ok=True)
    for theme in ("dark", "light"):
        for w, h in ((1440, 900), (768, 1024), (390, 844)):
            page = open_home(browser, base, theme, w, h)
            total = page.evaluate("document.documentElement.scrollHeight")
            y, i = 0, 0
            while y < total and i < 40:
                page.evaluate(f"scrollTo(0, {y})")
                page.wait_for_timeout(900)
                page.screenshot(path=os.path.join(SHOTS, f"{theme}-{w}-{i:02d}.png"))
                y += int(h * 0.9)
                i += 1
            page.close()
    print("screenshots in", SHOTS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--port", type=int, default=4401)
    parser.add_argument("--shots", action="store_true")
    parser.add_argument("--only-shots", action="store_true")
    args = parser.parse_args()
    proc = None if args.url else cl.serve(args.port)
    base = (args.url or f"http://localhost:{args.port}").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            if not args.only_shots:
                check_headings(browser, base)
                check_scrubber(browser, base)
                check_reduced(browser, base)
                check_3d(browser, base)
            if args.shots or args.only_shots:
                shots(browser, base)
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    raise SystemExit(cl.failures)


if __name__ == "__main__":
    main()
