"""
Frame times while scrolling the built site (real Chrome, real GPU); starts and stops its own preview.

    npm run build
    python scripts/look-fps.py [--port 4391] work/drone/ about/      paths without a leading slash

Prints, per width (1440 and 2560) and theme: the median frame time, the worst frame after the first second and how
many frames took over 25 ms. On the RTX at 240 Hz the bar is a median near 4.2 ms and no frame over 25 ms.
Other GPU work running at the same time (another Chrome, a build) makes the numbers noisy.
"""
import argparse, os, subprocess, sys, time, urllib.request, statistics
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=4391)
ap.add_argument("paths", nargs="*", default=["work/", "about/"])
args = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
paths, PORT = args.paths, args.port
MEASURE = """async () => { const t = []; let last = performance.now(); const t0 = last; let y = 0;
  await new Promise(r => { function f(now) { t.push(now - last); last = now; y += 4; scrollTo(0, y); if (now - t0 < 3000) requestAnimationFrame(f); else r(); } requestAnimationFrame(f); });
  return t.slice(1); }"""
proc = subprocess.Popen(f"npx astro preview --port {PORT}", shell=True, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try: urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=1); break
    except Exception: time.sleep(0.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=False)
        for w, h in [(1440, 900), (2560, 1440)]:
            for theme in ("dark", "light"):
                for path in paths:
                    pg = b.new_page(viewport={"width": w, "height": h})
                    pg.add_init_script(f"try{{localStorage.setItem('experience','classic');localStorage.setItem('theme','{theme}');['jpl','frc','drone'].forEach(k=>sessionStorage.setItem(k+'-intro-seen','1'))}}catch(e){{}}")
                    pg.goto(f"http://localhost:{PORT}/" + path, wait_until="load")
                    pg.wait_for_function("!document.documentElement.classList.contains('splash')", timeout=15000); pg.wait_for_timeout(1500)
                    t = pg.evaluate(MEASURE); late = t[len(t)//3:]
                    print(f"{w}px {theme:5s} {path:8s} median {statistics.median(t):4.1f} ms  worst-after-1s {max(late):5.1f} ms  over25 {sum(x>25 for x in late)}  scale {pg.evaluate('window.__field.scale'):.2f}")
                    pg.close()
        b.close()
finally:
    subprocess.run(f"taskkill /PID {proc.pid} /T /F", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
