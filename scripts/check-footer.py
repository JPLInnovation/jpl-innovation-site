"""
The footer's page checks (docs/superpowers/plans/2026-11-15-redesign-phase2-home-hook-footer.md, Task 3), in real Chrome.

    npm run build
    python scripts/check-footer.py --port 4408        starts its own `astro preview` there, stops it after
    python scripts/check-footer.py --url URL          or checks a server that is already running

The curtain (the footer uncovered under the page at the end of /, /work/, /about/), the game "Land the drone" (Space
and a held pointer throttle it; Space anywhere else is left alone: the email pop-up, the CCNA terminal, Settings), its
best landing kept for the visit, its pause off screen, reduced motion, no script, and both themes at three widths.
Prints PASS / FAIL per check; the exit code is the number of failures.
"""
import argparse, importlib.util, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec); spec.loader.exec_module(cl)
from playwright.sync_api import sync_playwright

STATE = "window.__lander.state()"
END = "scrollTo(0, document.documentElement.scrollHeight)"
# The footer as the eye sees it: its box, its content's offset from where the flow puts it, and what is under two points
# just above and just below its top edge.
# The content's vertical offset from its place in the flow (the curtain's translate), in px.
SHIFT = lambda t: 0.0 if t == "none" else float(t.rstrip(")").split(",")[-1])
CURTAIN = """() => { const f = document.querySelector('[data-footer]'), inner = f.firstElementChild, r = f.getBoundingClientRect();
  const name = document.querySelector('.back__name').getBoundingClientRect();
  const at = (y) => { const el = document.elementFromPoint(innerWidth / 2, y); return !!el && !!el.closest('[data-footer]'); };
  return { top: r.top, bottom: r.bottom, h: f.offsetHeight, vh: innerHeight, nameTop: name.top,
    transform: getComputedStyle(inner).transform, anim: getComputedStyle(inner).animationName,
    above: r.top > 4 ? at(r.top - 3) : null, below: r.top + 3 < innerHeight ? at(Math.max(r.top + 3, 80)) : null }; }"""


def page_at(browser, base, path, theme="dark", w=1440, h=900, reduced=None, extra=""):
    pg = browser.new_page(viewport={"width": w, "height": h}, reduced_motion=reduced)
    pg.add_init_script(cl.INIT % {"theme": theme, "extra": extra})
    pg.goto(base + path, wait_until="load")
    pg.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    pg.wait_for_timeout(400)
    return pg


def to_game(pg):
    pg.evaluate(END)
    pg.wait_for_timeout(500)
    pg.wait_for_function("window.__lander && window.__lander.state().visible", timeout=4000)


def check_curtain(browser, base):
    for path in ("/", "/work/", "/about/"):
        pg = page_at(browser, base, path)
        end = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
        h = pg.evaluate("document.querySelector('[data-footer]').offsetHeight")
        pg.evaluate(f"scrollTo(0, {end})")
        pg.wait_for_timeout(400)
        e = pg.evaluate(CURTAIN)
        pg.evaluate(f"scrollTo(0, {end - min(h, 900) // 2})")
        pg.wait_for_timeout(400)
        m = pg.evaluate(CURTAIN)
        held = abs(m["nameTop"] - e["nameTop"]) < 1.5 if h <= 900 else True
        ok = (e["anim"] == "back-curtain" and abs(SHIFT(e["transform"])) < 1 and abs(e["bottom"] - e["vh"]) < 1.5
              and SHIFT(m["transform"]) < -100 and held and m["above"] is False and m["below"] is True)
        cl.report(ok, f"{path}: the page slides up off the footer (half-way: content held {held}, under the page edge "
                      f"{'footer' if m['above'] else 'page'}, below it {'footer' if m['below'] else 'page'}; at the end fully shown, footer {h}px)")
        pg.close()


def check_game_keys(browser, base):
    pg = page_at(browser, base, "/work/")
    to_game(pg)
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.mouse.move(5, 5)
    y0 = pg.evaluate("scrollY")
    # Space with nothing focused: not the game's (and the page is at its end, so nothing to scroll either)
    pg.keyboard.press("Space")
    pg.wait_for_timeout(300)
    cl.report(pg.evaluate(STATE)["phase"] == "ready", "Space with the game not focused: the game ignores it")
    # Space with the game focused (Tab-reachable play area): throttles, never scrolls
    pg.evaluate("window.scrollBy(0, -400)")
    pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-stage]').focus({ preventScroll: true })")
    pg.evaluate(END)
    pg.wait_for_timeout(300)
    y1 = pg.evaluate("scrollY")
    pg.keyboard.down("Space")
    pg.wait_for_timeout(700)
    s = pg.evaluate(STATE)
    y2 = pg.evaluate("scrollY")
    pg.keyboard.up("Space")
    pg.wait_for_timeout(600)
    after = pg.evaluate(STATE)
    cl.report(s["phase"] == "flying" and s["throttle"] and s["fuel"] < 5.6 and s["y"] >= 14.9 and not after["throttle"] and after["y"] < s["y"],
              f"Space held on the game: throttle on, fuel burning ({s['fuel']:.2f} s left), held at {s['y']:.1f} m; let go, it drops ({after['y']:.1f} m)")
    cl.report(y1 == y2, f"Space on the game does not scroll the page ({y1} -> {y2})")
    pg.wait_for_function("['soft', 'hard'].includes(window.__lander.state().phase)", timeout=8000)
    cl.report(pg.evaluate(STATE)["phase"] == "hard" and "Hard" in pg.inner_text("[data-status]"),
              f"dropped from the top: a hard landing, said so ({pg.inner_text('[data-status]')!r})")
    cl.report(pg.evaluate("document.querySelector('[data-stage]').getAttribute('role')") == "button"
              and pg.evaluate("document.querySelector('[data-stage]').tabIndex") == 0, "the play area is a focusable control (role button, in the Tab order)")
    pg.close()


def check_game_pointer(browser, base):
    for w, h, touch in ((1440, 900, False), (390, 844, True)):
        pg = browser.new_page(viewport={"width": w, "height": h}, has_touch=touch)
        pg.add_init_script(cl.INIT % {"theme": "light", "extra": ""})
        pg.goto(base + "/about/", wait_until="load")
        pg.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
        # where the play area sits in the flow (its box on screen is moved by the curtain until the footer is uncovered)
        pg.evaluate("""(() => { const st = document.querySelector('[data-stage]'), f = document.querySelector('[data-footer]');
          const y = f.offsetTop + st.getBoundingClientRect().top - f.firstElementChild.getBoundingClientRect().top;
          scrollTo(0, Math.min(y - innerHeight / 2 + st.offsetHeight / 2, document.documentElement.scrollHeight)); })()""")
        pg.wait_for_timeout(600)
        box = pg.evaluate("(() => { const r = document.querySelector('[data-stage]').getBoundingClientRect(); return [r.left + r.width * 0.3, r.top + r.height * 0.6]; })()")
        y1 = pg.evaluate("scrollY")
        if touch:  # a finger held on the phone's screen (CDP: Playwright's own touchscreen only taps)
            cdp = pg.context.new_cdp_session(pg)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": box[0], "y": box[1]}]})
            pg.wait_for_timeout(700)
            s = pg.evaluate(STATE)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        else:
            pg.mouse.move(*box)
            pg.mouse.down()
            pg.wait_for_timeout(700)
            s = pg.evaluate(STATE)
            pg.mouse.up()
        pg.wait_for_timeout(300)
        after = pg.evaluate(STATE)
        cl.report(s["throttle"] and s["phase"] == "flying" and s["fuel"] < 5.6 and not after["throttle"] and pg.evaluate("scrollY") == y1,
                  f"{w} px: a {'finger' if touch else 'mouse button'} held down on the game throttles ({s['fuel']:.2f} s of fuel left), letting go stops it; the page stays put")
        pg.close()


SOFT_PILOT = """() => new Promise((done) => {
  const stage = document.querySelector('[data-stage]');
  const key = (type) => stage.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
  const g = 9.8 * 0.4, net = 14 * 0.4 - g; let on = false;
  key('keydown'); key('keyup');
  const tick = () => { const s = window.__lander.state();
    if (s.phase !== 'flying') { if (on) key('keyup'); return done(s.phase); }
    const want = s.vy < -0.45 && (s.vy * s.vy) / (2 * net) >= s.y - 0.35;
    if (want !== on) { key(want ? 'keydown' : 'keyup'); on = want; }
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick); })"""


def check_best(browser, base):
    pg = page_at(browser, base, "/work/")
    to_game(pg)
    pg.evaluate("document.querySelector('[data-stage]').focus({ preventScroll: true })")
    result = pg.evaluate(SOFT_PILOT)
    best = pg.inner_text("[data-best]")
    stored = pg.evaluate("sessionStorage.getItem('landing-best')")
    cl.report(result == "soft" and "m/s" in best and stored is not None, f"a gentle landing is soft and becomes the best of the visit ({result}, {best!r})")
    pg.goto(base + "/about/", wait_until="load")
    pg.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    pg.wait_for_timeout(300)
    cl.report(pg.inner_text("[data-best]") == best, f"the best landing is kept for the visit, on the next page ({pg.inner_text('[data-best]')!r})")
    pg.close()


def check_other_fields(browser, base):
    # the email pop-up: a field in it gets its spaces, and the game stays still
    pg = page_at(browser, base, "/work/")
    to_game(pg)
    pg.click(".back__cta")
    pg.wait_for_function("document.getElementById('email-dialog').open")
    pg.evaluate("""() => { const i = document.createElement('input'); i.id = 'probe'; i.type = 'text';
      document.getElementById('email-dialog').appendChild(i); i.focus(); }""")
    pg.keyboard.type("hello jpl team")
    pg.keyboard.down("Space"); pg.wait_for_timeout(300); pg.keyboard.up("Space")
    v = pg.evaluate("document.getElementById('probe').value")
    cl.report(v == "hello jpl team " and pg.evaluate(STATE)["phase"] == "ready", f"Space typed in the email pop-up's field is a space ({v!r}); the game stays still")
    pg.keyboard.press("Escape")
    pg.close()
    # the CCNA terminal on the cybersecurity page: Space on its tab picks the tab
    pg = page_at(browser, base, "/work/cybersecurity/")
    tab = pg.locator("[data-ios-terminal] [role=tab]").nth(1)
    tab.scroll_into_view_if_needed()
    pg.wait_for_timeout(300)
    tab.focus()
    y = pg.evaluate("scrollY")
    pg.keyboard.press("Space")
    pg.wait_for_timeout(300)
    cl.report(tab.get_attribute("aria-selected") == "true" and pg.evaluate(STATE)["phase"] == "ready" and pg.evaluate("scrollY") == y,
              "Space on the CCNA terminal's tab picks the tab; the game stays still")
    pg.close()


def check_pause(browser, base):
    pg = page_at(browser, base, "/work/")
    to_game(pg)
    pg.evaluate("document.querySelector('[data-stage]').focus({ preventScroll: true })")
    pg.keyboard.down("Space"); pg.wait_for_timeout(250); pg.keyboard.up("Space")
    pg.evaluate("scrollTo(0, 0)")
    pg.wait_for_timeout(400)
    a = pg.evaluate(STATE)
    pg.wait_for_timeout(600)
    b = pg.evaluate(STATE)
    cl.report(not a["running"] and not a["visible"] and a["y"] == b["y"] and a["phase"] == "flying",
              f"off screen the game pauses mid-flight (held at {b['y']:.2f} m) and draws nothing")
    pg.evaluate(END)
    pg.wait_for_timeout(500)
    c = pg.evaluate(STATE)
    cl.report(c["visible"] and (c["y"] < b["y"] or c["phase"] != "flying"), f"back on screen it flies on ({c['y']:.2f} m, {c['phase']})")
    # the name's living colour pauses with the footer
    pg.evaluate("scrollTo(0, 0)")
    pg.wait_for_timeout(300)
    st = pg.evaluate("getComputedStyle(document.querySelector('.back__name')).animationPlayState")
    cl.report(st == "paused", f"off screen the name's living colour is paused ({st})")
    pg.close()


def check_reduced(browser, base):
    pg = page_at(browser, base, "/work/", reduced="reduce")
    to_game(pg)
    pg.wait_for_timeout(500)
    anims = pg.evaluate("document.querySelector('[data-footer]').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length")
    inner = pg.evaluate("getComputedStyle(document.querySelector('.back__inner')).animationName")
    cl.report(anims == 0 and inner == "none", f"reduced motion: nothing in the footer moves by itself ({anims} running, curtain {inner})")
    pg.evaluate("document.querySelector('[data-stage]').focus({ preventScroll: true })")
    pg.keyboard.down("Space"); pg.wait_for_timeout(300); pg.keyboard.up("Space")
    pg.wait_for_timeout(300)
    cl.report(pg.evaluate(STATE)["phase"] in ("flying", "hard"), "reduced motion: the visitor still flies it")
    pg.close()


def check_no_script(browser, base):
    ctx = browser.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.goto(base + "/about/", wait_until="load")
    r = pg.evaluate("""(() => { const f = document.querySelector('[data-footer]');
      return { link: !!f.querySelector('a[href="/work/drone/"]'), shown: [...f.querySelectorAll('[data-js]')].filter((e) => !e.hidden).length,
        email: !!f.querySelector('a[href^="mailto:"]'), pages: f.querySelectorAll('nav a').length }; })()""")
    cl.report(r["link"] and r["shown"] == 0 and r["email"] and r["pages"] >= 8, f"no script: a plain link to the drone page, no dead controls, the contact and pages ({r})")
    ctx.close()


def check_themes(browser, base):
    for w, h in ((1440, 900), (768, 1024), (390, 844)):
        for theme in ("dark", "light"):
            pg = page_at(browser, base, "/", theme, w, h)
            pg.evaluate(END)
            pg.wait_for_timeout(400)
            r = pg.evaluate("""(() => { const f = document.querySelector('[data-footer]'); const cs = getComputedStyle(f);
              const soft = getComputedStyle(f.querySelector('.back__blurb')).color; const n = document.querySelector('.back__name');
              const range = document.createRange(); range.selectNodeContents(n); const t = range.getBoundingClientRect();
              const cta = getComputedStyle(f.querySelector('.back__cta'));
              return { bg: cs.backgroundColor, ink: cs.color, soft, ctaBg: cta.backgroundColor, ctaInk: cta.color,
                nameFits: t.left >= 0 && t.right <= document.documentElement.clientWidth, hscroll: document.documentElement.scrollWidth > innerWidth }; })()""")
            res = lambda c: pg.evaluate(cl.RESOLVE, c)
            bg = res(r["bg"])
            ink, soft, cta = cl.contrast(res(r["ink"]), bg), cl.contrast(res(r["soft"]), bg), cl.contrast(res(r["ctaInk"]), res(r["ctaBg"]))
            cl.report(ink >= 4.5 and soft >= 4.5 and cta >= 4.5 and r["nameFits"] and not r["hscroll"],
                      f"{theme} {w}px: footer text {ink:.1f}:1, soft text {soft:.1f}:1, the button {cta:.1f}:1; the name fits, no sideways scroll")
            pg.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--port", type=int, default=4408)
    args = ap.parse_args()
    proc = None if args.url else cl.serve(args.port)
    base = (args.url or f"http://localhost:{args.port}").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            for check in (check_curtain, check_game_keys, check_game_pointer, check_best, check_other_fields, check_pause,
                          check_reduced, check_no_script, check_themes):
                try:
                    check(browser, base)
                except Exception as error:
                    cl.report(False, f"{check.__name__} raised {str(error).splitlines()[0]}")
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    sys.exit(cl.failures)


if __name__ == "__main__":
    main()
