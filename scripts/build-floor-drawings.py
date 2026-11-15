"""
The living blueprint's pictures (docs/superpowers/plans/2026-11-15-redesign-phase2-home-hook-footer.md, Task 1):

  public/look/drawings/{name}.png   a vector drawing traced shape by shape into a 2048 px canvas whose colour is each
                                    point's draw order (R high, G mid, B low byte of 0..1 in 24 bits), alpha its line.
                                    The field's shader draws the pixels whose order is under the scroll's reveal, so a
                                    pen seems to draft the drawing as you scroll.
  public/look/parts-atlas.webp      the real parts (cut-out renders of the drone's and the robot's parts) on a 4 x 4
                                    grid of 512 px cells, for the glass tiles floating over the floor.

    python scripts/build-floor-drawings.py          (real Chrome through Playwright; writes the files above)
"""

import base64

import pathlib

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "look"
DRAWINGS = {
    "f450": ROOT / "public/assets/f450-drone.svg",
    "mini": ROOT / "public/assets/mini-drone.svg",
    "network": ROOT / "public/assets/cybersecurity.svg",
    "badge": ROOT / "src/assets/intro/jpl-badge.svg",
    "lifetime": ROOT / "public/assets/lifetime.svg",
}
PARTS = [
    "drone/overview", "drone/motors", "drone/flight-controller", "drone/camera", "drone/power",
    "robot/drivetrain", "robot/electronics", "robot/hopper", "robot/indexer", "robot/intake",
    "robot/krakens", "robot/odometry", "robot/shooter", "robot/vision",
]
SIZE = 2048

TRACE = r"""async ([svgText, size]) => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  const host = document.createElement('div');
  host.innerHTML = svgText;
  document.body.appendChild(host);
  const svg = host.querySelector('svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
  const box = svg.getBoundingClientRect();
  const shapes = [...svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon')].filter((el) => {
    if (el.closest('defs, clipPath, mask, pattern, symbol')) return false;
    const r = el.getBoundingClientRect();
    if (r.width >= box.width * 0.9 && r.height >= box.height * 0.9) return false;  // a background
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    if (cs.stroke === 'none' && cs.fill.startsWith('url(')) return false;           // a gradient glow or grid
    return el.getTotalLength && el.getTotalLength() > 2;
  });
  // Fit the kept lines to the canvas (the drawing fills the floor, not a small middle).
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const el of shapes) {
    const r = el.getBoundingClientRect();
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  }
  const fit = (size * 0.92) / Math.max(x1 - x0, y1 - y0);
  const ox = (size - (x1 - x0) * fit) / 2, oy = (size - (y1 - y0) * fit) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const g = canvas.getContext('2d');
  g.lineWidth = size / 430; g.lineCap = 'round'; g.lineJoin = 'round';
  // Each new stroke goes under what is drawn already: where lines cross, the earlier one (drawn first) keeps its order.
  g.globalCompositeOperation = 'destination-over';
  const n = shapes.length;
  shapes.forEach((el, i) => {
    const len = el.getTotalLength();
    const m = el.getScreenCTM();
    const steps = Math.max(2, Math.ceil(len * fit * (size / box.width) / 3));
    let prev = null;
    for (let k = 0; k <= steps; k++) {
      const p = el.getPointAtLength((len * k) / steps).matrixTransform(m);
      const pt = [ox + (p.x - x0) * fit, oy + (p.y - y0) * fit];
      if (prev) {
        const order = (i + k / steps) / n;
        const v = Math.round(order * 16777215);
        g.strokeStyle = `rgb(${v >> 16},${(v >> 8) & 255},${v & 255})`;
        g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(pt[0], pt[1]); g.stroke();
      }
      prev = pt;
    }
  });
  return { png: canvas.toDataURL('image/png'), shapes: n };
}"""


def main():
    (OUT / "drawings").mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": SIZE, "height": SIZE})
        page.set_content("<!doctype html><html><body></body></html>")
        for name, path in DRAWINGS.items():
            result = page.evaluate(TRACE, [path.read_text(encoding="utf-8"), SIZE])
            data = base64.b64decode(result["png"].split(",", 1)[1])
            (OUT / "drawings" / f"{name}.png").write_bytes(data)
            print(f"{name}: {result['shapes']} shapes, {len(data) // 1000} KB")
        browser.close()
    # The parts atlas: each cut-out render centred in its cell, on transparent.
    atlas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
    for i, part in enumerate(PARTS):
        im = Image.open(ROOT / "public/showcase" / f"{part}-800.webp").convert("RGBA")
        box = im.getchannel("A").getbbox()
        if box:
            im = im.crop(box)
        im.thumbnail((460, 460), Image.Resampling.LANCZOS)
        cx, cy = (i % 4) * 512, (i // 4) * 512
        atlas.alpha_composite(im, (cx + (512 - im.width) // 2, cy + (512 - im.height) // 2))
    atlas.save(OUT / "parts-atlas.webp", "WEBP", quality=82, method=6)
    print(f"parts-atlas: {len(PARTS)} parts, {(OUT / 'parts-atlas.webp').stat().st_size // 1000} KB")


if __name__ == "__main__":
    main()
