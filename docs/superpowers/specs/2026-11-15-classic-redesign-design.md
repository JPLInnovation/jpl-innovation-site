# Redesign: the drawing set on glass

Date: 15 Nov 2026 · Branch: `classic-redesign` · Restore point: `jpl_site2` branch `rollback/before-redesign-2026-11-15`
Status: **waiting for the owner's approval.** Nothing below is built yet.

## Why

The owner wants JPL Innovation to be "the most creative technology website", at the level of Awwwards winners, so that
visitors are surprised rather than judging it. It must not look AI-made ("unslop"), it must feel premium, and it must
always be smooth. Today every page is the same dark navy with small type, rows of identical cards, monospace labels and
large empty areas: the marks of a template.

## References the owner gave

- **Studio Unlmtd** (studio-unlmtd.com, an award site): gigantic heavy headlines set tight, with living colour flowing
  inside the letters (drawn in WebGL canvases); smooth momentum scrolling (Lenis); hard switches between black and
  white sections; full-width project pictures; very large portraits. Taken: the scale, the living colour in the type,
  the smooth scroll, the hard section switches. Not taken: its rainbow colours (ours are the brand's blue and gold).
- **Lifetime's Glass style** (`D:\Dev\Lifetime-merge`, `lifetime_glass.py`): translucent panels with a light edge, a
  glass sidebar whose pill slides and stretches towards the page you pick, a deep blue-to-gold background, a light
  version. The owner wants the website to have a glass version, **better than Lifetime's**.

## The idea

**The site is JPL's drawing set, drawn on glass.** Engineers deliver a project as a set of drawing sheets, and they used
to draw them on drafting film: a frosted, see-through sheet. Each page of the site is one sheet of that set, made of
frosted glass film over a living blueprint background. On each sheet: the drawing itself, very large (the real
sketches, the 4K CAD renders, the photographs); a title block (project, drawn by, checked by, date, revision); and the
parts lists as real tables. JPL's own line, "Sketch it. Build it. Secure it.", is the order of the set.

Competitor test: another student robotics club's site could not say this; the sheets carry JPL's own drawings, parts
and people.

**The live thing:** on the home page, one drag (or the arrow keys) scrubs the F450 from its pencil sketch, through its
CAD render, to the real drone. The three verbs of the line in one picture.

## What changes, all of it (for approval)

### 1. The background: a living blueprint (new, every page)

- A slow WebGL field in the brand's deep blue and gold, like light moving through drafting film: depth, not blobs. It
  drifts very slowly, bends a little towards the pointer, and changes its light with the scroll (deeper blue on the
  drawings, warmer gold near the contact).
- Very faint drafting detail in it at the edges of the screen only: a fine grid that fades in where the light is, so it
  reads as a blueprint without ever sitting behind text.
- Cheap by design: one full-screen draw at reduced resolution, paused when the tab is hidden or the visitor asked for
  less motion, a still image on phones that can't keep up. It replaces today's animated mesh and network canvas.
- Light theme: the same field in paper, pale blue and warm gold, as Lifetime's light glass.

### 2. Glass, better than Lifetime's (new)

What Lifetime has: translucent panels, a light edge, a sliding pill. What the site adds:

- **Real refraction:** the glass bends what is behind it at its edges (an SVG displacement lens, on browsers that
  support it; plain frosted glass elsewhere), so it reads as a thick sheet, not a tinted box.
- **A light edge that follows the pointer:** the rim catches the light on the side nearest the pointer.
- **The liquid pill:** in the header, the pill under the current page stretches like a drop towards the link you point
  at, then settles (Lifetime's pill, made liquid). The same pill drives the Classic/3D switch and the theme switch.
- **Depth by thickness, not shadows:** thicker glass for the sheets, thinner for the title blocks, no drop shadows.
- **A Glass / Solid switch** in Settings, as in Lifetime: Glass is the default on capable computers; Solid (flat filled
  sheets) is used on weak devices, with reduce-motion, or when chosen. Text contrast is checked in both.

### 3. Type: big and alive (new)

- Archivo (already self-hosted, nothing new to download): its extra-wide heavy cut for display, set very large (up to
  12 to 15vw) and tight, as Studio Unlmtd does; the normal width for text at 16 to 19px.
- **Living colour in the big words:** the main headline of each page carries the blue-to-gold light of the background
  moving inside its letters (a mask over the same WebGL field, so it costs almost nothing). Brand colours only.
- One family, five sizes at most. No monospace labels, no little labels above headings, no 01 / 02 numbering.

### 4. Colour

| | Field (behind the glass) | Glass sheets | Ink | Accent |
|---|---|---|---|---|
| Dark | deep navy `#0A174E` to night blue, gold light | frosted dark film | paper `#F2EEDF` | brand yellow `#F5D042` |
| Light | paper `#F2EEDF`, pale blue, warm gold | frosted white film | navy `#0A174E` | brand blue `#2F7CE6`, yellow for one mark |

If the blue-and-yellow light theme on its branch is kept later, only these tokens change.

### 5. Motion and scrolling (new)

- **Smooth momentum scrolling** across the site (Lenis-style, written in a few lines, or the library if it is already
  installed), off with reduce-motion.
- **Hard section switches** like Studio Unlmtd: some sections flip the page from dark glass to paper and back.
- Signature moves: the **curtain footer** (the page slides up to uncover the footer); the **plate that opens** from a
  framed picture to the full screen on each project page; the liquid pill.
- Every section: heading, text and picture rise in turn (60 to 90 ms apart), once. Every control: press, hover, focus.
- Transform and opacity only; reduce-motion keeps the content and drops the travel.

### 6. Pictures

- Real first: the 4K CAD renders (robot, drone), the FRC photographs, the sketchbook page, the dashboard screenshots,
  the team photos, used large (whole-screen plates, half-screen at least on project pages).
- **Better images for the Work section:** a new hero plate per project. Real renders and photographs where they exist;
  where they don't (Cybersecurity, the Mini drone), images generated in the owner's Claude chat with Higgsfield
  (prompts in `assets-src/room/CHAT-PROMPT.md`), clearly pictures of the work, never fake photographs of people or events.

### 7. Page by page

| Page | Sheet | What it shows |
|---|---|---|
| Header | the glass border strip | wordmark left, 3 links in the liquid pill, one action; Settings |
| Home (classic) | the title sheet | the name at full width in living colour; the sketch → CAD → photo scrubber; the three verbs as three whole-screen plates (drone, robot, network) |
| Work | the drawing register | a big register table (project, discipline, status, revision) whose rows open into whole-width picture plates |
| Drone, Mini drone | general arrangement sheets | the render as a full plate; the title block; the parts lists as real tables; the specs as a total with its receipt (real numbers only) |
| FRC | the competition sheet | team photo plate, the events as a route, the robot CAD plate; the outreach rows kept |
| Cybersecurity | the network diagram sheet | the topology as the plate; the CCNA lab kept |
| Members | the "drawn by / checked by" block | each person as a signature row with a large portrait and their role |
| About | the founder's letter | a letter on a glass sheet with a tear-off strip carrying the email |
| 404 | a missing sheet | "This sheet isn't in the set", with the register to find your way |
| Footer | the back of the sheet | uncovered as the page slides up; the name at full width in living colour |

The 3D studio's own home page is a separate project (Poly Haven models and the chat prompts); its header, footer and
other pages are these.

## Kept, without exception

Every section, link and form; the FRC outreach rows; the CCNA lab; the parts tables; the model viewers; the logo
intros; the Settings panel (theme, motion, quality, Classic/3D); the email dialog; all wording, which stays in
`src/text/` (one file per page) for the owner to edit.

## Not wanted (the "AI look" that fails this even if it works)

Rainbow or purple-blue "AI" gradients, neon glows, sparkles, floating blobs, rows of identical icon cards, little
monospace labels, 01/02/03 numbering, emoji, fake dashboards. Glass and the colour field are the two deliberate
exceptions to the design skill's no-glass and no-gradient rules, at the owner's request, and each has one job.

## Smoothness (a requirement, measured)

- 60 fps on an ordinary laptop, the screen's full rate (240 Hz) on the RTX, measured on the real GPU after each page.
- One WebGL field shared by the background and the living type; paused off screen; reduced resolution; a still on weak
  devices. Glass refraction only where supported and only on a few large sheets, not on every element.
- Nothing heavier to download than today.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | **The drawing set**, now on glass film | The most JPL; needs careful detail to feel crafted |
| B | Pinned title over full-screen photographs | The most cinematic; heavy on long pages |
| C | Loud flat poster | The most surprising; less serious engineering |

## Constraints

Astro + React islands + Tailwind as now; no framework change; no new dependency unless already installed (smooth scroll
can be written by hand). Checked with the design skill's inspector at 1440, 768 and 390 px, screenshots read after every
change, frame rates measured on the RTX.

## Order of work (after approval)

1. Tokens, type, the background field, glass and the header (seen on every page at once).
2. Footer and Home (classic).
3. Work and the four project pages.
4. Members, About, 404.
5. Motion pass, smoothness pass, both themes, phones.
