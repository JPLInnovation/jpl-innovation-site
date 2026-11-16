"""
The findings of the review of the overnight rebuild (16 Nov 2026), each replayed in real Chrome so it stays fixed.

    npm run build
    python scripts/check-review.py [--port 4391]
"""

import argparse
import importlib.util
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)
from playwright.sync_api import sync_playwright


def open_page(browser, base, path):
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script(cl.INIT % {"theme": "dark", "extra": ""})
    page.goto(base + path, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    page.wait_for_timeout(600)
    return page, errors


def go(page, href):
    """An in-site visit (Astro's view transition), as a click would make it."""
    page.evaluate(f"document.querySelector(\"a[href='{href}']\")?.click() ?? (location.href = '{href}')")
    page.wait_for_function(f"location.pathname === '{href}'", timeout=10000)
    page.wait_for_timeout(1200)


def check_terminal_after_visit(browser, base):
    # 1. The CCNA console's data block was split into words by motion.ts on an in-site visit: JSON.parse threw.
    page, errors = open_page(browser, base, "/")
    go(page, "/work/")
    go(page, "/work/cybersecurity/")
    page.locator("#ios-command").scroll_into_view_if_needed()
    page.wait_for_timeout(600)
    typed = False
    if page.locator("#ios-command").is_visible():
        page.fill("#ios-command", "show vlan brief")
        page.press("#ios-command", "Enter")
        page.wait_for_timeout(300)
        typed = "10   LAB" in page.inner_text("[data-screen]")
    cl.report(typed, "Home > Work > Cybersecurity: the console still takes a command and answers it")
    cl.report(not errors, f"... and no script error on the way ({errors[:1]})")
    page.close()


def check_member_fit_leak(browser, base):
    # 3. The member page's fit-to-width script set font-size on the next page's [data-fit] (the Lifetime demo).
    page, _ = open_page(browser, base, "/members/jayden/")
    go(page, "/work/lifetime/")
    sized = page.evaluate("[...document.querySelectorAll('[data-fit], .ltd-fit')].map((el) => el.style.fontSize).filter(Boolean)")
    cl.report(not sized, f"Jayden's sheet > Lifetime: nothing on the next page was resized by the member page's script ({sized})")
    page.close()


def check_single_decoder(browser, base):
    # 2. Two decoders worked on the same drone headings and could leave them scrambled.
    page, _ = open_page(browser, base, "/work/drone/")
    both = page.evaluate("document.querySelectorAll('[data-decode][data-drone-decode]').length")
    cl.report(both == 0, f"/work/drone/: no heading is claimed by both decoders ({both})")
    heads = page.locator(".case [data-decode]")
    if heads.count():
        want = heads.first.evaluate("el => el.getAttribute('aria-label') || el.dataset.text || ''")
        heads.first.scroll_into_view_if_needed()
        page.wait_for_timeout(2500)
        got = heads.first.evaluate("el => el.textContent.replace(/\\s+/g, ' ').trim()")
        cl.report(not want or got == want.strip(), f"/work/drone/: the case headline settles on its own words ({got!r})")
    page.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4391)
    args = ap.parse_args()
    proc = cl.serve(args.port)
    base = f"http://localhost:{args.port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            check_terminal_after_visit(browser, base)
            check_member_fit_leak(browser, base)
            check_single_decoder(browser, base)
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, capture_output=True)
    print(f"{cl.failures} failure(s)")
    raise SystemExit(cl.failures)


if __name__ == "__main__":
    main()
