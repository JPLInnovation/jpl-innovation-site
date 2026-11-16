"""
About and the 404, in real Chrome (the about worker's checks).

    npm run build
    python scripts/check-about.py [--port 4407]

About: one h1; "Play the story" opens the film full screen and pauses the field; its subtitles write themselves
(whole at once under reduced motion); Skip and Escape close it and focus returns to the button; at its end the
edition choice drives Settings' Glass/Solid switch. The 404 (dist/404.html through the preview): the missing sheet,
the address in its title block, the register. Both themes; no sideways scroll at 1440, 768 and 390.
"""
import argparse, importlib.util, os, subprocess, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=4407)
args = ap.parse_args()
OPEN = "document.querySelector('[data-film]').open"
FOCUS_ON_PLATE = "document.activeElement && document.activeElement.matches('[data-film-open]')"


def page_at(browser, base, path, theme, width=1440, height=900, **kw):
    page = browser.new_page(viewport={"width": width, "height": height}, **kw)
    page.add_init_script(cl.INIT % {"theme": theme, "extra": "localStorage.setItem('surface', 'glass');"})
    page.goto(base + path, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(500)
    return page


def check_film(browser, base, theme):
    page = page_at(browser, base, "/about/", theme)
    cl.report(page.evaluate("document.querySelectorAll('h1').length") == 1, f"{theme} /about/: one h1")
    page.click("[data-film-open]")
    page.wait_for_timeout(400)
    box = page.evaluate("(() => { const r = document.querySelector('[data-film]').getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight]; })()")
    cl.report(page.evaluate(OPEN) and box[0] == box[2] and box[1] == box[3], f"{theme}: Play the story opens the film over the whole screen ({box})")
    page.wait_for_timeout(600)
    cl.report(page.evaluate("window.__field ? window.__field.paused : true"), f"{theme}: the field behind is paused while it plays")
    page.wait_for_timeout(2600)
    typed = page.evaluate("[document.querySelector('[data-typed]').textContent, document.querySelector('[data-ghost]').textContent]")
    cl.report(len(typed[0]) > 0, f"{theme}: a subtitle is writing itself ({typed[0]!r} + {len(typed[1])} to come)")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    cl.report(not page.evaluate(OPEN) and page.evaluate(FOCUS_ON_PLATE), f"{theme}: Escape closes it and focus returns to the button")
    page.click("[data-film-open]")
    page.wait_for_timeout(1200)
    page.click("[data-film-skip]")
    page.wait_for_timeout(300)
    cl.report(not page.evaluate(OPEN) and page.evaluate(FOCUS_ON_PLATE), f"{theme}: Skip closes it and focus returns to the button")
    # the end: jump to the last chapter, let it run out
    page.click("[data-film-open]")
    page.wait_for_timeout(900)
    page.click("[data-film-chapter='4']")
    page.wait_for_function("!document.querySelector('[data-film-end]').hidden", timeout=20000)
    cl.report(page.evaluate("document.activeElement && document.activeElement.id === 'film-end-heading'"), f"{theme}: at its end the edition choice shows and takes focus")
    page.click("[data-edition='solid']")
    page.wait_for_timeout(200)
    solid = page.evaluate("[document.documentElement.classList.contains('solid'), localStorage.getItem('surface'), document.querySelector('[data-edition=solid]').getAttribute('aria-pressed')]")
    cl.report(solid == [True, "solid", "true"], f"{theme}: Solid there is Settings' Solid (html.solid, stored, pressed: {solid})")
    page.click("[data-edition='glass']")
    page.wait_for_timeout(200)
    cl.report(not page.evaluate("document.documentElement.classList.contains('solid')"), f"{theme}: and Glass switches back")
    page.click("[data-film-close]")
    page.wait_for_timeout(300)
    cl.report(not page.evaluate(OPEN) and page.evaluate(FOCUS_ON_PLATE), f"{theme}: Back to the page closes it, focus on the button")
    page.close()


def check_reduced(browser, base):
    page = page_at(browser, base, "/about/", "dark", reduced_motion="reduce")
    page.click("[data-film-open]")
    page.wait_for_timeout(2300)  # past the first chapter's name
    typed = page.evaluate("[document.querySelector('[data-typed]').textContent, document.querySelector('[data-ghost]').textContent]")
    cl.report(len(typed[0]) > 0 and typed[1] == "", f"reduced motion: a subtitle appears whole ({typed})")
    page.close()


def check_404(browser, base, theme):
    page = page_at(browser, base, "/does-not-exist/", theme)
    h1 = page.evaluate("document.querySelector('main h1').textContent")
    address = page.evaluate("document.querySelector('.missing__sheet .title-block__cell:last-child dd').textContent")
    links = page.evaluate("[...document.querySelectorAll('.register__table a')].map(a => a.getAttribute('href'))")
    cl.report("sheet isn" in h1 and address == "/does-not-exist/", f"{theme} 404: the missing sheet, its address in the title block ({address!r})")
    cl.report(len(links) >= 8 and "/about/" in links and "/work/" in links, f"{theme} 404: the register lists the set ({len(links)} sheets)")
    page.close()


def check_widths(browser, base):
    for path in ("/about/", "/does-not-exist/"):
        for width, height in ((1440, 900), (768, 1024), (390, 844)):
            page = page_at(browser, base, path, "light", width, height)
            over = page.evaluate("document.documentElement.scrollWidth - innerWidth")
            cl.report(over <= 0, f"{path} at {width}: no sideways scroll ({over}px)")
            page.close()


def main():
    proc = cl.serve(args.port)
    base = f"http://localhost:{args.port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            for theme in ("dark", "light"):
                check_film(browser, base, theme)
                check_404(browser, base, theme)
            check_reduced(browser, base)
            check_widths(browser, base)
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    sys.exit(cl.failures)


if __name__ == "__main__":
    main()
