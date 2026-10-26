"""
The studio's simulated flight clip (the "test" scene's wall screen, src/lib/studio/build-bench.ts):
public/studio/sim/flight-sim.mp4 (960 x 540, 5 s, 30 fps, a keyframe every 6 frames so the scroll can scrub it) and
flight-sim-poster.webp. It is a SIMULATION of the 3D model, not footage: the drone has not flown. Every frame carries
"SIMULATION · 3D model · not flown yet".

How: scripts/sim-flight.astro is copied into src/pages for the run (and removed after), the dev server serves it, and
Playwright asks it for each frame (the real CAD from f450-cad.bin, the drone chapter's sky and ridges, a drawn town:
no real place). The label is drawn on with Pillow, and ffmpeg encodes.

    npx astro dev --port 4400          (in another terminal)
    python scripts/sim-flight.py

Needs Python Playwright, Pillow and ffmpeg.
"""

import base64
import pathlib
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "src" / "pages" / "dev-sim.astro"
OUT = ROOT / "public" / "studio" / "sim"
GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
LABEL = "SIMULATION"
SUB = "3D model · not flown yet"
CORNER = "JPL INNOVATION · F450 4G"


def font(bold: bool, size: int):
    for name in (["DejaVuSansMono-Bold.ttf"] if bold else ["DejaVuSansMono.ttf"]):
        for folder in ("/usr/share/fonts/truetype/dejavu", "C:/Windows/Fonts"):
            path = pathlib.Path(folder) / name
            if path.exists():
                return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def label(frame: Image.Image) -> Image.Image:
    image = frame.convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle((22, 20, 394, 82), 8, fill=(8, 12, 24, 170), outline=(255, 194, 14, 230), width=2)
    d.ellipse((36, 38, 48, 50), fill=(255, 194, 14, 255))
    d.text((58, 30), LABEL, font=font(True, 22), fill=(255, 214, 90, 255))
    d.text((58, 57), SUB, font=font(False, 15), fill=(225, 232, 245, 235))
    d.text((image.width - 22, image.height - 22), CORNER, font=font(False, 15), fill=(225, 232, 245, 200), anchor="rs")
    return Image.alpha_composite(image, overlay).convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "scripts" / "sim-flight.astro", PAGE)
    try:
        with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
            frames = pathlib.Path(tmp)
            browser = p.chromium.launch(args=GL_ARGS)
            page = browser.new_page(viewport={"width": 960, "height": 540})
            page.goto("http://localhost:4400/dev-sim", wait_until="load")
            page.wait_for_function("window.ready", timeout=180000)
            for i in range(page.evaluate("window.FRAMES")):
                data = page.evaluate(f"window.frame({i})")
                raw = frames / "raw.png"
                raw.write_bytes(base64.b64decode(data.split(",")[1]))
                labelled = label(Image.open(raw))
                labelled.save(frames / f"f{i:04d}.png")
                if i == 0:
                    labelled.save(OUT / "flight-sim-poster.webp", quality=72)
            browser.close()
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", str(frames / "f%04d.png"), "-c:v", "libx264", "-preset", "slow",
                 "-crf", "26", "-g", "6", "-keyint_min", "6", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(OUT / "flight-sim.mp4")],
                check=True,
            )
    finally:
        PAGE.unlink(missing_ok=True)
    print("Wrote", OUT / "flight-sim.mp4", "and", OUT / "flight-sim-poster.webp")


if __name__ == "__main__":
    main()
