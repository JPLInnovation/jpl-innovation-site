"""
The 3D studio's checks (the home page in 3D: src/components/Studio.astro, src/lib/studio/), in real Chrome on the GPU.

    npm run build
    python scripts/check-studio.py --port 4413          starts `astro preview` on that port, stops it after
    python scripts/check-studio.py --url URL            or checks a server that is already running
    python scripts/check-studio.py --port 4413 --shots  also saves every scene and every open device, both themes, at
                                                        1440 x 900, under screenshots/studio/

Checks: each device you can enter (the desk monitor, the test bench's laptop, the rack, the robot's cart) opens from
its button with the keyboard and from a click on the device in the room; what opens is real HTML with something to
focus; Back and Escape close it and focus returns to the button; no console errors; frame times while the camera moves
between scenes.
"""

import argparse
import importlib.util
import os
import statistics
import subprocess

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("cl", os.path.join(ROOT, "scripts", "check-look.py"))
cl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cl)

SHOTS = os.path.join(ROOT, "screenshots", "studio")
INIT = "try { localStorage.setItem('experience', '3d'); localStorage.setItem('hook-seen', '1'); localStorage.setItem('theme', '%s'); ['jpl','frc','drone'].forEach((k) => sessionStorage.setItem(k + '-intro-seen', '1')); } catch (e) {}"
# Each device: its scene, where it is on a 1440 x 900 window at that scene (for the click), and what must be inside.
DEVICES = {
    "research": {"at": (720, 420), "inside": "table [data-register-toggle]"},
    "web": {"at": (360, 420), "inside": "[data-flight-toggle]"},
    "networks": {"at": (950, 420), "inside": "#ios-command, [data-ios-terminal] [role=tab]"},
    "robotics": {"at": (980, 560), "inside": "input[type=range][data-explode]"},
}


def open_studio(browser, base, theme="dark", errors=None):
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    if errors is not None:
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.add_init_script(INIT % theme)
    page.goto(base + "/", wait_until="load")
    page.wait_for_function("document.querySelector('[data-studio][data-live]')", timeout=60000)
    page.wait_for_timeout(4500)  # the opening push-in and the lamp
    return page


def go(page, scene, wait=2200):
    i = page.evaluate(f"JSON.parse(document.querySelector('[data-studio-shots]').textContent).findIndex(s => s.id === '{scene}')")
    page.evaluate(f"scrollTo({{top: document.querySelector('.studio-track').getBoundingClientRect().top + scrollY + {i} * innerHeight, behavior: 'instant'}})")
    page.wait_for_timeout(wait)


def is_open(page, device):
    return page.evaluate(f"!!document.querySelector('dialog[data-device=\"{device}\"]')?.open")


def wait_open(page, device):
    try:
        page.wait_for_function(f"document.querySelector('dialog[data-device=\"{device}\"]')?.hasAttribute('data-on')", timeout=6000)
        return True
    except Exception:
        return False


def wait_closed(page):
    try:
        page.wait_for_function("!document.querySelector('[data-studio][data-entering]')", timeout=6000)
        return True
    except Exception:
        return False


def check_devices(browser, base, shots):
    errors = []
    page = open_studio(browser, base, errors=errors)
    for device, d in DEVICES.items():
        go(page, device)
        # Keyboard: Tab to the button (focus it), Enter opens; Escape closes, focus returns to it.
        button = page.locator(f"[data-enter='{device}']")
        button.focus()
        page.keyboard.press("Enter")
        opened = wait_open(page, device)
        page.wait_for_timeout(400)
        inside = page.locator(f"dialog[data-device='{device}'] {d['inside']}").count()
        focus_in = page.evaluate(f"document.querySelector('dialog[data-device=\"{device}\"]').contains(document.activeElement)")
        focusable = page.evaluate(
            f"[...document.querySelectorAll('dialog[data-device=\"{device}\"] a[href], dialog[data-device=\"{device}\"] button, dialog[data-device=\"{device}\"] input')].filter(e => e.offsetParent !== null || e.getClientRects().length).length"
        )
        cl.report(opened and inside > 0 and focus_in and focusable >= 2, f"{device}: Enter on its button opens it: real HTML inside ({inside} x {d['inside']}), focus inside ({focus_in}), {focusable} things to focus")
        if device == "web":
            page.wait_for_timeout(1500)
            alt = page.locator("[data-tel=altitude]").inner_text()
            cl.report(alt not in ("", "–"), f"web: the ground station reads the simulated flight (altitude {alt} m)")
        if device == "robotics":
            page.locator("[data-explode]").fill("100")
            page.wait_for_timeout(1200)
        if shots:
            page.screenshot(path=os.path.join(SHOTS, f"device-dark-{device}.png"))
        page.keyboard.press("Escape")
        closed = wait_closed(page) and not is_open(page, device)
        back_focus = page.evaluate(f"document.activeElement?.dataset?.enter")
        cl.report(closed and back_focus == device, f"{device}: Escape closes it, focus back on its button ({back_focus})")
        # Pointer: a click on the device in the room opens it; Back closes it.
        page.mouse.move(d["at"][0], d["at"][1])
        page.wait_for_timeout(300)
        page.mouse.click(d["at"][0], d["at"][1])
        opened = wait_open(page, device)
        page.wait_for_timeout(300)
        page.locator(f"dialog[data-device='{device}'] [data-device-back]").click()
        closed = wait_closed(page) and not is_open(page, device)
        back_focus = page.evaluate("document.activeElement?.dataset?.enter")
        cl.report(opened and closed and back_focus == device, f"{device}: a click on it in the room opens it, Back closes it, focus on its button ({back_focus})")
    # A small delight: arm the F450 on the drones' bench (props spin up; it never lifts off).
    go(page, "drones")
    page.locator("[data-arm]").click()
    page.wait_for_timeout(1500)
    if shots:
        page.screenshot(path=os.path.join(SHOTS, "delight-dark-armed.png"))
    cl.report(page.locator("[data-arm]").count() == 1, "drones: the F450 can be armed from its button")
    cl.report(not errors, f"devices: no console errors {errors[:3]}")
    page.close()


def check_frames(browser, base):
    """Frame times while the camera travels: a smooth scroll through the first scenes, then across the room."""
    page = open_studio(browser, base)
    times = page.evaluate(
        """async () => {
          const track = document.querySelector('.studio-track').getBoundingClientRect().top + scrollY;
          const times = [];
          let last = performance.now();
          let on = true;
          const tick = (t) => { times.push(t - last); last = t; if (on) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          for (const scene of [1, 2, 3, 9, 10, 11, 12, 13, 14, 15]) {
            scrollTo({ top: track + scene * innerHeight, behavior: 'smooth' });
            await new Promise((r) => setTimeout(r, 1300));
          }
          on = false;
          return times.slice(5);
        }"""
    )
    times.sort()
    median = statistics.median(times)
    p95 = times[int(len(times) * 0.95)]
    slow = sum(1 for t in times if t > 25) / len(times)
    cl.report(median < 8 and slow < 0.05, f"frames while moving: median {median:.2f} ms, p95 {p95:.2f} ms, {slow * 100:.1f}% over 25 ms ({len(times)} frames)")
    page.close()


def shoot(browser, base):
    os.makedirs(SHOTS, exist_ok=True)
    for theme in ("dark", "light"):
        page = open_studio(browser, base, theme)
        ids = page.evaluate("JSON.parse(document.querySelector('[data-studio-shots]').textContent).map(s => s.id)")
        for i, scene in enumerate(ids):
            go(page, scene, 3000)
            page.screenshot(path=os.path.join(SHOTS, f"{theme}-{i:02d}-{scene}.png"))
        if theme == "light":
            for device in DEVICES:
                go(page, device)
                page.locator(f"[data-enter='{device}']").click()
                wait_open(page, device)
                page.wait_for_timeout(1500)
                page.screenshot(path=os.path.join(SHOTS, f"device-light-{device}.png"))
                page.keyboard.press("Escape")
                wait_closed(page)
        page.close()
    print("screenshots in", SHOTS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url")
    parser.add_argument("--port", type=int, default=4413)
    parser.add_argument("--shots", action="store_true")
    args = parser.parse_args()
    proc = None if args.url else cl.serve(args.port)
    base = (args.url or f"http://localhost:{args.port}").rstrip("/")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome", headless=False)
            if args.shots:
                os.makedirs(SHOTS, exist_ok=True)
            check_devices(browser, base, args.shots)
            check_frames(browser, base)
            if args.shots:
                shoot(browser, base)
            browser.close()
    finally:
        if proc:
            subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{cl.failures} failure(s)")
    raise SystemExit(cl.failures)


if __name__ == "__main__":
    main()
