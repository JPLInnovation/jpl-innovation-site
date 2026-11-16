"""
The F450 in the sky: the drone chapter's simulated flight (/work/drone/, src/components/DroneChapter.astro), in real Chrome.

    npm run build
    python scripts/check-sky.py [--port 4411]          the checks, the screenshots (screenshots/sky/) and the frame times
    python scripts/check-sky.py --still [--port 4411]  makes Classic's still of the flight: public/chapter/drone/flight.webp
                                                       (1600 x 900) and flight-800.webp, from the 3D itself

  - 3D, 1440: the drone flies with the scroll (the HUD's altitude, from the 3D, climbs through the flight beat and is
    back on the pad when scrolling up), the simulation's caption is on screen during the flight, no console errors
  - reduced motion: the chapter is the plain page, and the flight is its still frame
  - the studio's home in 3D still runs its simulated flight (the shared world, src/lib/three/flight-world.ts), no errors
  - screenshots of the flight at several scroll positions, 1440 and 768 in 3D, 390 in Classic (phones)
  - frame times while scrolling through the chapter in 3D (look-fps.py measures Classic only)

Each check prints PASS or FAIL; the exit code is the number of failures.
"""

import argparse
import importlib.util
import io
import os
import statistics
import subprocess

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)

THREE_D = "localStorage.setItem('experience', '3d');"
SHOTS = "screenshots/sky"
# Where the page is, in the chapter's stops (one screen each): scroll there.
GO = """(at) => { const track = document.querySelector('.dch-track'); const pin = document.querySelector('.dch-pin');
  scrollTo({ top: track.getBoundingClientRect().top + scrollY + at * pin.offsetHeight, behavior: 'instant' }); }"""
TELEMETRY = "() => Object.fromEntries([...document.querySelectorAll('[data-tm]')].map((e) => [e.dataset.tm, e.dataset.tm === 'signal' ? e.dataset.bars : e.textContent]))"
VISIBLE = """(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect();
  let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
  return { inView: r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, opacity: o, text: el.textContent.trim() }; }"""
MEASURE = """async () => { const t = []; let last = performance.now(); const t0 = last; const pin = document.querySelector('.dch-pin');
  const step = pin.offsetHeight * 10 / 1500;  /* the whole chapter in about six seconds at 240 Hz */
  let y = scrollY;
  await new Promise(r => { function f(now) { t.push(now - last); last = now; y += step; scrollTo(0, y); if (now - t0 < 6000) requestAnimationFrame(f); else r(); } requestAnimationFrame(f); });
  return t.slice(1); }"""


def open_page(browser, base, path, width, height=900, theme="dark", extra=THREE_D, reduced=False, errors=None):
    page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1, reduced_motion="reduce" if reduced else "no-preference")
    if errors is not None:
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script(cl.INIT % {"theme": theme, "extra": extra})
    page.goto(base + path, wait_until="load")
    page.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000)
    return page


def live(page):
    try:
        page.wait_for_function("document.querySelector('.dch')?.hasAttribute('data-live')", timeout=60000)
        return True
    except Exception:
        return False


def at(page, stop, wait=600):
    """Scroll to `stop`, then wait until the stage has stopped drawing (the camera has settled: it draws only while
    something moves). The machine may be busy, so this waits on the drawing, not on a fixed time."""
    page.evaluate(GO, stop)
    page.wait_for_timeout(wait)
    last, still = -1, 0
    for _ in range(40):
        n = page.evaluate("window.__stage?.[0]?.renders ?? 0")
        still = still + 1 if n == last else 0
        last = n
        if still >= 3:
            break
        page.wait_for_timeout(200)


def check_flight(browser, base):
    errors = []
    page = open_page(browser, base, "/work/drone/", 1440, errors=errors)
    ok = live(page)
    cl.report(ok, "3D chapter: started (data-live)")
    if not ok:
        page.close()
        return
    page.wait_for_timeout(800)
    seen = {}
    for stop in (2, 2.5, 3, 3.5, 4):
        at(page, stop)
        seen[stop] = page.evaluate(TELEMETRY)
    alt = {k: float(v["altitude"]) for k, v in seen.items()}
    cl.report(alt[2] < 0.05 and alt[3] > 5 and alt[2.5] > 0.5, f"flight: off the pad and climbing with the scroll (altitude {alt})")
    cl.report(float(seen[3]["speed"]) > 1 and float(seen[4]["speed"]) < 0.5, f"flight: fast mid-flight, slowed to a hover at the parts ({seen[3]['speed']} -> {seen[4]['speed']} m/s)")
    # back up: the same places again
    back = {}
    for stop in (3.5, 3, 2):
        at(page, stop)
        back[stop] = float(page.evaluate(TELEMETRY)["altitude"])
    cl.report(all(abs(back[k] - alt[k]) < 0.15 for k in back), f"flight: scrolling up flies it back (altitude {back})")
    at(page, 3)
    cap = page.evaluate(VISIBLE, "[data-sim-caption]")
    cl.report(bool(cap) and cap["inView"] and cap["opacity"] > 0.9 and "Simulation" in cap["text"], f"flight: the simulation's caption is on screen ({cap})")
    words = page.evaluate(VISIBLE, "#flight h2")
    cl.report(bool(words) and words["opacity"] > 0.9, f"flight: its words show at its stop ({words and words['text']!r}, opacity {words and round(words['opacity'], 2)})")
    at(page, 2.05, 1800)
    reveal = page.evaluate("getComputedStyle(document.querySelector('#reveal')).opacity")
    cl.report(float(reveal) > 0.9, f"reveal: still at its stop (2) and showing (opacity {reveal})")
    at(page, 6, 1800)
    label = page.evaluate("[...document.querySelectorAll('.stage-label')].filter((e) => e.hasAttribute('data-on')).map((e) => e.textContent)")
    cl.report(label == ["Motors and props"], f"parts: the close-ups keep their labels (stop 6: {label})")
    cl.report(not errors, f"3D chapter: no console errors {errors[:3]}")
    page.close()


def check_reduced(browser, base):
    page = open_page(browser, base, "/work/drone/", 1440, reduced=True)
    page.wait_for_timeout(500)
    read = page.evaluate("document.querySelector('.dch').hasAttribute('data-read')")
    page.evaluate("document.querySelector('#flight').scrollIntoView({ block: 'center' })")
    page.wait_for_timeout(800)
    img = page.evaluate("""(() => { const i = document.querySelector('#flight .dch-flight-still .lit-on'); if (!i) return null;
      const r = i.getBoundingClientRect(); return { loaded: i.complete && i.naturalWidth > 0, opacity: getComputedStyle(i).opacity, inView: r.top < innerHeight && r.bottom > 0, alt: i.alt }; })()""")
    cl.report(read and bool(img) and img["loaded"] and img["inView"] and img["opacity"] == "1", f"reduced motion: the plain page, the flight as its still ({read}, {img})")
    os.makedirs(SHOTS, exist_ok=True)
    page.screenshot(path=f"{SHOTS}/reduced-1440-flight.png")
    page.close()


def check_studio(browser, base):
    errors = []
    warnings = []
    page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page.on("console", lambda m: (errors if m.type == "error" else warnings).append(m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script("localStorage.setItem('experience', '3d'); localStorage.setItem('theme', 'dark'); localStorage.setItem('hook-seen', '1');")
    page.goto(base + "/?studio=capture", wait_until="networkidle")
    page.keyboard.press("Escape")
    try:
        page.wait_for_function("() => window.__studio", timeout=120000)
        up = True
    except Exception:
        up = False
    cl.report(up, "studio: the home's 3D is up")
    if up:
        page.wait_for_timeout(3000)
        ids = page.evaluate("() => window.__studio.ids")
        before = page.evaluate("window.__stage[0].renders")
        for name in ("test", "simIn", "simFly", "simLand", "web"):
            page.evaluate(f"() => window.__studio.go({ids.index(name)})")
            page.wait_for_timeout(5000 if name == "test" else 2200)
            page.screenshot(path=f"{SHOTS}/studio-{name}.png")
        after = page.evaluate("window.__stage[0].renders")
        bad = [w for w in warnings if "simulated flight" in w]
        cl.report(after > before and not bad, f"studio: its simulated flight runs (frames {before} -> {after}, {bad[:1]})")
    cl.report(not errors, f"studio: no console errors {errors[:3]}")
    page.close()


def screenshots(browser, base):
    os.makedirs(SHOTS, exist_ok=True)
    for width, height in ((1440, 900), (768, 1024)):
        for theme in ("dark", "light"):
            page = open_page(browser, base, "/work/drone/", width, height, theme)
            if not live(page):
                cl.report(False, f"screenshots {width} {theme}: the 3D did not start")
                page.close()
                continue
            page.wait_for_timeout(600)
            stops = (0, 1, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9) if (width == 1440 and theme == "dark") else (0, 2, 3, 4, 6)
            for stop in stops:
                at(page, stop)
                page.screenshot(path=f"{SHOTS}/3d-{width}-{theme}-{stop}.png")
            page.close()
    for theme in ("dark", "light"):
        page = open_page(browser, base, "/work/drone/", 390, 844, theme)
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SHOTS}/classic-390-{theme}-top.png")
        page.evaluate("document.querySelector('#flight').scrollIntoView({ block: 'start' })")
        page.wait_for_timeout(900)
        page.screenshot(path=f"{SHOTS}/classic-390-{theme}-flight.png")
        page.close()
    page = open_page(browser, base, "/work/drone/", 1440, 900, "light", extra="")
    page.evaluate("document.querySelector('#flight').scrollIntoView({ block: 'start' })")
    page.wait_for_timeout(900)
    page.screenshot(path=f"{SHOTS}/classic-1440-light-flight.png")
    page.close()


def frame_times(browser, base):
    for width, height in ((1440, 900), (2560, 1440)):
        for run in range(2):
            page = open_page(browser, base, "/work/drone/", width, height)
            if not live(page):
                print(f"frames {width}: the 3D did not start")
                page.close()
                continue
            page.wait_for_timeout(1500)
            t = page.evaluate(MEASURE)
            late = t[len(t) // 6 :]
            stage = page.evaluate("window.__stage.map((s) => ({ tier: s.tier, scale: s.scale, ratio: s.pixelRatio, calls: s.calls, tris: s.triangles }))")
            print(f"frames {width}px run {run + 1}: median {statistics.median(t):4.1f} ms  worst-after-1s {max(late):5.1f} ms  over25 {sum(x > 25 for x in late)} of {len(late)}  {stage}")
            page.close()


def still(browser, base):
    """Classic's still of the flight, from the 3D: the words, HUD and map hidden, the stage alone."""
    from PIL import Image

    page = open_page(browser, base, "/work/drone/", 1600, 900)
    if not live(page):
        raise SystemExit("the 3D did not start")
    page.add_style_tag(content=".dch-panels, .dch-hud, .dch-telemetry, .dch-map, .dch-frame, .dch-veil, .site-header, header, .stage-label, .dch-skip { visibility: hidden !important; }")
    page.wait_for_timeout(800)
    at(page, 3.08, 2500)
    png = page.locator(".dch-pin").screenshot()
    image = Image.open(io.BytesIO(png)).convert("RGB")
    out = os.path.join(ROOT, "public/chapter/drone")
    image = image.resize((1600, 900), Image.LANCZOS)  # (the window's scrollbar takes a few pixels off the width)
    image.save(os.path.join(out, "flight.webp"), "WEBP", quality=78, method=6)
    image.resize((800, 450), Image.LANCZOS).save(os.path.join(out, "flight-800.webp"), "WEBP", quality=78, method=6)
    for name in ("flight.webp", "flight-800.webp"):
        print(name, os.path.getsize(os.path.join(out, name)) // 1024, "KB")
    page.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4411)
    ap.add_argument("--still", action="store_true", help="make Classic's still of the flight, then stop")
    ap.add_argument("--no-fps", action="store_true")
    args = ap.parse_args()
    os.chdir(ROOT)
    proc = cl.serve(args.port)
    base = f"http://localhost:{args.port}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            if args.still:
                still(browser, base)
            else:
                check_flight(browser, base)
                check_reduced(browser, base)
                check_studio(browser, base)
                screenshots(browser, base)
                if not args.no_fps:
                    frame_times(browser, base)
            browser.close()
    finally:
        subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    raise SystemExit(cl.failures)


if __name__ == "__main__":
    main()
