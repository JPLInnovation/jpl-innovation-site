# Redesign phase 1: the foundation (tokens, type, blueprint space, glass, header) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page of the site gets the new look's foundation at once: the brand tokens and type scale, the blueprint
space behind every page, glass sheets (with a Glass / Solid setting), living colour in the big headline, and the new
header with the liquid pill.

**Architecture:** Pure logic lives in small dependency-free TypeScript modules under `src/lib/look/` (unit-tested with
Node's built-in runner, which runs `.ts` directly on Node 24). The background is one persistent WebGL2 canvas drawn
with a single full-screen shader, no library (classic pages must not start loading three.js). Glass and solid are two
CSS treatments of the same `.sheet` utility, switched by `html.solid`, chosen before first paint in `BaseLayout.astro`.

**Tech Stack:** Astro 6, Tailwind 4 (`global.css` tokens and `@utility`), TypeScript, WebGL2, Node 24 `node --test`,
Python Playwright (real Chrome, real GPU) for page checks.

**Spec:** `docs/superpowers/specs/2026-11-15-classic-redesign-design.md` (sections 1 to 5, and "Smoothness").

Later phases get their own plans: 2 the hook, footer and game, Home; 2b the showcases; 3 Work and project pages, FRC
from the team site; 4 Members, About, 404; 5 motion and smooth scroll; 6 the 3D studio.

## Global Constraints

- No new dependencies (spec: "no new dependency unless already installed"); no framework change.
- All wording in `src/text/` (one file per page): new labels go in `src/text/site.ts`.
- Colours, verbatim: dark field `#0A174E`, dark ink `#F2EEDF`, dark accent `#F5D042`; light field `#F2EEDF`, light ink
  `#0A174E`, light accent `#2F7CE6` (yellow `#F5D042` kept for one mark).
- Type: Archivo only (already self-hosted); display uses the extra-wide cut (`font-stretch: 125%`), largest size up to
  12 to 15vw; body 16 to 19px; five sizes at most.
- Banned (spec "Not wanted"): rainbow or purple-blue gradients, neon glows, sparkles, blobs, icon-card rows, monospace
  labels, 01/02 numbering, emoji. Glass and the colour field are the two allowed exceptions.
- Smoothness: 60 fps on an ordinary laptop, the screen's rate (240 Hz) on the RTX; background paused when the tab is
  hidden, with reduce-motion, and wherever a page shows its own full-window 3D stage (`[data-own-backdrop]`).
- Every existing section, link, form, intro and setting keeps working; existing components keep rendering with the new
  tokens (existing token names stay, remapped).
- Running text contrast at least 4.5:1 in both themes and both styles.

## Review Focus

- **The 3D studio page (home in 3D mode):** the background must not draw under the studio's own canvas, or the studio
  loses frames. Test: Task 4's page check loads `/` in 3D mode and asserts the field reports `paused`.
- **Glass on a browser without `backdrop-filter: url()` (Firefox, Safari):** must fall back to plain frosted glass, not
  break or turn opaque black. Test: Task 3 unit-tests `lensSupported()` and its page check forces the fallback class.
- **A visitor who sets Solid, then reloads:** the choice must hold before first paint (no glass flash). Test: Task 3's
  page check reloads with `surface=solid` stored and asserts `html.solid` at `DOMContentLoaded`.
- **Light theme readability on glass over a bright field:** text over frosted white film must keep 4.5:1. Test: Task 2's
  contrast check covers light + glass.
- **A phone or weak laptop:** the field must drop resolution, then fall back to a still image, never stutter the page.
  Test: Task 4 unit-tests `nextScale()` and `shouldFallBack()`.

---

### Task 1: The test runner

**Files:**
- Modify: `package.json` (scripts)
- Create: `src/lib/look/README.md` (one paragraph: pure modules only, no imports from Astro, Vite aliases or the DOM,
  so `node --test` can run them)
- Test: `src/lib/look/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` runs every `src/**/*.test.ts` with `node --test`.

- [ ] **Step 1: Write the smoke test**
  `smoke.test.ts`: `test("runner works", () => assert.equal(1 + 1, 2))` using `node:test` and `node:assert/strict`.
- [ ] **Step 2: Add the script** `"test": "node --test \"src/**/*.test.ts\""` to `package.json`.
- [ ] **Step 3: Run** `npm test`. Expected: `# pass 1`, `# fail 0`.
- [ ] **Step 4: Commit** `git commit -m "Tests: node --test for the pure look modules"`

### Task 2: Tokens and the type scale

**Files:**
- Modify: `src/styles/global.css` (`:root` light block from line 31, `.dark` block from line 78, `@theme inline`, the
  `@utility` section)
- Create: `scripts/check-look.py` (Playwright, real Chrome; grows in later tasks)

**Interfaces:**
- Produces CSS custom properties used by every later task:
  `--field` `--field-2` `--sheet` `--sheet-edge` `--ink` `--ink-soft` `--accent-brand` `--mark` (the yellow), in both
  `:root` (light) and `.dark`; type steps `--step-small` `--step-body` `--step-lead` `--step-head` `--step-display`;
  utilities `text-display` (wide 125%, weight 800, tracking -0.04em, leading 0.88, size `--step-display`) and
  `text-head`.
- Existing names (`--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--muted-foreground`, `--border`)
  are remapped onto the new ones so current components render in the new palette.

- [ ] **Step 1: Write the check** in `scripts/check-look.py`: for `/`, `/work/`, `/members/`, `/about/` in light and
  dark (localStorage `theme`, `experience=classic`, intro seen), assert the computed `--field` equals the spec value
  (`#0a174e` dark, `#f2eede`-ish light: compare to `#F2EEDF`) and that `body` text colour against `--sheet` has a WCAG
  contrast ratio ≥ 4.5. Exits non-zero on failure. Usage line at top: `python scripts/check-look.py --url http://localhost:4321`.
- [ ] **Step 2: Run it** against `npm run build && npx astro preview --port 4321`. Expected: FAIL (old colours).
- [ ] **Step 3: Write the tokens** with the spec's values; the type steps:
  `--step-small: clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)`, `--step-body: clamp(1rem, 0.96rem + 0.2vw, 1.1875rem)`,
  `--step-lead: clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)`, `--step-head: clamp(2rem, 1.3rem + 3.2vw, 4.5rem)`,
  `--step-display: clamp(3.5rem, 1rem + 11vw, 15rem)`. Remove the purple tokens (`--glow-2`, `--bg-star-alt`,
  `--cursor-glow` violet) per the banned list.
- [ ] **Step 4: Run the check again.** Expected: PASS for all 8 page/theme pairs.
- [ ] **Step 5: Commit** `git commit -m "Look: brand tokens and type scale"`

### Task 3: Glass and Solid (the sheet, the setting, the lens)

**Files:**
- Create: `src/lib/look/surface.ts`, `src/lib/look/surface.test.ts`
- Modify: `src/lib/prefs.ts` (new key), `src/layouts/BaseLayout.astro` (head script, before first paint; the SVG lens
  filter once in `<body>`), `src/styles/global.css` (`@utility sheet`, `html.solid`, `.lens`),
  `src/components/SettingsPanel.astro` (a Style group), `src/text/site.ts` (`settings.style` words)
- Create: `src/scripts/rim.ts` (pointer-lit rim)

**Interfaces:**
- Produces `chooseSurface(o: { stored: string | null; reducedMotion: boolean; deviceMemory?: number; saveData?: boolean }): "glass" | "solid"`
  (stored "glass" or "solid" wins; else solid when reduced motion, save-data, or deviceMemory ≤ 4; else glass).
- Produces `lensSupported(supports: (prop: string, value: string) => boolean): boolean` (true when
  `backdrop-filter: url(#x)` is supported).
- Produces `rimFromPointer(rect: { left: number; top: number; width: number; height: number }, x: number, y: number): { angle: number; strength: number }`
  (angle in degrees from the sheet's centre to the pointer, 0 = right, clockwise; strength 1 on the edge falling to 0
  at 1.5 sheet-widths away).
- Produces `SURFACE_KEY = "surface"` in `prefs.ts`; `html.solid` class; `.sheet` utility (glass: fill
  `color-mix(in oklab, var(--sheet) 62%, transparent)`, `backdrop-filter: blur(22px) saturate(1.4)`, a 1px inner rim
  whose bright side follows `--rim-angle`; solid: `var(--sheet)` opaque, no blur); `.lens` adds
  `backdrop-filter: url(#jpl-lens) blur(22px)` only under `html.lens`.

- [ ] **Step 1: Write the failing tests** `surface.test.ts`:
  - `chooseSurface({ stored: "solid", reducedMotion: false })` → `"solid"`; `{ stored: "glass", reducedMotion: true }` → `"glass"`;
    `{ stored: null, reducedMotion: true }` → `"solid"`; `{ stored: null, reducedMotion: false, deviceMemory: 4 }` → `"solid"`;
    `{ stored: null, reducedMotion: false, deviceMemory: 8 }` → `"glass"`; `{ stored: "junk", reducedMotion: false }` → `"glass"`.
  - `lensSupported(() => true)` → `true`; `lensSupported(() => false)` → `false`.
  - `rimFromPointer({left:0,top:0,width:100,height:100}, 200, 50)` → angle `0`, strength between 0 and 1;
    pointer at `(50, 150)` → angle `90`; pointer at the centre → strength `1`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `surface.ts` (no imports). Wire the head script in `BaseLayout.astro` next to
  `applyTheme` (it reads `localStorage.surface` in a try/catch like the others, calls the same rule inline, and toggles
  `html.solid` and `html.lens`; re-applied on `astro:after-swap`). Add the `<svg>` with `<filter id="jpl-lens">`
  (`feTurbulence` baseFrequency 0.008, `feDisplacementMap` scale 18, edges only via a radial mask) once, hidden.
  `rim.ts`: one `pointermove` listener (passive, rAF-throttled) sets `--rim-angle` and `--rim-strength` on the sheet
  under the pointer only; none on touch.
  Settings: a "Style" group (Glass / Solid) saving `surface`, applied instantly without reload.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Extend `check-look.py`:** (a) store `surface=solid`, reload, assert `html.solid` present at
  `DOMContentLoaded`; (b) on Chrome assert `html.lens`; with an init script making `CSS.supports` return false for
  `url(`, assert no `html.lens` and the sheet still has a non-opaque background; (c) contrast ≥ 4.5 for ink on a `.sheet`
  in light+glass, light+solid, dark+glass, dark+solid. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "Look: glass and solid sheets, the lens, a Style setting"`

### Task 4: Blueprint space (the background field)

**Files:**
- Create: `src/lib/look/field.ts`, `src/lib/look/field.test.ts` (pure: scheduling and camera maths)
- Create: `src/scripts/blueprint.ts` (WebGL2 setup, the shader, the loop)
- Create: `public/look/field-still-dark.webp`, `public/look/field-still-light.webp` (made by Task 4 Step 5)
- Modify: `src/layouts/BaseLayout.astro:123-128` (replace the three `.site-bg` children with one
  `<canvas data-blueprint>` and a still `<img>`), `src/styles/global.css:306-372` (replace the `.site-bg` block)
- Delete: `src/scripts/background.ts` (and its import wherever it is loaded)

**Interfaces:**
- Produces `nextScale(scale: number, frameMs: number): number` (dynamic resolution between 0.5 and 1: above 12 ms
  average step down by `sqrt(10 / frameMs)`, under 7 ms step up by 1.1, clamped).
- Produces `shouldFallBack(slowWindows: number): boolean` (true after 3 consecutive 1-second windows above 33 ms at
  scale 0.5).
- Produces `shouldAnimate(s: { hidden: boolean; reduced: boolean; ownBackdrop: boolean }): boolean`.
- Produces `cameraFor(scrollProgress: number, pointer: { x: number; y: number }): { height: number; pitch: number; drift: number; lean: [number, number] }`
  (scroll 0 to 1 moves forward over the floor: `drift` grows linearly; `pitch` eases from 0.18 to 0.32 rad; `lean` is
  the pointer (-1 to 1) times 0.04 rad).
- Produces the canvas contract for later phases: `window.__field = { paused: boolean; scale: number; night: number }`
  and `document.documentElement.style.setProperty("--field-night", ...)` so CSS can follow the field's night/day.
- The shader draws, in one pass: the field (brand blue to gold light, slow), an endless grid floor with + marks fading
  into depth (perspective from `cameraFor`), and a slow beam. Uniforms: `uTime`, `uCamera`, `uNight` (1 dark theme, 0
  light; eased on change), `uRes`. No textures. Grid detail kept faint and only towards the edges of the screen (the
  spec: never behind text).

- [ ] **Step 1: Write the failing tests** `field.test.ts`:
  - `nextScale(1, 20)` < 1; `nextScale(0.5, 40)` === 0.5; `nextScale(0.8, 5)` > 0.8; `nextScale(1, 5)` === 1.
  - `shouldFallBack(2)` false; `shouldFallBack(3)` true.
  - `shouldAnimate({hidden:false,reduced:false,ownBackdrop:false})` true; any of the three true → false.
  - `cameraFor(0, {x:0,y:0}).drift` === 0; `cameraFor(1, …).drift` > `cameraFor(0.5, …).drift`;
    `cameraFor(0.5, {x:1,y:0}).lean[0]` ≈ 0.04.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `field.ts`, then `blueprint.ts`: WebGL2 context (`antialias:false, alpha:false,
  powerPreference:"high-performance"`), draws at `devicePixelRatio * scale` capped at 1.5, measures 1-second windows
  and applies `nextScale`; on `shouldFallBack` hides the canvas and shows the still; listens to `visibilitychange`, the
  reduce-motion query and `astro:after-swap` (re-checks `[data-own-backdrop]`); reads the theme from `html.dark`.
  Mark the studio: add `data-own-backdrop` to the root of `src/components/Studio.astro` when the 3D studio is shown.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Make the stills:** a Playwright script (add to `check-look.py` as `--make-stills`) screenshots the
  canvas at scroll 0 in each theme and writes the two WebP files (quality 70, ≤ 120 KB each).
- [ ] **Step 6: Extend `check-look.py`:** (a) on `/work/` classic: `window.__field.paused === false`, the canvas is
  drawing (two `readPixels`-free checks: `__field.frames` increases); (b) `/` in 3D mode: `__field.paused === true`;
  (c) tab hidden (`page.evaluate` dispatching `visibilitychange` with `document.hidden` overridden): paused.
  Expected: PASS.
- [ ] **Step 7: Measure** with the scratch `fps.py` method on the RTX (real Chrome, headed): `/work/` and `/about/`
  scrolled for 3 s each: median frame ≤ 4.4 ms (240 Hz), no frame over 25 ms after the first second. Then with Chrome's
  `--force-gpu-rasterization` off and the window at 2560 px: same. Record the numbers in the commit message.
- [ ] **Step 8: Commit** `git commit -m "Look: blueprint space behind every page (WebGL2, no library)"`

### Task 5: Living colour in the big headline

**Files:**
- Modify: `src/styles/global.css` (`@utility living`, `@property --live-a` and `--live-b`)
- Modify: the first `h1` of `src/components/PageIntro.astro` (the shared page title) to use `living`

**Interfaces:**
- Produces the `living` utility: `background-clip: text; color: transparent;` over a slow brand-only light
  (`--accent-brand` to `--mark` to `--ink`) whose position animates through `@property` angles (transform-free, no JS);
  `html.solid` and reduce-motion: static, the ink colour only. Fallback where `background-clip:text` is unsupported:
  plain `--ink`.

- [ ] **Step 1: Extend `check-look.py`:** on `/work/` the page `h1` has computed `background-clip: text` (glass) and the
  text is still selectable and announced (its `textContent` non-empty, `color` transparent only when clip is applied);
  in solid mode its colour equals `--ink`. Run: FAIL.
- [ ] **Step 2: Implement** the utility and apply it.
- [ ] **Step 3: Run the check.** Expected: PASS. Look at screenshots of `/work/` and `/about/` in both themes (Read the
  PNGs) and confirm the colours are blue and gold only, no violet.
- [ ] **Step 4: Commit** `git commit -m "Look: living colour in page titles"`

### Task 6: The header and the liquid pill

**Files:**
- Create: `src/lib/look/pill.ts`, `src/lib/look/pill.test.ts`
- Modify: `src/components/SiteHeader.astro` (markup: plain glass strip; a `<span data-pill>` inside the desktop `<ul>`;
  script), `src/styles/global.css` only if a token is missing

**Interfaces:**
- Produces `pillAt(from: { x: number; w: number }, to: { x: number; w: number }, t: number): { x: number; w: number }`
  — the liquid stretch: for `t` in 0 to 0.5 the leading edge travels to the target while the trailing edge stays (the
  pill stretches like a drop), for 0.5 to 1 the trailing edge catches up; at `t=0` returns `from`, at `t=1` returns
  `to`, width never below the smaller of the two.
- The header keeps: the logo (and its compact roll), the three links from `src/text/site.ts`, Settings, the "Let's
  talk" button, the phone menu and all its closing rules, `aria-current` on the current link.
- The pill rests under `aria-current`; on pointer or focus over another link it runs `pillAt` over 380 ms
  (`cubic-bezier(0.32,0.72,0,1)`), returns when the pointer leaves the nav; reduce-motion: it jumps, no stretch.

- [ ] **Step 1: Write the failing tests** `pill.test.ts`:
  - `pillAt({x:0,w:80},{x:200,w:60},0)` deep-equals `{x:0,w:80}`; at `1` → `{x:200,w:60}`.
  - at `0.5` the left edge is still `0` and the right edge is `260` (stretched over both).
  - moving left (`from {x:200,w:60}` to `{x:0,w:80}`) at `0.5`: left edge `0`, right edge `260`.
  - width is never below `60` for any `t` in `[0, 0.1, …, 1]`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `pill.ts`, then the header: replace the `after:` underline with the pill element; the bar
  uses `.sheet` (glass strip) with no bottom border at rest and a step of tone when scrolled (no line, per the house
  rules); keep every existing behaviour of the script (scroll edge, compact logo, menu open/close rules).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Extend `check-look.py`:** on `/work/drone/` the pill's box sits under "Work" (±2 px); hovering "About"
  moves the pill's right edge past About's right edge within 500 ms, and it settles back under "Work" after the pointer
  leaves; Tab through the header reaches every link and the pill follows focus; at 390 px wide the phone menu opens and
  closes as before (Escape, outside tap, link tap). Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "Look: the header as a glass strip with the liquid pill"`

### Task 7: Phase gate

**Files:** none new.

- [ ] **Step 1:** `npm test` → all pass. `npm run build` → no errors. `python scripts/check-look.py` → all pass.
- [ ] **Step 2:** Run the design skill's inspector on the built pages (`node "<skill>/scripts/inspect.mjs" http://localhost:4321/work/`
  and `/about/`, `/members/`) and read every screenshot at 1440, 768 and 390. Fix any FAIL caused by this phase (later
  phases own the page sections themselves).
- [ ] **Step 3:** Frame rates on the RTX as in Task 4 Step 7 on `/`, `/work/`, `/work/drone/`, `/about/`; and the 3D
  home still at its previous numbers (the scratch `fps.py` run: 230 to 240 fps across the page).
- [ ] **Step 4:** Commit any fixes; push the branch to `jpl_site2` (never to the live remote in this phase).
