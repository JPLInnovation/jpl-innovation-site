# Showing the site: a checklist

For presenting the site on a laptop, a projector or a big screen. Everything here was tested; the last section says
what could not be.

## Before (10 minutes, ideally the evening before)

1. **Use the newest Chrome or Edge.** It is the browser the site was tested in most. Safari and Firefox should work
   but were not tested on a real machine.
2. **Plug the laptop in** and turn off battery saver (Windows: power mode *Best performance*; Mac: Low Power Mode off).
   On battery, laptops slow the graphics card down and the 3D drops frames.
3. **Open <https://jpl-innovation.github.io/> once and hard refresh** (Ctrl+Shift+R, or Cmd+Shift+R on a Mac).
   GitHub Pages keeps pages for a few minutes, so a hard refresh makes sure you see the newest version.
4. **Full screen** (F11, or Ctrl+Cmd+F on a Mac) at 100% zoom. Close video calls and other heavy tabs.
5. **Check the internet.** The site is self-contained once its first page has loaded (fonts, models and pictures all
   come from the site itself), with one exception: the **3D layout** page of the drone
   (`/work/drone/3d-layout/`) loads three.js from a public CDN, so it needs internet to draw its 3D. Without it the
   page still shows its parts and wiring lists and says so.

## Moving around the home page

| Do | Keys |
| :-- | :-- |
| Next scene | scroll down, ↓ → PageDown, Space (a slide clicker's "next" works) |
| Previous scene | scroll up, ↑ ← PageUp, Shift+Space |
| First / last scene | Home / End |
| Jump to a scene | the ticks of the ruler at the bottom of the screen |

The room has twelve scenes (the ruler names them): JPL Innovation, Sketch, Research, Robotics, Drones, Networks, Web,
Selected work, Standards, Timeline, The team and Contact. It loops: after the last one, *Back to the start* returns
to the title.

A suggested three minutes: the home page's scenes at a calm pace, then **Work** (the curved project wall), one project
(the F450 drone: 3D showcase, build guide, Camera POV dashboard), then **Members** and **About**.

## If something looks wrong

| You see | Do |
| :-- | :-- |
| Choppy movement | Settings (gear, top right) → **3D quality → Low**. Or open the address with `?quality=low` on the end. |
| Blank page | Wait up to 30 seconds: if the 3D never starts, the site switches itself to the plain page. Or press F5. |
| A weird scene | Settings → **Motion → Read mode**: every page becomes one ordinary page with the same words. |
| No 3D at all (remote desktop, some virtual machines) | Nothing to do: the plain page appears by itself. |
| Something is broken after a change | `git revert <commit>` and push. The last state tested before the final pass is the branch `rollback/known-good-2026-10-22`. |

**Plan B without internet:** on any computer with Node installed, `npm ci && npm run build && npx astro preview`, then
open <http://localhost:4321/>. (Open it by `localhost`, not by the computer's network address: a few things, such as
the *Copy* button in the email pop-up, only work on `localhost` or `https`.)

## What was checked, and what could not be

Checked on the final build, in headless Chrome on a software renderer: every page at 375, 768 and 1440 px wide in
light and dark (no errors, no sideways scrolling); the automatic accessibility checker (no violations); all three 3D
quality levels at 1920×1080; failure drills (a 3D model that fails, a lost graphics context, a slow device, scripts
that never arrive); no JavaScript; reduced motion; throttled networks; phone and tablet shapes; keyboard-only use.

**Could not be checked here, so please look at them yourself:**

- How smooth it is on the real graphics card. The software renderer is far slower than any real laptop, so frame
  rates measured here say nothing about yours. The automatic quality levels are there for exactly this.
- Safari and Firefox on real machines.
- Sound. The Settings panel shows it as "comes later"; nothing plays.
- The FRC robot text only says what the CAD shows. Speeds, weights and motor controllers still need the team's
  confirmation (Khoa and Jayden).
