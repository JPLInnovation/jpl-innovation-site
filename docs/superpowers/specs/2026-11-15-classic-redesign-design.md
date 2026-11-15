# Classic mode redesign: the drawing set

Date: 15 Nov 2026 · Branch: `classic-redesign` · Restore point: `jpl_site2` branch `rollback/before-redesign-2026-11-15`

## Why

The owner wants JPL Innovation to be "the most creative technology website", at the level of Awwwards winners, so that
visitors are surprised rather than judging it. Today every page is the same dark navy with small type, rows of identical
cards, monospace labels and large empty areas: the marks of a template.

## The idea

**The site is JPL's drawing set.** Engineers deliver a project as a set of drawing sheets: each sheet has the drawing
itself, very large; a title block in its corner (project, drawn by, checked by, date, revision); and parts lists set as
real tables. JPL's own line is "Sketch it. Build it. Secure it.", and it has real sketches (the F450 sketchbook page),
real CAD (4K renders of the robot and the drone), real parts lists and real photographs. Each page of the site is one
sheet of that set.

Competitor test: another student robotics club's site could not say this; the sheets carry JPL's own drawings, parts and
people.

**The live thing:** on the home page, one drag (or the arrow keys) scrubs the F450 from its pencil sketch, through its
CAD render, to the real drone, the three verbs of the line in one picture.

## Goals

- Every tab redesigned: Home (classic), Work, Drone, Mini drone, FRC, Cybersecurity, Members, About, plus the header,
  footer and 404. These pages are shared with the 3D mode, so the 3D mode's pages change too.
- Award-level: large type, real pictures used large, one idea carried into every section, a signature motion.
- Smooth: 60 fps on an ordinary laptop, the 240 Hz target on the RTX; nothing heavier than today.
- Both themes.

## Non-goals

- The 3D studio itself (the home page in 3D mode), its room and its HUD: a separate project (Poly Haven models next).
- New content. Wording stays in `src/text/` (one file per page), so the owner can edit it.

## Anti-goals (a failure even if it works)

- Any content or feature lost: every section, link, form, the FRC outreach rows, the CCNA lab, the parts tables, the
  model viewers, the intros and the settings panel all remain.
- A drawing "costume": lines and crop marks everywhere. The drawing lives in the pictures and the tables; the page
  around them is flat filled sheets.
- Slower than now.

## Constraints

- Astro + React islands + Tailwind, as now; no framework change, no new dependencies unless already installed.
- House rules of the design skill: no monospace (except real code), no eyebrow labels, no 01/02 numbering, no glass
  panels, no gradients, no shadows at rest, no thin rules outside tables. Tables (title blocks, parts lists) may keep
  their lines, that is what they are.
- Text from `src/text/`; images from `public/`.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | **The drawing set**: every page a drawing sheet | The most JPL; needs careful detail to feel crafted |
| B | Pinned title over full-screen photographs | The most cinematic; heavy on long pages; needs strong images for every project |
| C | Loud flat poster | The most surprising; reads less like serious engineering |

The owner picked A.

## The look

- **Sheets on a field.** Each section is a filled sheet (square corners, real edges: a straight edge, a perforated edge
  of round dots, a torn-off stub) on a flat field. No outlined boxes.
- **Colour (the brand's own, decided by Claude):**
  - Dark theme: field `#0A174E` (the logo's navy), sheets in drafting paper `#F2EEDF`, ink `#0A174E`, accent the brand
    yellow `#F5D042` (the one action and one mark per screen).
  - Light theme: field `#F2EEDF` paper, sheets white, ink `#0A174E`, accent the brand blue `#2F7CE6`, with yellow kept
    for the one mark.
  - If the blue-and-yellow light theme on its branch is kept later, only these tokens change.
- **Type:** Archivo (already self-hosted, so no new download) in one family: the extra-wide cut for display, as
  engineering lettering is wide; the normal width for text. Five sizes at most; the largest about 9 to 12vw.
- **Pictures, real ones first:** the 4K CAD renders (robot, drone), the FRC photographs, the sketchbook page, the
  dashboard screenshots, the team photos. Gaps filled later by generated images made in Cowork.

## Page by page

| Page | Sheet | What it shows |
|---|---|---|
| Header | the sheet's border strip | wordmark left, 3 links, one action; plain, no glass |
| Home (classic) | the title sheet | the name at full width; the live sketch → CAD → photo scrubber; the three verbs as three large plates (drone, robot, network) |
| Work | the drawing register | a large register table (project, discipline, status, revision) whose rows open into big picture plates |
| Drone, Mini drone | general arrangement sheets | the render as a full plate; the title block; the parts lists as real tables; the specs as "total and its receipt" (only real numbers) |
| FRC | the competition sheet | team photo plate, events as a route, the robot CAD plate, outreach rows kept |
| Cybersecurity | the network diagram sheet | the topology as the plate, the CCNA lab kept |
| Members | the "drawn by / checked by" block | each person as a signature row with their portrait and role |
| About | the founder's letter | a letter on a sheet with a tear-off strip carrying the email |
| Footer | the back of the sheet | revealed as the page slides up (curtain footer), the name at full width |

## Motion

- Signature: the curtain footer, and on each project page the plate that opens from a framed picture to the full screen.
- Every section: heading, text and picture rise in turn (60 to 90 ms apart), once.
- Every control: press, hover, focus.
- Transform and opacity only; `prefers-reduced-motion` keeps the content and drops the travel.

## Left to the builder

Exact section compositions within the sheet idea, sizes, which plate gets which picture, the perforation and stub
shapes, and the order of sections where `src/text/` allows. Checked by the design skill's inspector at 1440, 768 and
390 px, screenshots read after every change, and frame rates measured on the RTX.
