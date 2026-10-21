# Scroll showcase

A 3D model that turns to each feature as its text scrolls past. It runs on two pages:

| Page | Section | Words | Model |
| :-- | :-- | :-- | :-- |
| `/work/drone/` | Part by part | `src/text/showcase/drone.ts` | `src/lib/three/models/drone-showcase.ts` |
| `/work/frc/` | The 2026 robot in 3D | `src/text/showcase/robot.ts` (heading and intro: `frcPage.model3d` in `src/text/projects/frc.ts`) | `src/lib/three/models/frc-robot-showcase.ts` |

## How it works

- **`src/components/showcase.tsx`**, the island (`client:visible`). It renders all the text on the server: heading, intro, one `<article>` per feature, and a row of dots that are real `#id` links. From 768 px up, with motion allowed, the 3D stage stays pinned (beside the text from 1024 px, above it below that) while the features scroll in normal flow. The page scrolls natively. Each frame reads `scrollY` once against offsets measured when anything on the page changes size, so it never forces a layout. Nothing goes through React state per frame.
- **`src/lib/three/showcase.ts`** drives the 3D inside the shared stage's animation frame (`src/lib/three/stage.ts`, which pauses off screen and in hidden tabs):
  - **Camera:** follows the scroll position through a critically damped spring (about 0.4 s, never overshoots, exact for any frame length). It holds still near each stop and eases between stops. A fast jump (a dot) glides past the stops in between instead of pausing at each one.
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

## Stills (phones, reduced motion, no WebGL)

```
npm run build
npx astro preview                                  # serves http://localhost:4321
python scripts/showcase-stills.py                  # drone  -> public/showcase/drone/<id>.webp
python scripts/showcase-stills.py --page robot     # robot  -> public/showcase/robot/<id>.webp
npm run build                                      # the pages pick up the files at build time
```

The script needs Python Playwright (`pip install playwright`). It drives Google Chrome if it's installed and otherwise Playwright's own Chromium; `--executable` points it at any other Chrome or Chromium. Pictures are 1200 × 900 with a transparent background (one file works on both themes), with their edges faded like the live view.

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
| stage | 7.8 KB |
| showcase driver | 2.9 KB |
| drone showcase + drone model | 2.2 KB + 2.3 KB, plus the CAD file `f450-cad.bin` |
| robot showcase + robot model (CAD data included) | 1.4 KB + 14.9 KB |

Keep the showcase code under about 10 KB gzip on top of the model, and the stills under about 90 KB each (they're 22 to 70 KB now). Rendering is capped at 1.5× device pixels (`pixelRatio` in the model's `view`) to hold 60 fps on a laptop. The showcase code creates no objects per frame (only the label positions are written each frame).
