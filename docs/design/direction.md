# Design direction: night-sky lab

**One line:** a creative, hand-built engineering site, not a standard template. The team's real machines (the F450,
the KitBot, the lab network) float in a deep blue night sky full of stars and shooting stars, lit like a product
shoot, with confident wide type and motion you can feel.

**Owner's call (21 October 2026):** Jayden keeps the site's own colour theme, the animated star sky and the font
colours. A trial "build bench" palette (paper, graphite, a drafting grid, a mono spec font) was built and reverted the
same day because it looked too much like a standard website. The goal for every change from here: people should look
at it and see something creative and highly customised.

## The three dials

| Dial | Setting | What it means here |
| :-- | :-- | :-- |
| Energy | 8 / 10 | Bold. The star sky is always alive behind the page; every page has a signature moment (the portal through J P L, the burn intro, the drone's parts flying together). |
| Rhythm | Alternating | Big cinematic stages (3D, full-bleed photos) alternate with readable text blocks, so the loud parts land and the reading parts rest. |
| Motion | 8 / 10 on 3D and intros, 5 / 10 on chrome | The models move like a product film: curved camera paths, eased arrivals, a light sweep, an exploded view. Interface motion is short and purposeful: reveal on entry, respond on press. |

## Palette (kept as it was)

Blue primary, cyan accent, violet only in gradients and the sky, cool blue-white surfaces in light, deep navy in dark.

| Token | Light | Dark | Use and contrast |
| :-- | :-- | :-- | :-- |
| `--background` | `#eef3fd` | `#050a1f` | the page and the sky behind it |
| `--foreground` | `#0a1a33` | `#e6edf8` | text: 15.6 : 1 light, 16.7 : 1 dark |
| `--muted-foreground` | `#475569` | `#94a3b8` | secondary text: 6.8 : 1 light, 7.7 : 1 dark (7.0 on cards) |
| `--primary` | `#1d4ed8` | `#2563eb` | buttons, links: white on it 6.7 : 1 / 5.2 : 1 |
| `--accent` | `#22d3ee` | `#22d3ee` | highlights and live markers, with `#04202b` text on it (9.3 : 1); as text on dark 10.9 : 1 |
| `--highlight` | `#7c3aed` | `#8b5cf6` | violet, only inside gradients (buttons, contact band, the sky's glow) |
| `--ring` | `#1d4ed8` | `#38bdf8` | focus rings (9.2 : 1 on the dark page) |

The FRC alliance colours and the chart hues are data colours and stay as validated. The sky's stars and glows are kept
faint so text stays AA even with a star directly behind it.

## Type (kept)

**Archivo** variable, self-hosted through Fontsource. Its width axis carries the hierarchy: 125 % wide and heavy for
display (a stamped, machine-plate feel that suits hardware), 100 % for reading. One family, preloaded, no new font
bytes.

## Layout

- One 76 rem column; big wide headings; sections separated by hairlines and the card band (`bg-card/70`).
- Wide stages for the 3D and the main photos: the showcases run to the window edge with soft faded edges, so the
  hardware is the biggest thing on the page.
- Cards only for things you open (projects, members). No bento filler, no invented stats.
- Phones (375 px): one column, nothing wider than the screen, 44 px tap targets.

## Motion

- **The sky**: drifting blue and violet washes, a starfield with shooting stars and a cursor glow (src/scripts/
  background.ts). It is the site's signature; it pauses in hidden tabs and goes still under reduced motion.
- **Reveal on entry**: rise and fade, once, to mark where a section starts.
- **3D camera**: curved paths around the model (great-circle turns that swing out and up on wide moves), a quintic
  ease into each stop, a hold while you read.
- **Opening beats**: the drone's parts fly together under a sweeping light; a FUEL ball rides through the KitBot.
- **Exploded view**: the drone pulls apart on the flight controller and power stops, scrubbed by the scroll.
- `prefers-reduced-motion`: no camera travel, no reveals, a still sky, stills for the showcases on phones.

## How it ties to the work

- The night sky and the cyan come from the team's own world: the drone's 4G link to the sky, the logo's cyan.
- The 3D is lit like a product shoot (key, fill and rim lights, a studio environment, soft contact shadows, ambient
  occlusion, real material finishes) because the work is physical: the plates, screws and wires should look real.
- Logos are untouched.

## Avoid

Making it look like a standard template: plain paper-and-ink palettes, generic grids of identical cards, stock
illustrations, fake stats or testimonials, uppercase eyebrow labels on every heading, em dashes.
