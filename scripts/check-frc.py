"""
The FRC page's special edition, checked in real Chrome (starts and stops its own preview of the build).

    npm run build
    python scripts/check-frc.py [--port 4405] [--shots]

  - nothing of today's page is lost: every heading, link and team photo of the page before the rebuild (commit a4cfe08,
    scripts/check-frc-base.json) is still in the built page
  - the intro (sessionStorage frc-intro-seen cleared) shows its five start lights and is skipped by a key
  - in both themes the edition is near-black with Anton display type, and nothing scrolls sideways at 1440, 768 or 390
  - the devices work: the history pins and changes scene, the starting grid lights our slot (19 of 44, then 16 of 40),
    the calendar lights the row the KitBot passes, the gallery slides
  --shots also saves screenshots to screenshots/frc/ (git-ignored).
"""
import argparse, importlib.util, json, os, re, subprocess, sys
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)


class Inventory(HTMLParser):
    """Headings, links and team photos inside <main> of a built page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.main, self.skip, self.h, self.buf = 0, 0, None, []
        self.headings, self.links, self.photos = set(), set(), set()

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag in ("script", "style", "template"):
            self.skip += 1
        if tag == "main":
            self.main += 1
        if not self.main:
            return
        if re.fullmatch(r"h[1-6]", tag):
            self.h, self.buf = tag, []
        if tag == "a" and a.get("href"):
            self.links.add(a["href"])
        for k in ("src", "data-zoom"):
            v = a.get(k) if (tag == "img" or k == "data-zoom") else None
            if v and "/assets/frc/" in v:
                self.photos.add(re.sub(r"-640(?=\.webp)", "", v))

    def handle_endtag(self, tag):
        if tag in ("script", "style", "template"):
            self.skip -= 1
        if tag == "main":
            self.main -= 1
        if self.h == tag:
            t = re.sub(r"\s+", " ", "".join(self.buf)).strip()
            if t:
                self.headings.add(t)
            self.h = None

    def handle_data(self, d):
        if self.h and not self.skip:
            self.buf.append(d)


def check_inventory():
    base = json.load(open(os.path.join(ROOT, "scripts", "check-frc-base.json"), encoding="utf-8"))
    inv = Inventory()
    inv.feed(open(os.path.join(ROOT, "dist", "work", "frc", "index.html"), encoding="utf-8").read())
    for kind, now in (("headings", inv.headings), ("links", inv.links), ("photos", inv.photos)):
        lost = [x for x in base[kind] if x not in now]
        cl.report(not lost, f"every {kind[:-1]} of today's page is still there" + (f" (lost: {lost})" if lost else f" ({len(base[kind])})"))


def open_frc(browser, base, theme, width, height=900, seen=True, extra=""):
    page = browser.new_page(viewport={"width": width, "height": height})
    script = cl.INIT % {"theme": theme, "extra": extra}
    if not seen:
        script = script.replace("['jpl', 'frc', 'drone']", "['jpl', 'drone']")
    page.add_init_script(script)
    page.goto(base + "/work/frc/", wait_until="load")
    return page


def check_splash(browser, base):
    page = open_frc(browser, base, "dark", 1440, seen=False)
    shown = page.evaluate("document.documentElement.classList.contains('splash') && !!document.querySelector('[data-splash=frc]')")
    cl.report(shown, "the FRC intro plays when frc-intro-seen is cleared")
    page.wait_for_timeout(900)
    lamps = page.evaluate("[...document.querySelectorAll('[data-frc-lights] i')].map(i => +getComputedStyle(i).opacity)")
    cl.report(len(lamps) == 5 and sum(o > 0.5 for o in lamps) >= 2, f"the start lights come on one by one (opacities at 0.9 s: {[round(o, 2) for o in lamps]})")
    page.keyboard.press("Shift")
    try:
        page.wait_for_function("!document.documentElement.classList.contains('splash') && !document.querySelector('[data-splash=frc]')", timeout=1500)
        cl.report(True, "a key skips the intro")
    except Exception:
        cl.report(False, "a key skips the intro")
    page.close()


def settle(page):
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(500)


def scroll_to(page, selector, frac=0.0):
    """Scroll so `selector`'s top (plus frac of its height) is at the top of the window."""
    page.evaluate(f"(() => {{ const e = document.querySelector('{selector}'); const r = e.getBoundingClientRect(); scrollTo(0, scrollY + r.top + r.height * {frac}); }})()")
    page.wait_for_timeout(900)


def check_look(browser, base, shots):
    for theme in ("dark", "light"):
        for width, height in ((1440, 900), (768, 1024), (390, 844)):
            page = open_frc(browser, base, theme, width, height)
            settle(page)
            tag = f"{theme} {width}px"
            ed = page.evaluate("getComputedStyle(document.querySelector('.frc-ed')).backgroundColor")
            cl.report(ed == "rgb(7, 11, 18)", f"{tag}: the edition is near-black ({ed})")
            anton = page.evaluate("document.fonts.ready.then(() => getComputedStyle(document.querySelector('#frc-title')).fontFamily.startsWith('Anton') && document.fonts.check('1em Anton'))")
            cl.report(anton, f"{tag}: the title is set in Anton, loaded")
            sw = page.evaluate("document.documentElement.scrollWidth - innerWidth")
            cl.report(sw <= 0, f"{tag}: nothing scrolls sideways ({sw}px)")
            if shots:
                d = os.path.join(ROOT, "screenshots", "frc")
                os.makedirs(d, exist_ok=True)
                page.wait_for_timeout(1200)
                stops = [("top", None, 0), ("statement", ".fs", 0.3), ("case", ".frc-case", 0.1), ("history", "[data-frc-history]", 0.35),
                         ("results", "#results", 0.0), ("grid", ".frc-grid", -0.3), ("reveal", ".treveal-track", 0.55), ("agenda", ".fag-rows", 0.25),
                         ("kitbot", "#kitbot", 0.02), ("swerve", "#swerve-heading", -0.1), ("gallery", "[data-frc-gallery]", 0.05), ("board", "#board", 0.0),
                         ("outreach", "#outreach", 0.0), ("partner", "#partner", 0.0)]
                for name, sel, frac in stops:
                    if sel:
                        scroll_to(page, sel, frac)
                    page.screenshot(path=os.path.join(d, f"{width}-{theme}-{name}.png"))
            page.close()


def check_devices(browser, base):
    page = open_frc(browser, base, "dark", 1440)
    settle(page)
    live = page.evaluate("document.querySelector('[data-frc-history]').classList.contains('is-live')")
    cl.report(live, "the season chapters are pinned")
    scroll_to(page, "[data-frc-history]", 0.62)
    state = page.evaluate("(() => { const s = document.querySelector('[data-frc-history]'); const on = [...s.querySelectorAll('.fhis-scene')].findIndex(x => x.classList.contains('is-on')); return [on, s.dataset.route, s.querySelector('.fhis-pin').getBoundingClientRect().top]; })()")
    cl.report(state[0] >= 3 and state[1] in ("1", "2") and abs(state[2]) < 2, f"scrolling through them changes the scene and the route while the screen stays (scene {state[0] + 1}, route {state[1]})")
    scroll_to(page, ".frc-grid", -0.4)
    page.wait_for_timeout(1500)
    grid = page.evaluate("[document.querySelectorAll('.frc-grid-slots li').length, document.querySelector('.frc-grid-slots [data-kind=us] i')?.textContent, document.querySelector('.frc-grid-q b')?.textContent]")
    cl.report(grid[0] == 44 and grid[1] == "19" and "First-round pick" in (grid[2] or ""), f"Vancouver's starting grid: 44 slots, ours P19, first-round pick lit ({grid})")
    page.click("#ev-tab-ist")
    page.wait_for_timeout(1200)
    grid = page.evaluate("[document.querySelectorAll('.frc-grid-slots li').length, document.querySelector('.frc-grid-slots [data-kind=us] i')?.textContent]")
    cl.report(grid == [40, "16"], f"Istanbul's starting grid: 40 slots, ours P16 ({grid})")
    scroll_to(page, ".fag-rows", 0.45)
    lit = page.evaluate("[document.querySelectorAll('.fag-row.is-lit').length, getComputedStyle(document.querySelector('.fag-car')).opacity]")
    cl.report(lit[0] >= 1 and float(lit[1]) > 0.9, f"the KitBot is on the calendar and lights the row it passes ({lit})")
    scroll_to(page, "[data-frc-gallery]", 0.1)
    page.click("[data-gal-next]")
    page.wait_for_timeout(900)
    n = page.evaluate("document.querySelector('[data-gal-n]').textContent")
    cl.report(n == "2", f"the gallery's arrow moves it on ({n})")
    page.close()


def check_kitbot_3d(browser, base, shots):
    """The 3D KitBot chapter (FrcChapter, the showcase's own worker) still starts inside the edition."""
    page = open_frc(browser, base, "dark", 1440, extra="localStorage.setItem('experience', '3d');")
    settle(page)
    scroll_to(page, "#kitbot", 0.05)
    try:
        page.wait_for_function("document.querySelector('#kitbot').hasAttribute('data-live')", timeout=30000)
        cl.report(True, "the 3D KitBot chapter starts in 3D mode")
    except Exception:
        cl.report(False, "the 3D KitBot chapter starts in 3D mode")
    if shots:
        scroll_to(page, "#kitbot", 0.3)
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(ROOT, "screenshots", "frc", "1440-dark-kitbot-3d.png"))
    page.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4405)
    ap.add_argument("--shots", action="store_true")
    args = ap.parse_args()
    check_inventory()
    proc = cl.serve(args.port)
    base = f"http://localhost:{args.port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            check_splash(browser, base)
            check_devices(browser, base)
            check_kitbot_3d(browser, base, args.shots)
            check_look(browser, base, args.shots)
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    sys.exit(cl.failures)


if __name__ == "__main__":
    main()
