"""
The Lifetime page's checks (/work/lifetime/), in real Chrome: the live demo's day at three scroll positions (the
morning, the server's outage, the end of the day), its switches, reduced motion, keyboard, phones, and the plates.

    npm run build
    python scripts/check-lifetime.py --port 4404             its own preview on that port
    python scripts/check-lifetime.py --port 4404 --shots     also saves screenshots to screenshots/lifetime/

Each check prints PASS or FAIL; the exit code is the number of failures.
"""

import argparse
import importlib.util
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)
from playwright.sync_api import sync_playwright  # noqa: E402

PATH = "/work/lifetime/"
SIZES = {1440: 900, 768: 1024, 390: 844}
DAY_START, DAY_END = 6 * 60, 18 * 60
MOMENTS = {"morning": 8 * 60, "outage": 11 * 60 + 30, "end": DAY_END}

# What the window shows, read from the page itself (the words and numbers a visitor sees).
SHOWN = """() => {
  const n = (sel) => Number(document.querySelector(sel).textContent.trim());
  const chips = Object.fromEntries(['online', 'offline', 'noreport', 'pending'].map((s) => [s, n(`[data-num="${s}"]`)]));
  const desks = [...document.querySelectorAll('[data-desk]')];
  const unknown = [...document.querySelectorAll('[data-rows] .lt-seg.is-unknown')];
  const cover = getComputedStyle(document.querySelector('[data-rows]')).getPropertyValue('--cover');
  return {
    chips, room: desks.filter((d) => !d.classList.contains('is-absent')).length,
    awakeDesks: desks.filter((d) => d.classList.contains('is-on')).length,
    gauge: n('[data-gauge-num]'), lit: document.querySelectorAll('[data-tick].is-lit').length,
    clock: document.querySelector('[data-clock]').textContent, run: document.querySelector('[data-run]').textContent,
    stopped: document.querySelector('[data-app]').classList.contains('is-stopped'),
    unknownRows: unknown.length, cover: parseFloat(cover),
    unknownEnd: unknown.length ? parseFloat(unknown[0].style.left) + parseFloat(unknown[0].style.width) : null,
    detName: document.querySelector('[data-det-name]').textContent, detValue: document.querySelector('[data-det-value]').textContent,
    rowAwake: (() => { const sel = document.querySelector('[data-rows] .is-selected [data-awake]'); return sel ? sel.textContent : null; })(),
    sim: window.__lifetime.view(),
  };
}"""

PIN = """(minute) => { const track = document.querySelector('[data-track]'); const stage = document.querySelector('[data-stage]');
  const header = document.querySelector('[data-site-header]').offsetHeight;
  const top = track.getBoundingClientRect().top + scrollY - header; const run = track.offsetHeight - stage.offsetHeight;
  scrollTo(0, top + run * (minute - %d) / %d); }""" % (DAY_START, DAY_END - DAY_START)


def open_page(browser, theme, width=1440, reduced=False, extra=""):
    page = browser.new_page(viewport={"width": width, "height": SIZES[width]}, reduced_motion="reduce" if reduced else "no-preference")
    page.add_init_script(cl.INIT % {"theme": theme, "extra": extra})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + PATH, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_function("!!window.__lifetime", timeout=10000)
    page.wait_for_timeout(500)
    page.errors = errors
    return page


def go(page, minute):
    page.evaluate(PIN, minute)
    page.wait_for_timeout(250)
    page.wait_for_function("!window.__lifetime.running()", timeout=5000)
    page.wait_for_timeout(150)
    return page.evaluate(SHOWN)


def check_day(browser):
    page = open_page(browser, "dark")
    report = cl.report
    report(page.evaluate("document.querySelectorAll('h1').length") == 1, "one h1")
    report(page.evaluate("!!document.querySelector('.case')"), "the case (ProjectCase) is on the page")
    report(not page.errors, f"no script errors ({page.errors[:1]})")
    seen = {}
    for name, minute in MOMENTS.items():
        s = go(page, minute)
        seen[name] = s
        total = sum(s["chips"].values())
        report(s["clock"] == f"{minute // 60:02d}:{minute % 60:02d}", f"{name}: the clock reads {s['clock']}")
        report(total == s["room"] and total == s["sim"]["fleet"]["total"],
               f"{name}: Online {s['chips']['online']} + Offline {s['chips']['offline']} + No report {s['chips']['noreport']} + Pending {s['chips']['pending']} = {total}, the room has {s['room']}")
        enrolled = s["room"] - s["chips"]["pending"]
        report(s["gauge"] == s["chips"]["online"] and s["lit"] == round(s["chips"]["online"] / enrolled * 31),
               f"{name}: the gauge shows {s['gauge']} online, {s['lit']} of 31 ticks lit")
        report(s["detValue"] == s["rowAwake"] or s["rowAwake"] is None, f"{name}: the picked computer's awake time is the same in its row and its details ({s['detValue']})")
    m, o, e = seen["morning"], seen["outage"], seen["end"]
    report(m["chips"]["online"] >= 15 and m["awakeDesks"] >= 15 and not m["stopped"], f"morning: the lab is awake ({m['chips']['online']} online, {m['awakeDesks']} lit screens)")
    report(m["unknownRows"] == 0 or m["cover"] > 1 - (10 * 60 + 30) / 1440 - 0.001, "morning: no Unknown shown yet")
    report(o["stopped"] and o["run"] == "Server stopped", f"outage: the window says the server stopped ({o['run']!r})")
    report(o["sim"]["fleet"]["updated"] == 10 * 60 + 29 and o["sim"]["fleet"]["live"] is False, "outage: the dashboard is frozen at 10:29")
    report(o["awakeDesks"] > 0 and o["sim"]["queued"] > 0, f"outage: the lab carries on ({o['awakeDesks']} screens lit, {o['sim']['queued']} min counted and not sent)")
    early, late = go(page, 10 * 60 + 35), go(page, 12 * 60 + 25)
    report(early["chips"] == late["chips"] == o["chips"] and late["awakeDesks"] != early["awakeDesks"],
           f"outage: the counts stay frozen while the lab changes ({early['awakeDesks']} -> {late['awakeDesks']} lit screens)")
    revealed = e["unknownEnd"] is not None and (1 - e["cover"]) * 100 >= e["unknownEnd"] - 0.01
    report(not e["stopped"] and e["unknownRows"] > 0 and revealed, f"end: every row shows the outage as Unknown ({e['unknownRows']} rows, revealed {revealed})")
    report(e["sim"]["queued"] == 0, "end: everything the computers counted has arrived")
    unknown_visible = page.evaluate("getComputedStyle(document.querySelector('[data-rows] .lt-seg.is-unknown')).boxShadow")
    report("inset" in unknown_visible, f"end: Unknown is drawn as an outline, not a colour ({unknown_visible[:40]})")
    # pauses when off screen: scroll away, nothing runs and nothing renders
    page.evaluate("scrollTo(0, 0)")
    page.wait_for_timeout(400)
    before = page.evaluate("window.__lifetime.renders()")
    page.mouse.wheel(0, 120)
    page.wait_for_timeout(400)
    report(not page.evaluate("window.__lifetime.running()") and page.evaluate("window.__lifetime.renders()") == before, "off screen: the demo does no work")
    page.close()


def check_switches(browser):
    report = cl.report
    page = open_page(browser, "dark")
    go(page, 13 * 60)
    app = "document.querySelector('[data-app]')"
    look = f"(() => {{ const a = {app}; const card = a.querySelector('.lt-card'); return {{ style: a.dataset.style, theme: a.dataset.theme, bg: getComputedStyle(a).backgroundImage.slice(0, 30), card: getComputedStyle(card).backgroundColor, color: getComputedStyle(a).color }}; }})()"
    glass = page.evaluate(look)
    page.click("[data-set-style='classic']")
    page.wait_for_timeout(200)
    classic = page.evaluate(look)
    report(glass["style"] == "glass" and classic["style"] == "classic" and "gradient" in glass["bg"] and classic["bg"] == "none" and glass["card"] != classic["card"],
           f"Glass to Classic changes the window ({glass['bg'][:16]} / {glass['card']} -> {classic['bg']} / {classic['card']})")
    page.click("[data-set-theme='light']")
    page.wait_for_timeout(300)
    light = page.evaluate(look)
    report(light["theme"] == "light" and light["color"] != classic["color"], f"Dark to Light changes the window ({classic['color']} -> {light['color']})")
    page.click("[data-app-theme]")
    page.wait_for_timeout(300)
    report(page.evaluate(look)["theme"] == "dark" and page.evaluate("document.querySelector(\"[data-set-theme='dark']\").getAttribute('aria-pressed')") == "true",
           "the window's own theme button switches it back, and the page's switch follows")
    page.click("[data-lang]")
    page.wait_for_timeout(200)
    title = page.evaluate("document.querySelector('[data-app] [data-t=\"title\"]').textContent")
    report(title == "Tổng quan thiết bị" and page.evaluate(f"{app}.lang") == "vi", f"EN switches the window to Vietnamese ({title!r})")
    page.click("[data-lang]")
    # a count shows which computers it is (the product's own filter)
    page.click("[data-filter='offline']")
    page.wait_for_timeout(200)
    rows = page.evaluate("[...document.querySelectorAll('[data-rows] [data-chip]')].map((c) => c.dataset.state)")
    report(rows and all(r == "offline" for r in rows), f"clicking Offline lists the offline computers ({len(rows)} rows)")
    page.close()


def check_keyboard(browser):
    report = cl.report
    page = open_page(browser, "dark")
    go(page, 14 * 60)
    page.focus("[data-desk][tabindex='0']")
    first = page.evaluate("document.querySelector('[data-det-name]').textContent")
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(150)
    second = page.evaluate("document.querySelector('[data-det-name]').textContent")
    focused = page.evaluate("document.activeElement.getAttribute('aria-checked')")
    report(first != second and focused == "true", f"keyboard: arrows on the plan pick the next computer ({first} -> {second})")
    page.focus("[data-time]")
    page.keyboard.press("End")
    page.wait_for_timeout(300)
    page.wait_for_function("!window.__lifetime.running()", timeout=5000)
    report(page.evaluate("document.querySelector('[data-clock]').textContent") == "18:00", "keyboard: End on the time slider runs to the end of the day")
    page.close()


def check_reduced(browser):
    report = cl.report
    page = open_page(browser, "dark", reduced=True)
    s = page.evaluate("""() => ({ pos: getComputedStyle(document.querySelector('[data-stage]')).position,
      clock: document.querySelector('[data-clock]').textContent, fit: getComputedStyle(document.querySelector('[data-fit]')).transform,
      track: document.querySelector('[data-track]').offsetHeight, stage: document.querySelector('[data-stage]').offsetHeight })""")
    report(s["pos"] == "static" and s["clock"] == "18:00" and s["fit"] == "none" and s["track"] == s["stage"],
           f"reduced motion: the end of the day, still, not pinned ({s})")
    page.evaluate("document.querySelector('[data-ltd]').scrollIntoView()")
    page.mouse.wheel(0, 400)
    page.wait_for_timeout(400)
    report(page.evaluate("document.querySelector('[data-clock]').textContent") == "18:00", "reduced motion: scrolling leaves it at the end of the day")
    page.close()


def check_layout(browser, shots):
    report = cl.report
    for width in SIZES:
        for theme in ("dark", "light"):
            page = open_page(browser, theme, width)
            wide = page.evaluate("document.documentElement.scrollWidth")
            report(wide <= width, f"{width} {theme}: no sideways scroll ({wide})")
            name = f"{width}-{theme}"
            if shots:
                page.screenshot(path=f"{shots}/{name}-top.png")
            for moment, minute in MOMENTS.items():
                go(page, minute)
                fit = page.evaluate("(() => { const r = document.querySelector('[data-fit]').getBoundingClientRect(); return [r.top, r.bottom]; })()")
                report(fit[1] <= SIZES[width] + 1, f"{name} {moment}: the whole demo fits the screen ({fit[0]:.0f} to {fit[1]:.0f})")
                if shots:
                    page.screenshot(path=f"{shots}/{name}-{moment}.png")
            # the plates: whole pictures at their own shape
            plates = page.evaluate("""() => [...document.querySelectorAll('.lt-plate img')].map((i) => {
              const r = i.getBoundingClientRect(); return { fit: getComputedStyle(i).objectFit, shown: r.width / r.height, own: i.naturalWidth / i.naturalHeight || i.width / i.height, left: r.left, right: r.right }; })""")
            ok = len(plates) >= 4 and all(p["fit"] == "contain" and abs(p["shown"] - p["own"]) < 0.02 and p["left"] >= 0 and p["right"] <= width for p in plates)
            report(ok, f"{name}: {len(plates)} plates, whole and at their own shape")
            if shots:
                h = page.evaluate("document.documentElement.scrollHeight")
                y = page.evaluate("(() => { const t = document.querySelector('[data-track]'); return t.getBoundingClientRect().top + scrollY + t.offsetHeight; })()")
                i = 0
                while y < h - 100 and i < 16:
                    page.evaluate(f"scrollTo(0, {y})")
                    page.wait_for_timeout(500)
                    page.screenshot(path=f"{shots}/{name}-down{i:02d}.png")
                    y += SIZES[width] * 0.85
                    i += 1
            page.close()


def check_facts(browser):
    report = cl.report
    page = open_page(browser, "dark")
    text = page.evaluate("document.querySelector('main').innerText")
    report("Coming in version 1.2.0" in text and "The current public version is 1.1.0" in text, "1.2.0 is marked as coming; 1.1.0 is the public version")
    report("COBACOM" in text and "[CHECK]" not in text, "COBACOM is the partner; no [CHECK] shows")
    report("A simulation of the Lifetime Server interface" in text, "the demo says plainly that it is a simulation")
    page.close()


def main():
    global BASE
    sys.stdout.reconfigure(encoding="utf-8")  # the Vietnamese words in the results
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--port", type=int, default=4404)
    parser.add_argument("--shots", action="store_true")
    args = parser.parse_args()
    proc = None if args.url else cl.serve(args.port)
    BASE = (args.url or f"http://localhost:{args.port}").rstrip("/")
    shots = None
    if args.shots:
        shots = os.path.join(ROOT, "screenshots", "lifetime")
        os.makedirs(shots, exist_ok=True)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            check_day(browser)
            check_switches(browser)
            check_keyboard(browser)
            check_reduced(browser)
            check_facts(browser)
            check_layout(browser, shots)
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    sys.exit(cl.failures)


if __name__ == "__main__":
    main()
