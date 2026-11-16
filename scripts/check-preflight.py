"""
Page checks for the Pre-flight hook (docs/superpowers/plans/2026-11-15-redesign-phase2-home-hook-footer.md, Task 2),
in real Chrome.

    npm run build
    python scripts/check-preflight.py --port 4409            the checks
    python scripts/check-preflight.py --port 4409 --shots    and screenshots of every beat (screenshots/preflight/)

Each check prints PASS or FAIL; the exit code is the number of failures.
"""

import argparse
import importlib.util
import os
import statistics
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)
report = cl.report

# A first visit: nothing in sessionStorage; the experience and theme as given ("" leaves the experience unset).
FIRST = """
try {
  if ('%(experience)s') localStorage.setItem('experience', '%(experience)s');
  localStorage.setItem('theme', '%(theme)s');
  localStorage.setItem('hook-seen', '1');
} catch (e) {}
// Frame intervals and the line drawn into the first sheet, kept for the checks.
window.__frames = []; window.__edge = '';
(() => { let last = 0; const f = (now) => { if (last) window.__frames.push(now - last); last = now;
  const e = document.querySelector('[data-pf-edge]'); if (e && e.getAttribute('d')) window.__edge = e.getAttribute('d');
  if (document.documentElement.classList.contains('splash') || !last) requestAnimationFrame(f); }; requestAnimationFrame(f); })();
"""
SPLASH_GONE = "!document.documentElement.classList.contains('splash')"
# The take-off prompt is up and waiting (preflight.ts marks the overlay while it waits), its words shown in full.
PROMPT_UP = "(() => { const p = document.querySelector('[data-splash][data-prompt] [data-pf-prompt]'); return !!p && getComputedStyle(p).opacity === '1'; })()"


def first_visit(browser, base, theme="dark", experience="classic", width=1440, height=900, **kw):
    context = browser.new_context(viewport={"width": width, "height": height}, **kw)
    page = context.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script(FIRST % {"theme": theme, "experience": experience})
    page.goto(base + "/", wait_until="commit")
    return context, page, errors


def check_plays(browser, base):
    context, page, errors = first_visit(browser, base)
    page.wait_for_selector("[data-splash-run]", state="attached", timeout=5000)
    t0 = time.time()
    shown = page.evaluate("(() => { const p = document.querySelector('[data-pf]'); return !!p && getComputedStyle(p).display !== 'none'; })()")
    full = page.evaluate("document.documentElement.classList.contains('intro-full') && !document.documentElement.classList.contains('splash-fast')")
    report(shown and full, "first visit: the Pre-flight hook plays")
    page.wait_for_function("document.querySelector('[data-pf-alt]')?.dataset.alt === '120'", timeout=6000)
    page.wait_for_function(PROMPT_UP, timeout=6000)
    up = time.time() - t0
    report(up < 4, f"the counter reaches 120 and the take-off prompt is up in {up:.2f} s (< 4 s)")
    rows = page.evaluate("document.querySelectorAll('[data-pf-row][data-on]').length")
    report(rows == 5, f"the boot log has run all its checks ({rows} of 5)")
    # Nothing heavy starts under the prompt: the page stays asleep (no splash-hold).
    report(not page.evaluate("document.documentElement.classList.contains('splash-hold')"), "at the prompt the page under it is still asleep")
    # No input: it takes off by itself after 4 s, the doors part, the page arrives.
    page.wait_for_function("(() => { const d = document.querySelector('[data-pf-door=\"l\"]'); return d && new DOMMatrix(getComputedStyle(d).transform).m41 < -50; })()", timeout=7000)
    took = time.time() - t0 - up
    report(3.6 < took < 5.5, f"untouched, it takes off by itself ({took:.1f} s after the prompt)")
    page.wait_for_function(SPLASH_GONE, timeout=8000)
    page.wait_for_timeout(400)
    logo = page.evaluate("getComputedStyle(document.querySelector('[data-site-header] [data-site-logo]')).opacity")
    report(logo == "1", f"the logo has landed in the header (opacity {logo})")
    edge = page.evaluate("window.__edge")
    report(edge.startswith("M") and "H" in edge, f"a line was drawn into the edge of the first glass sheet ({edge})")
    report(page.evaluate("sessionStorage.getItem('jpl-intro-seen')") == "1", "the visit is remembered (sessionStorage jpl-intro-seen)")
    frames = page.evaluate("window.__frames")
    late = frames[len(frames) // 10:]
    report(True, f"frame times during the hook: median {statistics.median(frames):.1f} ms, worst {max(late):.1f} ms, over 25 ms {sum(f > 25 for f in late)} of {len(late)}")
    # A second visit in the same tab: the fast logo intro, not the hook.
    page.goto(base + "/", wait_until="commit")
    page.wait_for_selector("html.splash", state="attached", timeout=5000)
    t1 = time.time()
    fast = page.evaluate("document.documentElement.classList.contains('intro-fast')")
    pf = page.evaluate("(() => { const p = document.querySelector('[data-pf]'); return !!p && getComputedStyle(p).display !== 'none'; })()")
    page.wait_for_function(SPLASH_GONE, timeout=8000)
    report(fast and not pf and time.time() - t1 < 3, f"second visit in the tab: the fast logo intro ({time.time() - t1:.1f} s), no hook")
    # A refresh: the fast logo intro too.
    page.reload(wait_until="commit")
    page.wait_for_selector("html.splash", state="attached", timeout=5000)
    report(page.evaluate("document.documentElement.classList.contains('intro-fast')"), "a refresh: the fast logo intro")
    page.wait_for_function(SPLASH_GONE, timeout=8000)
    report(not errors, f"no console errors ({errors[:3]})")
    context.close()


def check_skips(browser, base):
    # A key during the arming skips everything at once.
    context, page, errors = first_visit(browser, base)
    page.wait_for_selector("[data-splash-run]", state="attached", timeout=5000)
    page.wait_for_timeout(1000)
    page.keyboard.press("a")
    t = time.time()
    page.wait_for_function(SPLASH_GONE, timeout=3000)
    report(time.time() - t < 0.4, f"a key during the arming skips at once ({(time.time() - t) * 1000:.0f} ms)")
    context.close()
    # A scroll during the arming too.
    context, page, errors = first_visit(browser, base, theme="light")
    page.wait_for_selector("[data-splash-run]", state="attached", timeout=5000)
    page.wait_for_timeout(800)
    page.mouse.move(700, 400)
    page.mouse.wheel(0, 200)
    t = time.time()
    page.wait_for_function(SPLASH_GONE, timeout=3000)
    report(time.time() - t < 0.4, f"a scroll during the arming skips at once ({(time.time() - t) * 1000:.0f} ms)")
    context.close()
    # At the prompt a key takes off (it does not skip), and the rest still plays; a second key then skips.
    context, page, errors = first_visit(browser, base)
    page.wait_for_function(PROMPT_UP, timeout=6000)
    page.keyboard.press("Enter")
    page.wait_for_timeout(250)
    still = page.evaluate("document.documentElement.classList.contains('splash')")
    page.wait_for_timeout(600)
    hello = page.evaluate("new DOMMatrix(getComputedStyle(document.querySelector('[data-pf-hello]')).transform).m42")
    report(still and abs(hello) < 2, f"a key at the prompt takes off: XIN CHÀO! comes up (offset {hello:.1f} px)")
    page.keyboard.press("x")
    t = time.time()
    page.wait_for_function(SPLASH_GONE, timeout=3000)
    report(time.time() - t < 0.4, f"a key after take-off skips at once ({(time.time() - t) * 1000:.0f} ms)")
    report(not errors, f"no console errors ({errors[:3]})")
    context.close()
    # A click at the prompt takes off; a trackpad's scroll that follows doesn't skip the doors.
    context, page, errors = first_visit(browser, base)
    page.wait_for_function(PROMPT_UP, timeout=6000)
    page.mouse.move(700, 400)
    page.mouse.wheel(0, 100)
    for _ in range(6):
        page.wait_for_timeout(40)
        page.mouse.wheel(0, 60)
    page.wait_for_timeout(500)
    report(page.evaluate("document.documentElement.classList.contains('splash')"), "a scroll at the prompt takes off and its momentum doesn't skip the rest")
    page.wait_for_function(SPLASH_GONE, timeout=8000)
    context.close()


def check_reduced(browser, base):
    context, page, errors = first_visit(browser, base, reduced_motion="reduce")
    page.wait_for_selector("[data-splash-run]", state="attached", timeout=5000)
    t = time.time()
    got = page.evaluate("""(() => { const r = document.documentElement.classList;
      const lines = [...document.querySelectorAll('.pf-line:not(.pf-leader)')].map((l) => getComputedStyle(l).strokeDashoffset);
      const d = [...document.querySelectorAll('[data-pf-strip]')].map((s) => getComputedStyle(s).getPropertyValue('--d').trim());
      return { reduced: r.contains('splash-reduced'), full: r.contains('intro-full'), drawn: lines.every((v) => parseFloat(v) === 0), digits: d.join('') }; })()""")
    page.wait_for_function(SPLASH_GONE, timeout=5000)
    held = time.time() - t
    ok = got["reduced"] and got["full"] and got["drawn"] and got["digits"] == "120" and 0.9 < held < 2.2
    report(ok, f"reduced motion: a still of the finished drawing at 120 m for about a second ({got}, {held:.2f} s)")
    context.close()


def check_question(browser, base):
    # No experience saved, on a computer that could run the 3D: the hook plays, then the question on its opening page.
    context, page, errors = first_visit(browser, base, experience="")
    page.wait_for_function(PROMPT_UP, timeout=6000)
    page.keyboard.press("Enter")
    page.wait_for_selector(".splash-overlay[data-asking]", timeout=8000)
    report(True, "first visit with no experience: after the hook, Classic or 3D is asked")
    page.click("[data-intro-pick='classic']")
    page.wait_for_function(SPLASH_GONE, timeout=8000)
    report(page.evaluate("localStorage.getItem('experience')") == "classic", "the answer is kept (classic)")
    context.close()
    # Skipped before the question: the pop-up asks it after the hook.
    context, page, errors = first_visit(browser, base, experience="")
    page.wait_for_selector("[data-splash-run]", state="attached", timeout=5000)
    page.wait_for_timeout(900)
    page.keyboard.press("a")
    page.wait_for_function(SPLASH_GONE, timeout=3000)
    page.wait_for_timeout(400)
    report(page.evaluate("document.getElementById('experience-dialog').open"), "skipped before the question: the pop-up asks Classic or 3D")
    report(not errors, f"no console errors ({errors[:3]})")
    context.close()


def check_studio(browser, base):
    context, page, errors = first_visit(browser, base, experience="3d")
    page.wait_for_function(PROMPT_UP, timeout=6000)
    page.keyboard.press("Enter")
    page.wait_for_function(SPLASH_GONE, timeout=20000)
    page.wait_for_function("document.querySelector('[data-studio][data-live]')", timeout=20000)
    report(page.evaluate("document.documentElement.classList.contains('studio-on')"), "3D mode: after the hook, the studio is on")
    report(not errors, f"no console errors ({errors[:3]})")
    context.close()


def shots(browser, base):
    out = os.path.join(ROOT, "screenshots", "preflight")
    os.makedirs(out, exist_ok=True)
    for width, height in [(1440, 900), (768, 1024), (390, 844)]:
        for theme in ("dark", "light"):
            context, page, errors = first_visit(browser, base, theme=theme, width=width, height=height)
            t0 = time.time()

            def shot(name, at):
                dt = at - (time.time() - t0)
                if dt > 0:
                    time.sleep(dt)
                page.screenshot(path=os.path.join(out, f"{width}-{theme}-{name}.png"))

            for name, at in [("1-drawing", 1.0), ("2-climbing", 2.0), ("3-prompt", 3.4)]:
                shot(name, at)
            page.keyboard.press("Enter")
            t0 = time.time()
            for name, at in [("4-takeoff", 0.3), ("5-hello", 0.75), ("6-doors", 1.15), ("7-verbs", 1.95), ("8-handoff", 2.7)]:
                shot(name, at)
            page.wait_for_function(SPLASH_GONE, timeout=8000)
            page.wait_for_timeout(600)
            page.screenshot(path=os.path.join(out, f"{width}-{theme}-9-page.png"))
            context.close()
    # The reduced-motion still, and the question on the opening page (a first visit with no experience saved).
    context, page, errors = first_visit(browser, base, reduced_motion="reduce")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(out, "1440-dark-still.png"))
    context.close()
    for theme in ("dark", "light"):
        context, page, errors = first_visit(browser, base, theme=theme, experience="")
        page.wait_for_function(PROMPT_UP, timeout=6000)
        page.keyboard.press("Enter")
        page.wait_for_selector(".splash-overlay[data-asking]", timeout=8000)
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(out, f"1440-{theme}-asking.png"))
        context.close()
    print(f"screenshots in {out}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4409)
    parser.add_argument("--shots", action="store_true")
    args = parser.parse_args()
    os.chdir(ROOT)
    proc = cl.serve(args.port)
    base = f"http://localhost:{args.port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            # Warm the fresh preview server up, so the first check doesn't time a cold start.
            warm = browser.new_page()
            warm.goto(base + "/", wait_until="load")
            warm.close()
            check_plays(browser, base)
            check_skips(browser, base)
            check_reduced(browser, base)
            check_question(browser, base)
            check_studio(browser, base)
            if args.shots:
                shots(browser, base)
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    sys.exit(cl.failures)


if __name__ == "__main__":
    main()
