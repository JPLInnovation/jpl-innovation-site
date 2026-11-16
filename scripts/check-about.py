"""
About and the 404, in real Chrome (the about worker's checks).

    npm run build
    python scripts/check-about.py [--port 4407]

About: one h1, and no story film (the owner had it removed). The 404 (dist/404.html through the preview): the missing sheet,
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


def page_at(browser, base, path, theme, width=1440, height=900, **kw):
    page = browser.new_page(viewport={"width": width, "height": height}, **kw)
    page.add_init_script(cl.INIT % {"theme": theme, "extra": "localStorage.setItem('surface', 'glass');"})
    page.goto(base + path, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(500)
    return page


def check_page(browser, base, theme):
    page = page_at(browser, base, "/about/", theme)
    cl.report(page.evaluate("document.querySelectorAll('h1').length") == 1, f"{theme} /about/: one h1")
    cl.report(page.evaluate("!document.querySelector('[data-film], [data-film-open]')"), f"{theme} /about/: no story film (removed 16 Nov 2026)")
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
                check_page(browser, base, theme)
                check_404(browser, base, theme)
            check_widths(browser, base)
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    sys.exit(cl.failures)


if __name__ == "__main__":
    main()
