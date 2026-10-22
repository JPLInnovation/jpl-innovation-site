// Text contrast measured on real pixels, for text over pictures and the 3D scene (axe cannot judge those).
//
// It hides every word on the page, photographs what is behind each text box, and the companion script
// (measure-contrast.py) computes the WCAG ratio of the word's own colour (alpha included) against those pixels,
// worst pixels first (3rd percentile). Large text must reach 3:1, everything else 4.5:1.
//
//   npm run build && npx astro preview                  (serves http://localhost:4321)
//   node scripts/measure-contrast.mjs OUTDIR URL THEME WIDTH [SCOPE] [MODE]
//   python scripts/measure-contrast.py OUTDIR/c-THEME-WIDTH.json [HOW_MANY_TO_LIST]
//
//   THEME dark | light      WIDTH e.g. 1440 or 375      SCOPE a CSS selector for the text to check (default: main)
//   MODE  studio: every scene of the home studio, one after another (the ruler too)
//         wall:   the Work page's wall, scrolled to its second panel
//         (omit for an ordinary page)
// Needs Playwright for Node (npm i -g playwright) and Pillow for Python (pip install pillow). Slow software
// WebGL needs time to settle: SETTLE=11000 (ms per scene) and WAIT=5000 (ms after load) can be raised.
// It adds no dependency to the site.
// Contrast of real text over whatever is behind it (images, the 3D canvas): hide the text, photograph what is under
// each text box, and compute the WCAG ratio against the text's own colour (alpha included), worst pixels first.
import { chromium } from "playwright";
import fs from "node:fs";
const [, , outDir, url, theme, width, scope, mode] = process.argv;
const W = Number(width || 1440);
const H = W < 500 ? 800 : 900;
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: theme });
await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
const p = await ctx.newPage();
await p.goto(url + "?quality=low", { waitUntil: "load" });
await p.keyboard.press("Escape");
await p.waitForTimeout(Number(process.env.WAIT || 4000));
if (mode === "studio") await p.waitForSelector("[data-studio][data-live]", { timeout: 120000 });
if (mode === "wall") {
  await p.waitForSelector("[data-wall][data-live]", { timeout: 120000 });
  await p.evaluate(() => { const r = document.querySelector("[data-wall]"); const top = r.getBoundingClientRect().top + scrollY; const stage = r.querySelector(".wall-stage"); const range = r.offsetHeight - stage.offsetHeight; scrollTo({ top: top + (1 / 3) * range, behavior: "instant" }); });
  await p.waitForTimeout(9000);
}
await p.evaluate(() => document.querySelectorAll("[data-reveal],[data-reveal-group] > *").forEach((e) => { e.style.opacity = "1"; e.style.transform = "none"; }));
await p.waitForTimeout(500);
const scenes = mode === "studio" ? await p.$$eval(".studio-panels > [data-scene]", (els) => els.map((e) => e.dataset.scene)) : [null];
const results = [];
for (const [i, scene] of scenes.entries()) {
  if (mode === "studio") {
    await p.evaluate((i) => { const t = document.querySelector(".studio-track"); scrollTo({ top: t.getBoundingClientRect().top + scrollY + i * innerHeight, behavior: "instant" }); }, i);
    await p.waitForTimeout(Number(process.env.SETTLE || 9000));
    // wait until this scene's text has fully faded in (a slow software renderer can take a while)
    await p.waitForFunction((i) => Number(getComputedStyle(document.querySelectorAll(".studio-panels > [data-scene]")[i]).opacity) >= 0.99, i, { timeout: 60000 }).catch(() => {});
  }
  const root = mode === "studio" ? `.studio-panels > [data-scene="${scene}"], .studio-ruler` : scope || "main";
  const items = await p.evaluate((root) => {
    const out = [];
    const roots = [...document.querySelectorAll(root)];
    if (!roots.length) return out;
    const canvas = document.createElement("canvas").getContext("2d");
    const rgba = (c) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = "#000"; canvas.fillStyle = c; canvas.fillRect(0, 0, 1, 1); const d = canvas.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const seen = new Set();
    for (const rootEl of roots) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (seen.has(el) || el.closest(".sr-only")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      // opacity of the element and its ancestors multiplies the text alpha
      let op = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      if (op < 0.05) continue;
      seen.add(el);
      let c = rgba(cs.color);
      // Gradient-filled headings (the pointer glint) are transparent text over a background clipped to the letters: outside the glow they are the foreground colour.
      if (c[3] === 0 && (cs.backgroundClip.includes("text") || cs.webkitBackgroundClip.includes("text"))) c = rgba(getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim());
      out.push({ text: n.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, color: [c[0], c[1], c[2]], alpha: c[3] * op, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400 });
    }
    }
    return out;
  }, root);
  await p.addStyleTag({ content: "*{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important} .glint{background-image:none!important} " });
  await p.waitForTimeout(400);
  const shot = `${outDir}/c-${theme}-${W}-${scene ?? "page"}.png`;
  await p.screenshot({ path: shot });
  await p.evaluate(() => { document.querySelectorAll("style").forEach((s) => { if (s.textContent.startsWith("*{color:transparent")) s.remove(); }); });
  results.push({ scene, shot, items });
}
fs.writeFileSync(`${outDir}/c-${theme}-${W}.json`, JSON.stringify(results));
console.log("ok", results.map((r) => `${r.scene}:${r.items.length}`).join(" "));
await b.close();
