# Design direction: the build bench

**One line:** the site is a lit workbench and its datasheet. The real machines (the F450, the KitBot, the lab
network) sit under studio light in 3D, and every word around them reads like a well kept engineering sheet: big
confident type, exact numbers in mono, hairline rules, nothing decorative that a build log wouldn't have.

## The three dials

| Dial | Setting | What it means here |
| :-- | :-- | :-- |
| Energy | 6 / 10 | Confident and calm. One loud moment per page (the portal, the burn intro, a model turning), then quiet reading. No looping decoration competing with the hardware. |
| Rhythm | Alternating | Dense datasheet blocks (specs, steps, parts) alternate with wide quiet stages where a model or a photo gets the whole width. Section spacing is generous and consistent, so the dense parts feel deliberate. |
| Motion | 7 / 10 on 3D, 4 / 10 on chrome | The models move like a product film: curved camera paths, eased arrivals, a light sweep. Interface motion is short and functional: reveal on entry, respond on press, never bounce. |

## Palette

Neutral, slightly warm greys (machined aluminium and drafting paper), near-black ink, and the logo's own cyan as the
single signal colour. A safety orange marks only *live* or *current* things (a status dot, the current step, the
active showcase stop), the way a tag marks a part on a bench. No violet, no blue-to-purple gradients, no glow.

### Light ("paper")

| Token | Value | Use | Contrast |
| :-- | :-- | :-- | :-- |
| `--background` | `#f2f1ed` | page | |
| `--foreground` | `#121416` | text, ink buttons | 16.3 : 1 on background |
| `--card` | `#fbfaf8` | raised surfaces | ink 17.7 : 1 |
| `--muted` | `#e8e6e0` | wells, image beds | |
| `--muted-foreground` | `#575b60` | secondary text | 6.0 on bg, 5.5 on muted, 6.6 on card |
| `--border` | `#d6d3cb` | hairlines (decorative) | |
| `--rule` | `#7d8085` | lines that carry meaning (timeline, inputs) | 3.6 : 1 on bg |
| `--accent` | `#1fb5d9` | signal fills (logo cyan) | ink on it 7.6 : 1 |
| `--accent-ink` | `#00718a` | cyan text and links on paper | 5.0 on bg, 5.8 on card |
| `--marker` | `#ff5a1f` | live / current fills | ink on it 5.9 : 1 |
| `--marker-ink` | `#b33d0b` | orange text | 5.2 on bg |
| `--primary` | `#121416` | primary buttons (ink) | white on it 18.5 : 1 |

### Dark ("graphite")

| Token | Value | Use | Contrast |
| :-- | :-- | :-- | :-- |
| `--background` | `#0c0d0e` | page | |
| `--foreground` | `#ecebe7` | text, light buttons | 16.3 : 1 |
| `--card` | `#151719` | raised surfaces | 15.1 : 1 |
| `--muted` | `#1c1f21` | wells | |
| `--muted-foreground` | `#a0a4a8` | secondary text | 7.8 on bg, 7.2 on card, 6.6 on muted |
| `--border` | `#2a2e31` | hairlines | |
| `--rule` | `#5d6266` | meaningful lines | 3.2 : 1 |
| `--accent` / `--accent-ink` | `#3cc6e8` | signal fills and cyan text | 9.7 : 1 on bg; ink on it 9.7 : 1 |
| `--marker` / `--marker-ink` | `#ff6b30` | live / current | 6.9 : 1 |
| `--primary` | `#ecebe7` | primary buttons (light on graphite) | ink on it 16.3 : 1 |

The FRC alliance red and blue and the four chart colours are data colours; they stay exactly as validated before.
Photo overlays (the home portal's photo, the FRC reveal) sit on a fixed graphite field (`--hero-field: #101214`),
white text 18.8 : 1.

## Type

- **Archivo** (variable, width axis, already self-hosted through Fontsource): display at 112 to 125 % width,
  weight 800 to 900, tight tracking. A grotesque with a wide cut reads like stamped nameplates and machine
  lettering, which suits hardware. Body at 100 % width, 400, 1.6 line height.
- **Geist Mono** (variable 400 to 600, latin, 23 KB, OFL, self-hosted in `public/fonts/`): every number that is a
  measurement or spec, part names on the 3D labels, captions, step numbers and status tags. Mono numbers line up in
  columns like a datasheet and make "10 x 4.5 in" or "3S 2200 mAh" feel measured rather than marketed.
- Sentence case everywhere. No uppercase eyebrow labels over headings; a heading stands on its own. Mono is used
  small and in sentence case too.
- Fonts on a typical page: Archivo latin 90 KB + Geist Mono 23 KB = 113 KB, both preloaded, `font-display: swap`.

## Layout

- One 76 rem column with a 12 track grid; sections are separated by full width hairlines, not boxes.
- Datasheet blocks: label in mono on the left, value on the right, a hairline between rows. Used for specs,
  facts, steps and the parts list.
- Wide stages: 3D models and the main photos run edge to edge or bleed off one side, with soft faded edges, so the
  hardware is the biggest thing on the page.
- Cards only where a thing is a separate object you can open (a project, a member). No bento grids, no filler tiles,
  no stat counters that the team hasn't measured.
- Phones (375 px): single column, nothing wider than the screen, tap targets 44 px and up.

## Motion

Every animation has one job:

- **Reveal on entry** (opacity + 16 px rise, 0.6 s, out-expo): tells the eye where the new section starts. Once only.
- **Hero choreography**: the portal flies through J P L into the build photo (kept); the copy then arrives line by
  line so the photo lands first.
- **3D camera**: moves on curved paths around the model (spherical interpolation of direction and distance), eases
  into each stop and holds, so the part being described is still while you read about it.
- **Opening beats** in the showcases (inside the first stop's scroll): a light sweep across the drone; a FUEL ball
  flying through the KitBot. They show what the machine does before the parts list starts.
- **Exploded view** of the drone, scrubbed by scroll on the stops where seeing inside helps.
- **Press feedback**: buttons and cards respond on pointer down (scale 0.97), so the click feels mechanical.
- **Nothing loops in the chrome.** The old drifting gradient wash, starfield and cursor glow are gone; the page
  background is a still drafting grid that is only visible near the top of a page.
- `prefers-reduced-motion`: no camera travel (cuts between stops), no reveal motion, no opening beats, stills for
  the showcases on phones; everything still readable and reachable.

## How it ties to the work

- The palette is a workbench: paper, ink, aluminium, a cyan the team already uses in its logo, and an orange tag.
- The mono type is the language of the build guide's parts list and the IOS console on the cybersecurity page.
- The 3D is lit like a product shoot (key, fill, rim, a studio environment, real contact shadows and ambient
  occlusion) because the team's work is physical: the point is to see the plates, screws and wires as they are.
- Logos are untouched: the JPL Innovation logo and the Team 10951 dragon keep their own colours.

## Things this design avoids on purpose

Purple-to-blue gradients, glassmorphism, glow on everything, bento grids, fake stats or testimonials, uppercase
eyebrow labels on every heading, em dashes.
