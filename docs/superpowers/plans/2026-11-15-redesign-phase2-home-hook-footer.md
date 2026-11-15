# Redesign phase 2: the living blueprint, the Pre-flight hook, the footer and its game, the classic home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The background stops being "an ordinary grid moving up" and becomes the site's signature (a drawing that draws
itself on the floor as you scroll, real parts floating over it, a camera that flies a path); the Pre-flight hook opens
the site; the footer is the back of the sheet with a landing game; the classic home is rebuilt as the title sheet.

**Architecture:** Extends phase 1. The field (`src/scripts/blueprint.ts`, one WebGL2 context, no library) gains a
second texture (the floor drawing, encoded with its draw order so one number reveals it) and a second program
(instanced glass tiles with real part pictures from one atlas). Pure decisions stay in `src/lib/look/` (tested with
`npm test`); page checks in `scripts/check-look.py`; frame rates measured on the RTX as in phase 1.

**Tech Stack:** Astro 6, Tailwind 4, TypeScript, WebGL2, Node 24 `node --test`, Python Playwright (real Chrome).

**Spec:** `docs/superpowers/specs/2026-11-15-classic-redesign-design.md` sections 1 (blueprint space), 3, 5, 7 (Home,
Footer), 11 (the hook), "Footer game", personality lines. Owner feedback since phase 1: "the background is alright but
not impressive nor creative, like the ordinary animation with the movement up".

## Global Constraints

- No new dependencies. Words in `src/text/` (site.ts for the hook, footer and game; home.ts for the home).
- Palette tokens only (`--field`, `--sheet`, `--ink`, `--accent-brand`, `--mark`); no violet, no gradients beyond
  the field and glass, no monospace labels, no 01/02 numbering, no emoji.
- 240 fps on the RTX, 60 on a laptop; the field keeps its meter, still fallback and pauses (phase 1).
- Every existing section and word of the home page is kept (`src/text/home.ts`); the 3D studio home is untouched.
- Personality lines appear only when the owner has approved them (`approved: true` in `src/text/site.ts`).
- Reduced motion: every new motion has a still version that keeps the content.

## Review Focus

- **A page with no drawing of its own** (Members, About, 404): the floor must still look designed (the grid and the
  JPL badge drawing), never an empty floor or a missing-texture black square. Test: Task 1 page check on /about/.
- **The hook on a return visit or a refresh:** it must not replay in full (once per visit), and any key, click or
  scroll must skip it at any moment. Test: Task 2 page checks.
- **The game stealing keys:** Space in the footer game must not scroll the page, and must not fire anywhere else
  (forms, the terminal). Test: Task 3 page check typing in the email dialog.
- **Reduced motion / Solid on a weak device:** the floor drawing shows complete and still; no tiles drift. Test:
  Task 1 page check with reduced motion emulated.
- **The scrubber with no real photo yet:** its third stage must say what it is (the bench-tested render), never
  pretend to be a photograph. Test: Task 4 page check reads the caption.

---

### Task 1: The living blueprint (field v2)

**Files:**
- Create: `scripts/build-floor-drawings.py` (Playwright: draws each vector drawing path by path into a canvas whose
  colour encodes draw order; writes `public/look/drawings/{name}.png`, 2048 px square)
- Create: `src/lib/look/drawing.ts`, `src/lib/look/drawing.test.ts`
- Modify: `src/lib/look/field.ts` + test (`cameraFor` becomes a flown path), `src/scripts/blueprint.ts`
- Modify: pages' `<main>`: `data-field-drawing` (home and drone: `f450`, mini-drone: `mini`, cybersecurity:
  `network`, Work/Members/About/404: `badge`); sections that turn the world to day: `data-field="day"`

**Interfaces:**
- Drawing encoding (PNG): RGB = draw order 0..1 in 24 bits (R high, G mid, B low), A = line coverage. Order 0 is drawn
  first. Sources: `public/assets/f450-drone.svg`, `mini-drone.svg`, `cybersecurity.svg`, the badge
  (`src/assets/intro/jpl-badge.svg`).
- `revealAt(scroll: number, page: { start: number; end: number }): number` — the share of the drawing drawn: 0 before
  `start`, 1 after `end` (scroll progress 0..1), eased; the default page window is 0.05..0.8.
- `cameraFor(scroll, pointer)` now returns a flown path: `{ height: 1.6 → 4.2, pitch: 0.18 → 0.62, yaw: -0.22 → 0.3,
  drift: 0 → 26, lean }` (height and pitch rise so the camera ends looking down onto the drawing; yaw turns it).
- `dayAt(sections: Array<{ top: number; bottom: number; day: boolean }>, mid: number): boolean`.
- Tiles: `tileLayout(n: number, seed: number): Array<{ x: number; y: number; z: number; size: number; spin: number }>`
  — positions in the field's space, away from the screen's middle third (text), never overlapping.
- The shader: the floor drawing laid flat ahead of the camera (14 m square), its lines in `--accent-brand`'s colour
  where `order < reveal`, a bright pen tip where `order ≈ reveal`, dimension ticks and the grid unchanged; tiles: one
  instanced draw, each a glass card (rim light, frosted) showing one part from the atlas
  (`public/look/parts-atlas.webp`, made by the same script from `public/showcase/robot/*-800.webp` and the drone),
  bobbing slowly, turning to the pointer a little.

- [ ] Step 1: tests for `revealAt` (0 before start, 1 after end, monotonic, eased), `dayAt` (the section under the
  middle wins; none: night/theme), `tileLayout` (n tiles, none in the middle third horizontally, none overlapping,
  same seed same layout), `cameraFor` (path values at 0 and 1 as above, pointer lean unchanged). Run: FAIL.
- [ ] Step 2: implement the pure functions; run: PASS.
- [ ] Step 3: the drawings and atlas script; run it; look at the PNGs (order shown as a heat map in a debug image).
- [ ] Step 4: the shader and tile program in `blueprint.ts`; mark the pages; build.
- [ ] Step 5: page checks: /work/drone/ the drawing is `f450` and `__field.reveal` grows with scroll; /about/ uses the
  badge drawing (no black square: sample the canvas centre is not pure black); reduced motion: still image shows the
  drawing complete; a `data-field="day"` section turns `__field.night` toward 0.
- [ ] Step 6: look at screenshots of /, /work/, /work/drone/, /about/ in both themes at three scroll positions; RTX
  frame rates (1440 and 2560): median 4.2 ms, no frame over 25 ms after the first second.
- [ ] Step 7: commit.

### Task 2: The Pre-flight hook

**Files:**
- Create: `src/components/PreflightSplash.astro`, `src/scripts/preflight.ts`, `src/lib/look/preflight.ts` (+ test)
- Modify: `src/layouts/BaseLayout.astro` (the JPL intro's full mode becomes Pre-flight; its fast mode, the reload
  version, stays the logo intro), `src/lib/splash.ts` if the mode logic needs a new kind, `src/text/site.ts`
  (`preflight`: boot log lines, the prompt, "XIN CHÀO!", the three verbs, the sticker's words)

**Interfaces:**
- `altitudeAt(t: number): number` — 0 → 120 m over the arming beat with an ease, whole metres; `bootLine(t)` — which
  of the boot log's lines are shown.
- Beats (design seconds): arming 0–2.6 (the F450 drawn part by part from `f450-drone.svg`'s paths, the boot log:
  "frame 450 mm ok · ESC 4 of 4 · GPS lock · 4G link up · camera 720p60", the altitude counter), the prompt (any
  click, key or scroll takes off; after 4 s it takes off by itself), XIN CHÀO splitting like hangar doors 0.6 s, the
  verbs and the sticker 1 s, then the phase 1 hand-off (the logo flies to the header).
- Once per visit (sessionStorage); a refresh plays the fast logo intro; reduced motion: one still frame for 1 s.
- The experience question (Classic or 3D) still asks on a first visit, after the hook.

- [ ] Step 1: tests for `altitudeAt` and `bootLine`; FAIL; implement; PASS.
- [ ] Step 2: the component and script; build.
- [ ] Step 3: page checks: a first visit plays the hook (the counter reaches 120), a key press skips it at once, a
  second visit in the same tab plays the fast intro, reduced motion shows the still; screenshots of every beat.
- [ ] Step 4: commit.

### Task 3: The footer, its curtain and the landing game

**Files:**
- Modify: `src/components/SiteFooter.astro`, `src/components/ContactSection.astro` (the contact band becomes part of
  the footer's sheet), `src/text/site.ts` (`footer`, `landing`, `personality` with `approved`)
- Create: `src/lib/look/landing.ts` (+ test), `src/scripts/landing-game.ts`

**Interfaces:**
- `step(state: { y: number; vy: number; fuel: number }, throttle: boolean, dt: number): State` — gravity 9.8 m/s²
  scaled to the game, throttle 14 m/s², fuel for 6 s of throttle; `landed(state, pad): "soft" | "hard" | null`
  (soft under 1.5 m/s on the pad).
- The footer: the back of the sheet, revealed by the curtain (the page slides up off it; CSS sticky, no script);
  the name at full width in living colour; the pages and contact as now; the game in a small panel: hold Space (or
  press and hold) to throttle, land on the H pad; best landing kept for the visit; a plain link to the drone page
  when script is off.

- [ ] Step 1: tests for `step` (gravity pulls down, throttle lifts, no fuel no lift) and `landed`; FAIL; PASS.
- [ ] Step 2: footer markup and the game; build.
- [ ] Step 3: page checks: the footer is revealed under the page at the end; Space in the game throttles and does not
  scroll; Space in the email dialog's field types a space; the game works with a pointer held down.
- [ ] Step 4: commit.

### Task 4: The classic home, as the title sheet

**Files:**
- Modify: `src/components/ClassicHome.astro` (rebuilt), `src/text/home.ts` (new fields only: the scrubber's three
  captions)
- Create: `src/lib/look/scrub.ts` (+ test), `scripts/render-scrub-stills.py` (the F450 sketch page and the CAD render as
  WebP, from the studio's sketch and the drone's CAD)

**Interfaces:**
- `scrubStage(t: number): { stage: 0 | 1 | 2; mix: number }` — sketch, CAD, built; drag or arrow keys move `t`.
- The page: the name at full width in living colour and the support line (the h1 stays the page heading); the
  scrubber (sketch → CAD → built; until a real photograph of the built F450 is given, the third stage is the
  bench-tested render, captioned as such); three whole-width plates (drone, robot, network) from the services and
  work content; then every existing section (hook, services, work, proof, mission, journey, team) as sheets.

- [ ] Step 1: tests for `scrubStage`; FAIL; PASS.
- [ ] Step 2: render the stills; rebuild the page; build.
- [ ] Step 3: the design skill's inspector on `/` (classic) at 1440, 768, 390: 0 FAIL; read every screenshot; page
  checks: the scrubber moves with the arrow keys and announces its stage; every heading from home.ts is on the page.
- [ ] Step 4: commit.

### Task 5: Phase gate

- [ ] `npm test`, build, `scripts/check-look.py` all pass; RTX frame rates as Task 1 Step 6 on every page; the
  whole-branch review (fresh reviewer) and its fix pass; push to `jpl_site2` only.
