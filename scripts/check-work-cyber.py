"""
Checks for the Work register, the project-page kit and the Cybersecurity sheet, in real Chrome.

    npm run build
    python scripts/check-work-cyber.py                 checks (starts `astro preview` on port 4402, stops it after)
    python scripts/check-work-cyber.py --shots         also screenshots: 1440/768/390, both themes, down each page
    python scripts/check-work-cyber.py --url URL       against a server already running

Each check prints PASS or FAIL; the exit code is the number of failures.
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

ORDER = ["drone", "lifetime", "frc", "mini-drone", "cybersecurity"]
TITLES = ["F450 4G Drone", "Lifetime", "FIRST Robotics", "Mini Arduino Drone", "Cybersecurity"]
SHOTS = os.path.join(ROOT, "screenshots", "work-cyber")


def open_page(browser, base, path, theme, width=1440, height=900, extra=""):
    page = browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script(cl.INIT % {"theme": theme, "extra": extra})
    page.goto(base + path, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(500)
    page.errors = errors
    return page


def no_side_scroll(page):
    return page.evaluate("document.scrollingElement.scrollWidth <= innerWidth + 1")


def check_register(browser, base):
    for theme in ("dark", "light"):
        page = open_page(browser, base, "/work/", theme)
        r = page.evaluate("""() => {
          const rows = [...document.querySelectorAll('[data-register] tbody .register__row')];
          return {
            h1: [...document.querySelectorAll('h1')].filter((h) => h.checkVisibility()).map((h) => h.textContent.trim()),
            living: document.querySelector('main h1').classList.contains('living'),
            names: rows.map((r) => r.querySelector('th').textContent.trim()),
            links: rows.map((r) => r.querySelector('a[href^="/work/"]')?.getAttribute('href')),
            cols: [...document.querySelectorAll('[data-register] thead th')].map((t) => t.textContent.trim()),
            table: !!document.querySelector('[data-register] table'),
            block: !!document.querySelector('main .title-block'),
          }; }""")
        cl.report(r["h1"] == ["Work"] and r["living"], f"{theme} /work/: one visible h1, 'Work', in living colour ({r['h1']})")
        cl.report(r["table"] and r["names"] == TITLES, f"{theme} /work/: a real table, projects in order ({r['names']})")
        cl.report(r["links"] == [f"/work/{p}/" for p in ORDER], f"{theme} /work/: every row carries its real link ({r['links']})")
        cl.report(r["cols"][:4] == ["Project", "Discipline", "Status", "Revision"], f"{theme} /work/: columns {r['cols'][:4]}")
        cl.report(r["block"], f"{theme} /work/: the title block is on the sheet")
        cl.report(not page.errors, f"{theme} /work/: no script errors ({page.errors[:2]})")
        page.close()

    page = open_page(browser, base, "/work/", "dark")
    box = page.locator(".register__row >> nth=2").bounding_box()
    page.mouse.move(box["x"] + 200, box["y"] + box["height"] / 2, steps=6)
    page.wait_for_timeout(700)
    peek = page.evaluate("(() => { const p = document.querySelector('[data-peek]'); return p.hasAttribute('data-on') && p.querySelector('img').getAttribute('src'); })()")
    os.makedirs(SHOTS, exist_ok=True)
    page.screenshot(path=os.path.join(SHOTS, "work-peek-dark-1440.png"))
    cl.report(peek == "/assets/FRCnew.jpg", f"/work/: pointing at a closed row shows its picture beside the pointer ({peek})")
    page.mouse.move(5, 5)
    state = "() => [...document.querySelectorAll('[data-register-toggle]')].map((t) => t.getAttribute('aria-expanded') === 'true' && !document.getElementById(t.getAttribute('aria-controls')).hidden)"
    cl.report(page.evaluate(state) == [False] * 5, "/work/: every plate starts closed")
    page.click("[data-register-toggle] >> nth=2")
    page.wait_for_timeout(1600)
    opened = page.evaluate(state)
    img = page.evaluate("(() => { const i = document.querySelector('#plate-frc img'); return i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 600; })()")
    cl.report(opened == [False, False, True, False, False] and img, f"/work/: a click opens FIRST Robotics' plate, its picture whole-width ({opened}, {img})")
    page.click("[data-register-toggle] >> nth=0")
    page.wait_for_timeout(300)
    cl.report(page.evaluate(state) == [True, False, False, False, False], "/work/: opening another closes the first")
    # keyboard: Escape closes and gives focus back; Enter and Space open
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    back = page.evaluate("document.activeElement.matches('[data-register-toggle]') && document.activeElement.getAttribute('aria-controls')")
    cl.report(page.evaluate(state) == [False] * 5 and back == "plate-drone", f"/work/: Escape closes it, focus back on its row ({back})")
    page.keyboard.press("Tab")  # the row's own link
    link = page.evaluate("document.activeElement.getAttribute('href')")
    page.keyboard.press("Tab")
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)
    after_enter = page.evaluate(state)
    page.keyboard.press("Space")
    page.wait_for_timeout(300)
    cl.report(link == "/work/drone/" and after_enter[1] and page.evaluate(state) == [False] * 5,
              f"/work/: Tab reaches the row's link ({link}), then the next row; Enter opens, Space closes")
    page.close()

    page = open_page(browser, base, "/work/", "light", 390, 844)
    page.click("[data-register-toggle] >> nth=0")
    page.wait_for_timeout(1200)
    cl.report(no_side_scroll(page), "390 px /work/ with a plate open: no sideways scroll")
    page.close()


def check_cyber(browser, base):
    for theme in ("dark", "light"):
        page = open_page(browser, base, "/work/cybersecurity/", theme)
        page.locator("#ios-command").scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.fill("#ios-command", "show vlan brief")
        page.press("#ios-command", "Enter")
        page.wait_for_timeout(200)
        screen = page.inner_text("[data-screen]")
        cl.report("10   LAB" in screen and "20   STAFF" in screen, f"{theme} /work/cybersecurity/: 'show vlan brief' gets the VLAN table")
        page.fill("#ios-command", "conf t")
        page.press("#ios-command", "Enter")
        page.fill("#ios-command", "hostname JPL")
        page.press("#ios-command", "Enter")
        prompt = page.inner_text("[data-cli-prompt]")
        cl.report(prompt == "JPL(config)#", f"{theme}: 'conf t' then 'hostname JPL' changes the prompt ({prompt})")
        page.fill("#ios-command", "bananas")
        page.press("#ios-command", "Enter")
        screen = page.inner_text("[data-screen]")
        cl.report("% Invalid input detected" in screen, f"{theme}: nonsense gets IOS's own complaint")
        page.press("#ios-command", "ArrowUp")
        cl.report(page.input_value("#ios-command") == "bananas", f"{theme}: the up arrow brings the last command back")
        r = page.evaluate("""() => ({ h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
          block: !!document.querySelector('main .title-block'), plate: !!document.querySelector('[data-plate] canvas, [data-plate] img'),
          day: !!document.querySelector('.cyber-lab[data-field=day]') })""")
        cl.report(r["h1"] == ["Cybersecurity"] and r["block"] and r["plate"] and r["day"], f"{theme} /work/cybersecurity/: one h1, title block, the topology plate, the lab in day ({r})")
        cl.report(not page.errors, f"{theme} /work/cybersecurity/: no script errors ({page.errors[:2]})")
        page.close()
    page = open_page(browser, base, "/work/cybersecurity/", "dark", 390, 844)
    page.evaluate("scrollTo(0, document.body.scrollHeight / 2)")
    page.wait_for_timeout(600)
    cl.report(no_side_scroll(page), "390 px /work/cybersecurity/: no sideways scroll")
    page.close()


def check_kit(browser, base):
    for name in ORDER:
        for theme in ("dark", "light"):
            page = open_page(browser, base, f"/work/{name}/", theme)
            r = page.evaluate("""() => ({ h1: document.querySelectorAll('h1').length,
              next: document.querySelector('.next a')?.getAttribute('href'),
              case: !!document.querySelector('.case .sheet h2'), pills: document.querySelectorAll('.status-tag').length })""")
            nxt = f"/work/{ORDER[(ORDER.index(name) + 1) % len(ORDER)]}/"
            cl.report(r["h1"] == 1 and r["next"] == nxt and r["case"] and not page.errors,
                      f"{theme} /work/{name}/ renders with the kit (h1 x{r['h1']}, next {r['next']}, case {r['case']}, errors {page.errors[:1]})")
            page.close()


def check_wall(browser, base):
    """The Work page's 3D mode: the wall still comes up, its card follows the panel in front, the ruler moves it."""
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script(cl.INIT % {"theme": "dark", "extra": "localStorage.setItem('experience', '3d');"})
    page.goto(base + "/work/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    try:
        page.wait_for_function("document.querySelector('[data-wall][data-live]')", timeout=20000)
        live = True
    except Exception:
        live = False
    card = page.evaluate("document.querySelector('[data-wall-card][data-active] .wall-card-title')?.textContent.trim()")
    cl.report(live and card == TITLES[0], f"3D /work/: the wall is live, the card shows the first project ({live}, {card!r})")
    page.click("[data-wall-goto='2']")
    page.wait_for_timeout(2500)
    name = page.inner_text("[data-wall-name]")
    card = page.evaluate("document.querySelector('[data-wall-card][data-active] .wall-card-title')?.textContent.trim()")
    cl.report(name == TITLES[2] and card == TITLES[2], f"3D /work/: the ruler moves the wall to {name!r}, the card follows ({card!r})")
    cl.report(not errors, f"3D /work/: no script errors ({errors[:2]})")
    os.makedirs(SHOTS, exist_ok=True)
    page.screenshot(path=os.path.join(SHOTS, "wall-3d-dark-1440.png"))
    page.close()


def kit_shots(browser, base):
    """The other project pages with the restyled kit: their case and their next chapter."""
    os.makedirs(SHOTS, exist_ok=True)
    for name in ("drone", "lifetime", "frc", "mini-drone"):
        for theme in ("dark", "light"):
            page = open_page(browser, base, f"/work/{name}/", theme)
            for part in (".case", ".case__answer", ".next"):
                page.evaluate(f"document.querySelector('{part}').scrollIntoView({{ block: 'start' }})")
                page.mouse.move(700, 450)
                page.wait_for_timeout(1400)
                page.screenshot(path=os.path.join(SHOTS, f"kit-{name}-{theme}-{part.strip('.').replace('__', '-')}.png"))
            page.close()


def shots(browser, base):
    os.makedirs(SHOTS, exist_ok=True)
    kit_shots(browser, base)
    for path, slug in (("/work/", "work"), ("/work/cybersecurity/", "cyber")):
        for theme in ("dark", "light"):
            for width, height in ((1440, 900), (768, 1024), (390, 844)):
                page = open_page(browser, base, path, theme, width, height)
                if slug == "work":
                    page.click("[data-register-toggle] >> nth=0")
                    page.wait_for_timeout(300)
                    page.evaluate("scrollTo(0, 0)")
                total = page.evaluate("document.documentElement.scrollHeight - innerHeight")
                for k, at in enumerate((0, 0.18, 0.36, 0.54, 0.72, 0.9)):
                    page.evaluate(f"scrollTo(0, {total * at})")
                    page.mouse.move(width / 2, height / 2)
                    page.wait_for_timeout(1300)
                    page.screenshot(path=os.path.join(SHOTS, f"{slug}-{theme}-{width}-{k}.png"))
                page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--port", type=int, default=4402)
    parser.add_argument("--shots", action="store_true")
    parser.add_argument("--only-shots", action="store_true")
    args = parser.parse_args()
    proc = None if args.url else cl.serve(args.port)
    base = (args.url or f"http://localhost:{args.port}").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            if not args.only_shots:
                check_register(browser, base)
                check_cyber(browser, base)
                check_kit(browser, base)
                check_wall(browser, base)
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
