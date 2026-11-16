"""
The KitBot on the 2026 field (the FRC chapter's 3D, src/components/FrcChapter.astro), checked in real Chrome on the
real GPU. Starts and stops its own preview of the build (run it from the repository's folder).

    npm run build
    python scripts/check-field.py [--port 4412] [--shots] [--fps]

  - the field (its carpet and lines) is drawn under the robot: the floor below the robot is the carpet's grey, not the
    page's near-black, on the prologue and on a part-by-part stop
  - the robot drives along its path with the scroll, and back: its place on the field changes by over a metre between
    the prologue and the stakes, and scrolling back up puts it where it was
  - the shot: FUEL is in the air on the stakes, and none on the reveal
  - the labelled close-ups still come in order: on each part-by-part stop, its own label is the one showing
  - with reduced motion the chapter is the plain page, with the still of the KitBot on the field (no 3D)
  - no console errors, in 3D or plain
  --shots  screenshots at several scroll positions at 1440 and 390 (screenshots/field/, git-ignored)
  --fps    frame times while scrolling through the chapter in 3D (the machine's other work makes them noisy)
"""
import argparse, importlib.util, os, statistics, subprocess, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)
SHOTS = os.path.join(ROOT, "screenshots", "field")
THREE_D = "localStorage.setItem('experience', '3d');"

errors = []


def watch(page, tag):
    page.on("console", lambda m: m.type == "error" and errors.append(f"{tag}: {m.text}"))
    page.on("pageerror", lambda e: errors.append(f"{tag}: {e}"))


def open_frc(browser, width, height, extra=THREE_D, reduced=False):
    ctx = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce" if reduced else "no-preference")
    page = ctx.new_page()
    watch(page, f"{width}px{' reduced' if reduced else ''}")
    page.add_init_script(cl.INIT % {"theme": "dark", "extra": extra})
    page.goto(f"{BASE}/work/frc/", wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    return ctx, page


def to_stop(page, n, wait=1400):
    """Scroll so the camera is at stop n (0 = the prologue), and let the camera's spring settle."""
    page.evaluate(f"(() => {{ const t = document.querySelector('#kitbot .kch-track'); scrollTo(0, t.getBoundingClientRect().top + scrollY + {n} * document.querySelector('#kitbot .kch-pin').offsetHeight); }})()")
    page.wait_for_timeout(wait)


def field_state(page):
    return page.evaluate("window.__kitbotField && { ...window.__kitbotField }")


def floor_colour(page, path):
    """The median colour of a band low in the right half of the window (the floor below the robot)."""
    from PIL import Image
    page.screenshot(path=path)
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = [im.getpixel((x, int(h * 0.94))) for x in range(int(w * 0.5), int(w * 0.95), 6)]
    return [int(statistics.median(p[i] for p in px)) for i in range(3)]


def is_carpet(c):
    return max(c) - min(c) < 18 and 28 <= sum(c) / 3 <= 130


def check_3d(browser, shots):
    ctx, page = open_frc(browser, 1440, 900)
    to_stop(page, -1.5, 600)
    try:
        page.wait_for_function("document.querySelector('#kitbot').hasAttribute('data-live')", timeout=60000)
        cl.report(True, "the chapter starts in 3D")
    except Exception:
        cl.report(False, "the chapter starts in 3D")
        ctx.close()
        return
    os.makedirs(SHOTS, exist_ok=True)
    to_stop(page, 0, 2500)
    at0 = field_state(page)
    c0 = floor_colour(page, os.path.join(SHOTS, "1440-stop-0.png"))
    cl.report(at0 is not None and is_carpet(c0), f"the carpet is drawn under the robot on the prologue (floor {c0})")
    to_stop(page, 0.5)
    half = field_state(page)
    to_stop(page, 1)
    at1 = field_state(page)
    moved = ((at1["x"] - at0["x"]) ** 2 + (at1["z"] - at0["z"]) ** 2) ** 0.5
    cl.report(moved > 1.0, f"the robot drives along its path with the scroll ({moved:.2f} m from the prologue to the stakes)")
    cl.report(at1["balls"] >= 3, f"on the stakes a stream of FUEL is in the air ({at1['balls']} balls)")
    page.screenshot(path=os.path.join(SHOTS, "1440-stop-1.png"))
    to_stop(page, 0.5)
    back = field_state(page)
    same = abs(back["x"] - half["x"]) < 0.01 and abs(back["z"] - half["z"]) < 0.01 and abs(back["heading"] - half["heading"]) < 0.01
    cl.report(same, f"scrolling back up drives it back ({back['x']:.3f}, {back['z']:.3f} vs {half['x']:.3f}, {half['z']:.3f})")
    to_stop(page, 0)
    home = field_state(page)
    cl.report(abs(home["x"] - at0["x"]) < 0.01 and abs(home["z"] - at0["z"]) < 0.01, "and back to its start on the prologue")
    to_stop(page, 2)
    at2 = field_state(page)
    cl.report(at2["balls"] == 0 and abs(at2["heading"] - at1["heading"]) > 1.0, f"on the reveal the shot is done and it has turned ({at2['heading'] - at1['heading']:.2f} rad)")
    if shots:
        page.screenshot(path=os.path.join(SHOTS, "1440-stop-2.png"))
    titles = page.evaluate("JSON.parse(document.querySelector('#kitbot').dataset.titles)")
    order = []
    for n in range(3, len(titles)):
        to_stop(page, n, 1500)
        shown = page.evaluate("[...document.querySelectorAll('#kitbot .stage-label[data-on]')].map(e => e.textContent)")
        order.append(shown == [titles[n]])
        if shown != [titles[n]]:
            print(f"     stop {n}: expected {titles[n]!r}, showing {shown}")
        if shots or n == 7:
            path = os.path.join(SHOTS, f"1440-stop-{n}.png")
            if n == 7:
                c = floor_colour(page, path)
                cl.report(is_carpet(c) or sum(c) / 3 > 20, f"the field is still there on a part-by-part stop (floor {c})")
            else:
                page.screenshot(path=path)
    cl.report(all(order), f"the labelled close-ups come in order ({sum(order)} of {len(order)} stops show their own label)")
    if shots:
        to_stop(page, 0.7)
        page.screenshot(path=os.path.join(SHOTS, "1440-stop-0.7.png"))
        to_stop(page, 1.5)
        page.screenshot(path=os.path.join(SHOTS, "1440-stop-1.5.png"))
    ctx.close()


def more_shots(browser):
    """768 (3D, portrait: the words at the bottom) and the light theme (the chapter stays night in both)."""
    for (w, h, theme, stops) in ((768, 1024, "dark", (0, 1, 2, 6)), (1440, 900, "light", (1, 2))):
        ctx = browser.new_context(viewport={"width": w, "height": h})
        page = ctx.new_page()
        watch(page, f"{w}px {theme}")
        page.add_init_script(cl.INIT % {"theme": theme, "extra": THREE_D})
        page.goto(f"{BASE}/work/frc/", wait_until="load")
        page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
        to_stop(page, -1.5, 600)
        page.wait_for_function("document.querySelector('#kitbot').hasAttribute('data-live')", timeout=60000)
        for n in stops:
            to_stop(page, n, 1800)
            page.screenshot(path=os.path.join(SHOTS, f"{w}-{theme}-stop-{n}.png"))
        ctx.close()


def check_plain(browser, shots):
    ctx, page = open_frc(browser, 1440, 900, reduced=True)
    page.evaluate("document.querySelector('#kitbot').scrollIntoView()")
    page.wait_for_timeout(1500)
    state = page.evaluate("""(() => { const k = document.querySelector('#kitbot'); const img = k.querySelector('.kch-field-still');
        return [k.hasAttribute('data-read'), !!img && img.complete && img.naturalWidth > 0 && getComputedStyle(img).display !== 'none', !!window.__kitbotField]; })()""")
    cl.report(state[0] and state[1] and not state[2], f"reduced motion: the plain page with a still of the KitBot on the field, no 3D ({state})")
    if shots:
        page.screenshot(path=os.path.join(SHOTS, "1440-reduced.png"))
    ctx.close()
    ctx, page = open_frc(browser, 390, 844)
    page.evaluate("document.querySelector('#kitbot').scrollIntoView()")
    page.wait_for_timeout(1500)
    phone = page.evaluate("[document.querySelector('#kitbot').hasAttribute('data-read'), document.documentElement.scrollWidth - innerWidth]")
    cl.report(phone[0] and phone[1] <= 0, f"390 px: the plain page, nothing scrolls sideways ({phone})")
    if shots:
        for i, frac in enumerate((0, 0.25, 0.5, 0.75)):
            page.evaluate(f"(() => {{ const k = document.querySelector('#kitbot'); scrollTo(0, k.getBoundingClientRect().top + scrollY + k.offsetHeight * {frac}); }})()")
            page.wait_for_timeout(700)
            page.screenshot(path=os.path.join(SHOTS, f"390-{i}.png"))
    ctx.close()


FPS = """async (track) => { const t = []; const el = document.querySelector('#kitbot .kch-track');
  const top = el.getBoundingClientRect().top + scrollY; const end = top + el.offsetHeight - innerHeight; let y = top - innerHeight;
  let last = performance.now();
  await new Promise(r => { function f(now) { t.push(now - last); last = now; y += 14; scrollTo(0, y); if (y < end) requestAnimationFrame(f); else r(); } requestAnimationFrame(f); });
  return t.slice(1); }"""


def check_fps(browser):
    for w, h in ((1440, 900), (2560, 1440)):
        ctx, page = open_frc(browser, w, h)
        to_stop(page, -1.5, 600)
        page.wait_for_function("document.querySelector('#kitbot').hasAttribute('data-live')", timeout=60000)
        to_stop(page, -1, 2500)
        runs = []
        for _ in range(2):  # the machine is busy: every run twice
            t = page.evaluate(FPS)
            late = t[len(t) // 4:]
            runs.append((statistics.median(t), max(late), sum(x > 25 for x in late), len(t)))
            to_stop(page, -1, 1500)
        stage = page.evaluate("(window.__stage || []).map(s => ({ tier: s.tier, scale: s.scale, frameMs: s.frameMs, calls: s.calls, triangles: s.triangles }))")
        for m, worst, over, n in runs:
            print(f"     {w}px 3D work/frc/ KitBot chapter: median {m:4.1f} ms  worst {worst:5.1f} ms  over 25 ms {over} of {n}")
        print(f"     stages: {stage}")
        ctx.close()


def main():
    global BASE
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4412)
    ap.add_argument("--shots", action="store_true")
    ap.add_argument("--fps", action="store_true")
    args = ap.parse_args()
    proc = cl.serve(args.port)
    BASE = f"http://localhost:{args.port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False, args=["--ignore-gpu-blocklist"])
            check_3d(browser, args.shots)
            check_plain(browser, args.shots)
            if args.shots:
                more_shots(browser)
            if args.fps:
                check_fps(browser)
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cl.report(not errors, "no console errors" + (f": {errors[:5]}" if errors else ""))
    print(f"{cl.failures} failure(s)")
    sys.exit(cl.failures)


if __name__ == "__main__":
    main()
