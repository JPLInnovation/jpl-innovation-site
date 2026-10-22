# Scroll showcase

A 3D model that turns to each feature as its text scrolls past. It runs on two pages:

| Page | Section | Words | Model |
| :-- | :-- | :-- | :-- |
| `/work/drone/` | Part by part | `src/text/showcase/drone.ts` | `src/lib/three/models/drone-showcase.ts` |
| `/work/frc/` | The 2026 robot in 3D | `src/text/showcase/robot.ts` (heading and intro: `frcPage.model3d` in `src/text/projects/frc.ts`) | `src/lib/three/models/frc-robot-showcase.ts` |

## How it works

- **`src/components/showcase.tsx`**, the island (`client:visible`). It renders all the text on the server: heading, intro, one `<article>` per feature, and a row of dots that are real `#id` links. From 768 px up, with motion allowed, the 3D stage stays pinned just under the site header (which is always on screen; beside the text from 1024 px, above it below that) while the features scroll in normal flow. The page scrolls natively. Each frame reads `scrollY` once against offsets measured when anything on the page changes size, so it never forces a layout. Nothing goes through React state per frame.
- **`src/lib/three/showcase.ts`** drives the 3D inside the shared stage's animation frame (`src/lib/three/stage.ts`, which pauses off screen and in hidden tabs):
  - **Camera:** follows the scroll position through a critically damped spring (about 0.4 s, never overshoots, exact for any frame length). It holds still near each stop and eases between stops with a quintic curve, so it leaves gently and arrives without a bump. Between two stops it travels on a curve around the model: its direction turns on a great circle, and on a wide turn it swings out (up to 16% further) and up (up to 8°) in the middle, like a camera crane, never in a straight line through the model. A fast jump (a dot) glides past the stops in between instead of pausing at each one.
  - **Opening beat:** while the section scrolls into place (the last 85% of a screen before the first stop), the camera settles in from 22% further out and the model plays its `opening(progress)`: the drone's parts fly together under a key light sweeping across it; one ball of FUEL rides the whole way through the KitBot with the scroll.
  - **Exploded view (drone):** the flight controller stop pulls the drone 45% apart and the power stop 50%, scrubbed by the scroll. Every CAD piece moves away from the middle of the drone, mostly up and down so the layers of the stack separate; parts with one in each corner (arms, motors, legs and their wires) move as four. Offsets come from the CAD part boxes at load time (`explode` attribute, `SPREAD` and `EXPLODE` in `drone-showcase.ts`); framing, labels and the floor shadow follow, and ambient occlusion fades out while it's apart.
  - **Rest:** after 4 s without scrolling, dragging or camera movement, the model's own animation (props, rollers, FUEL) winds down over about a second and the stage stops drawing; a scroll or a press wakes it.
  - **Framing:** every stop shows the whole model. Its direction comes from the model file; its target and distance are worked out for the stage's real shape from about 4000 points sampled off the model's surface. The model is centred and fills 86% of the stage's limiting side, which keeps it inside the faded edges. Nothing is ever cut off, at any width.
  - **Focus:** the current feature's parts keep their colour while the rest fades back (a shader tweak, tied to the camera's position, not a timer). One label per stop appears once the camera arrives.
  - **Drag:** mouse and pen only. Drag to look around the current stop; on release it springs back (about 0.4 s). Touch is left alone so the page scrolls.
- **Edges:** the canvas wrapper (`.showcase-view`) fades out on every side through a CSS mask, the same on both themes. Beside the text it runs on into the column gap and to the window's right edge.

## Adding a feature (a stop)

1. **Text:** add an entry to `features` in the page's text file (`id`, `title`, `text`, `facts`). The order there is the order on the page. The `title` is also the floating label.
2. **Parts:** tell the model file which parts belong to it.
   - Drone: add the CAD part names under the new id in `PARTS` (`look` = what the label hangs off, `also` = more parts that keep their colour).
   - Robot: the CAD file has no part names, so `classify()` sorts parts by rotor, colour and position (boxes around the CAD's anchors). Add a rule that returns the new id.
3. **Framing:** add the id to `FRAMING`: `from` is the direction the camera looks from (only its direction counts), `label` is where the label hangs in the part box (-1..1 per axis, ±1 = just outside that face). `at` is kept for reference; the target is centred on the model automatically.
4. **Stills:** regenerate them (below). A feature without a still shows its card as text only.

A feature in the text with no entry in the model file gets the overview's direction and no parts of its own, so nothing breaks.

## Effects that belong to one stop

A model can implement `focus(weights)`, which gets how much each stop is showing (0 to 1, following the camera) every frame, and `pose(stop)`, which sets the animation for a still. Used for:

- Drone: the 4G stick's signal rings show only on the 4G video link stop. The prop blur discs stay faint (60% of the hero's) and are left out of the stills.
- Robot: FUEL (the balls) shows on the overview, intake, hopper and shooter stops and leaves for the drivetrain and electronics. The bumpers turn almost clear on the drivetrain stop, and the shooter's side plates on the shooter stop, so the parts behind them show.

## Quality tiers (src/lib/three/stage.ts, src/lib/three/quality.ts, src/lib/three/finish.ts)

Every 3D view on the site (the showcases and the plain viewers) runs on the shared stage, which picks a tier:

| Tier | Who starts on it | What it draws |
| :-- | :-- | :-- |
| high | laptops and desktops with their own or Apple graphics | 4x MSAA render target, ground-truth ambient occlusion (GTAO, full resolution), soft contact shadows, the full material finishes, up to 2x device pixels (at most 4.6 MP) |
| medium | tablets and laptops with integrated Intel graphics (Iris, UHD), or after a drop from high | the canvas's own MSAA, soft contact shadows, the full finishes, up to 1.5x device pixels |
| low | phones, saveData, 2 GB of memory or 2 cores, software GL; or after a drop from medium | plain renderer, round blob shadows, standard materials, up to 1.25x device pixels |

- **Look on every tier:** ACES filmic tone mapping (AgX washed the CAD's reds and yellows out), a generated studio environment (RoomEnvironment, nothing downloaded), and a key, fill and rim light that ride on the camera, so every angle is lit. Light and dark themes have their own exposure and light balance.
- **Finishes** (`finish.ts`), by CAD material, colours always the model's own: glossy PCB with a clear coat, the F450's fibreglass plates, matte printed PETG with a little sheen, moulded plastic, LiPo shrink wrap, machined metal, brushed motor bells (anisotropic, with tangents around each motor's axis), anodised aluminium on the robot, rubber, bumper fabric (sheen), FUEL foam, the camera lens, and see-through polycarbonate (no transmission pass: faint face on, more solid at grazing angles).
- **Contact shadows:** each model's floor plane is replaced by its real footprint, rendered once from below into a 512 px depth texture and blurred twice; drawn again only when the model changes shape (the exploded view). Moving things (FUEL) are left out.
- **Adaptive:** the first 50 frames after a 12-frame warm-up are timed; if they average more than 22 ms the stage drops a tier at once, and after that two slow windows in a row drop it again. It never climbs back. `?quality=high|medium|low` pins a tier; `window.__stage` lists each stage's tier, last frame time and drops.
- **Only when needed:** renders only while on screen and the tab is visible, and stops when the model reports it is at rest.
- The logo intros keep their own plain materials (the richer finishes take longer to compile, which would stall the intro's clock).

**Measured frame times:** this repo's sandbox has no GPU (SwiftShader software GL), where a full-window high tier frame takes several hundred ms and the stage correctly starts on low. Real numbers need a real GPU: open a showcase with `?quality=high` and read `window.__stage` in the console.

## Stills (phones, reduced motion, no WebGL)

```
npm run build
npx astro preview                                  # serves http://localhost:4321
python scripts/showcase-stills.py                  # drone  -> public/showcase/drone/<id>(-800).webp/.avif
python scripts/showcase-stills.py --page robot     # robot  -> public/showcase/robot/<id>(-800).webp/.avif
npm run build                                      # the pages pick up the files at build time
```

The script needs Python Playwright (`pip install playwright`). It drives Google Chrome if it's installed and otherwise Playwright's own Chromium; `--executable` points it at any other Chrome or Chromium. It renders on the high tier (`?quality=high`) at 1600 × 1200 and writes, per feature, `<id>.webp` and `<id>.avif` at 1600 px (2x) and `<id>-800.webp` / `-800.avif` at 800 px (1x), through sharp. A transparent background (one file works on both themes), edges faded like the live view. The cards use a `<picture>` (AVIF, then WebP, with srcset and sizes), so each device downloads one size in one format; the largest 2x file is 89 KB.

## Dev hooks

- `?showcase=capture`: the 3D stage fills the window.
- `window.__showcase.go(n)`: show stop `n` without scrolling (and pose its animation). `go(null)` follows the page again.
- `window.__showcase.capture()`: the 3D alone as a PNG data URL.

## Reduced motion, phones, no WebGL, no JavaScript

- **Below 768 px, or `prefers-reduced-motion`:** a plain stack of cards, each with its still. No 3D is downloaded.
- **No WebGL:** the section gets `data-static`. The page's own picture (the `children`: the drone illustration, the robot photo `/assets/FRCnew.jpg`) shows above the same cards.
- **No JavaScript:** from 768 px the pinned layout shows the page's picture in the stage, beside the text. Below that, the cards with stills.
- The canvas is `role="img"` with the text file's `modelLabel`. The dots are links in tab order with a visible focus ring (`--ring`) and `aria-current="step"` on the current one. The floating labels are `aria-hidden` (the same words are the headings).

## Weight budget

Loaded only when the section comes into view, and only from 768 px up with motion allowed (gzip, from this build):

| Chunk | Size |
| :-- | :-- |
| three.js (shared with every 3D model on the site) | 143 KB |
| stage | 10.3 KB |
| quality tiers (high and medium only: shadows, GTAO, post-processing) | 11.4 KB |
| showcase driver | 3.2 KB |
| drone showcase + drone model | 2.8 KB + 3 KB, plus the CAD file `f450-cad.bin` |
| robot showcase + robot model (CAD data included) | 1.4 KB + 15 KB |

Keep the showcase code under about 10 KB gzip on top of the model, and the stills under about 120 KB each at 2x (they're 30 to 89 KB WebP, 20 to 48 KB AVIF). The pixel ratio comes from the tier (see above); the model views no longer cap it. The showcase code creates no objects per frame (only the label positions are written each frame).

# Home studio (the home page)

The home page is one 3D room the camera moves through as the page scrolls: `src/components/Studio.astro` (page,
text panels, ruler, keyboard, loop), `src/lib/studio/engine.ts` (camera), `room.ts` (shell, desk, helpers),
`stations.ts` (everything else), `scenes.ts` (where the camera stands for each scene). Words: `src/text/home.ts`,
`src/text/site.ts`, `src/text/studio.ts`; the projects and people come from their Markdown files.

| # | Scene | In the room |
| - | ----- | ----------- |
| 0 | Title | the desk from across the room; the lamp switches on |
| 1 | Sketch | the sketchbook draws the F450 from its real numbers |
| 2 | Research | the monitor scrolls the build guide (a screenshot of the real page) |
| 3 | Robotics, Drones, Networks, Web | KitBot on a cart (its CAD), the F450 on its landing mat, powered up but not flying: it has not flown yet (its CAD), a switch rack with blinking ports, a laptop and phone scrolling this site |
| 4 | Selected work | one panel per project on a curved wall; they turn to face you |
| 5 | Standards | the whiteboard writes out the standards and the three steps |
| 6 | Timeline | the long window, a year on each pane (2023 and 2024 tagged "Before JPL") |
| 7 | The team | the table, a chair and a portrait screen per member |
| 8 | Contact | the door opens a little; the lit sign says Let's talk |

After Contact the camera turns on the spot back to the desk and the scroll resets unseen: the loop (wheel, trackpad
and touch; keyboard users get a normal end). Anchors: `/#services` (Robotics), `/#work`, `/#team`, `/#contact`.

- **Camera:** a closed curve through the scenes' positions, a critically damped spring on the scroll, and a hold in the
  middle of each scene. It turns by heading and tilt (never by sliding a look-at point), so a 180° turn is clean.
- **Lights:** the room carries 8 (two hemisphere, the camera's key, fill and rim, the desk lamp, and two point lights that slide between scenes: the glow of what the camera is on, and a ceiling light above it; `src/lib/studio/lights.ts`). A point light costs every lit pixel, so the room used to be 14. Count them, draw calls and triangles with `window.__stage` in the console (`?quality=high`).
- **No hitches:** every shader is built before the first frame and again after the robot and drone CAD load (`ctx.precompile()`), the live screens redraw about 20 times a second, and while the page moves faster than about 1.5 scenes a second the camera's hold at each scene gives way, so a click on the ruler or a link to `/#contact` is one flight, not a stop at every scene on the way.
- **Read mode** (under 768 px wide or 560 px tall, taller than wide, reduced motion, Settings → Motion → Read mode, no WebGL): the same text as one page, with
  a picture of each scene: `public/studio/scenes/`, made by `python scripts/studio-stills.py` against a preview
  (`?studio=capture` hides the text; `window.__studio.go(n)` jumps the camera).
- **Screens:** `python scripts/studio-screens.py` refreshes the build guide and site screenshots on the monitor and laptop.
- `/studio/` (the Phase 1 prototype) redirects to `/`.

# Work page: the project wall

`/work/` is the home studio's project wall at full size: `src/components/WorkWall.astro` (page, scroll, keys, clicks),
`src/lib/three/models/work-wall.ts` (the panels on an arc, one lit edge, no lights), `src/lib/studio/panels.ts` (the
panel faces, shared with the studio). The stage is pinned while the page scrolls past it, so the wall moves with native
scrolling and nothing is hijacked; the panel in front lifts and its project's card shows. Click a panel (or press the
card) to open the project: the camera pushes into it, then the page changes. Left and Right arrows and the ruler move
along the wall. Under it is the plain list of the same projects as ordinary links (and read mode's whole page: under 768 px wide or 560 px tall, taller than wide,
reduced motion, no WebGL, or Settings). A new project is one file in `src/text/projects/` and the wall grows by itself.

# Accessibility and how it is checked

- **Contrast over pictures and the 3D scene is measured, not guessed.** axe cannot judge text over an image or a
  canvas, so `scripts/measure-contrast.mjs` + `measure-contrast.py` hide the words, photograph what is behind each
  text box and compute the WCAG ratio against the word's own colour. Every studio scene (both themes, 1440 and 768
  wide), the Work wall, About and the four project pages pass 4.5:1 (3:1 for large text). Re-run it after changing the
  glass, the scrims or the room's lighting. What makes it pass: the scene cards and rulers are glass with a strong
  tint (88 to 90% on the light theme), About's and the chapters' footage sits under a scrim from the text's side, the
  light theme's blue tags and ruler marks are darker blues.
- **axe-core** (run from outside the repo, `npm i axe-core`) reports no violations on any page, theme or width.
- **Every scene is in the accessibility tree and the tab order.** Inactive scenes are only transparent (and ignore the
  pointer), not hidden: a screen reader reads all twelve in order, Tab moves through every link and the camera follows
  the focus; the current scene is announced politely once the camera settles.
- **No JavaScript?** The studio and the Work wall start as ordinary pages; the switch to 3D runs before the first paint.
- **Chapter openers** (`src/components/ChapterBackdrop.astro`): each project page opens over slow footage of its own
  station (the studio renders in `public/studio/scenes/`), behind a scrim.
