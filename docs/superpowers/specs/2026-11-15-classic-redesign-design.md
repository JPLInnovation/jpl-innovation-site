# Redesign: the drawing set on glass

Date: 15 Nov 2026 · Branch: `classic-redesign` · Restore point: `jpl_site2` branch `rollback/before-redesign-2026-11-15`
Status: **approved by the owner on 15 Nov 2026** ("I want a full redesign of the website"), with one change: the FRC page
takes its inspiration from the team's own robotics site (section 12). Khoa's portrait received (`assets-src/members/khoa.jpg`).

## Why

The owner wants JPL Innovation to be "the most creative technology website", at the level of Awwwards winners, so that
visitors are surprised rather than judging it. It must not look AI-made ("unslop"), it must feel premium, and it must
always be smooth. Today every page is the same dark navy with small type, rows of identical cards, monospace labels and
large empty areas: the marks of a template.

## References the owner gave

Each reference is the bar to beat, not a model to copy. (Twelve in all: Studio Unlmtd, Lifetime Glass, Yeah Right, Pradip
Labs, Puture, Levi Gavrilut, Forge Automotive, RIY3, and for Members Tom de Koning, Jaspreet Singh, Douglus Nguyen,
JarnKet; each is described where it is used.)

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

### 1. The background: blueprint space (new, every page)

Reference: **Puture** (puture.co.kr), the closest to JPL in content: one continuous WebGL world for the whole page; an
endless blueprint grid floor with + marks; glossy tiles floating in it; a beam of blue light; the camera moves through
chapters as you scroll; the world flips from night to day at the Work chapter; projects stand on the floor as large
tilted screens that turn into view; words reveal one by one out of a blur with key words highlighted. Its weakness: the
floating tiles are generic app icons. **Ours goes further:** the floating pieces are JPL's real parts, and they assemble.

- **One world behind every page:** an endless drafting grid floor with + marks fading into depth, a slow beam of brand
  blue and gold light, the blue-to-gold field above it. The camera drifts through it with the scroll and leans a
  little towards the pointer.
- **Real parts, not icons:** small glass tiles float in the space, each carrying a real part of JPL's builds (the
  F450's motors, propellers, flight controller, Raspberry Pi 4, camera; the robot's Krakens and Limelight; the network
  switches), drawn from the real CAD and photographs in one texture atlas.
- **"Build it" in front of you:** on the home page's Build chapter the parts fly together and assemble into the real
  F450 (the exploded CAD the site already has), then hand over to the sheet about it.
- **Night and day:** the world flips from the dark blueprint (night) to paper and pale blue (day) at chosen chapters,
  the hard section switch, and the theme setting decides which one the page starts in.
- **The drawing sheets stand in this world:** on Work, each project's glass sheet stands on the grid floor and turns
  to face you as you pass it.
- Cheap by design: one canvas for the whole site, instanced tiles (60 at most), one draw for the grid, reduced
  resolution, paused when hidden or with reduce-motion, a still picture on devices that can't keep up. It replaces
  today's animated mesh and network canvas.

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
- Every section: heading, text and picture rise in turn (60 to 90 ms apart), once. Big statements reveal word by word
  out of a soft blur, with their key words marked in the accent. Every control: press, hover, focus.
- **Lights up from darkness** (reference: Forge Automotive): renders and photographs start dark and come up as if
  studio lights switched on, one after another; headlines wipe in letter by letter through a soft fade, with one word
  taking the accent; image panels slide past one another at different speeds; a picture opens from its frame.
- **Decoding headlines** on the project pages (reference: RIY3): a headline scrambles from random characters into its
  words, once, in under a second; big figures ("720p at 60 fps", "450 mm") count up.
- A small chapter marker bottom-left (the sheet's name, e.g. "Welcome", "Build", "Work") updates as you scroll.
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
| FRC | the competition sheet | see section 12 |
| Cybersecurity | the network diagram sheet | the topology as the plate; the CCNA lab kept |
| Lifetime | the software sheet | its real screenshots as the plates; the product's facts only (v1.2 marked as being built); COBACOM as partner |
| Members | the crew sheet | see section 10 |
| About | the founder's letter | a letter on a glass sheet with a tear-off strip carrying the email |
| 404 | a missing sheet | "This sheet isn't in the set", with the register to find your way |
| Footer | the back of the sheet | uncovered as the page slides up; the name at full width in living colour |

**Every project page opens with its case** (owner, 15 Nov 2026: "every project needs a hook first"), right after the
page's own opening (its intro or 3D chapter) and before the details. In this order: **the problem** (what goes wrong
without it); **why not just…** (the obvious alternatives, struck through like rejected options on a drawing, each with
its catch, named by kind, never by brand); **our answer** (one line in living colour, one paragraph); **what it gets
you** (the benefits as callouts); and **the partner** who takes it to people, when there is one (Lifetime: COBACOM).
Every claim comes from the project's own facts; no invented numbers, customers or comparisons. One component
(`ProjectCase.astro`), the words in `src/text/projects/hooks.ts`; a new project adds its case there.

The 3D studio's own home page is a separate project (Poly Haven models and the chat prompts); its header, footer and
other pages are these.

### 8. The showcases, in their element (owner's request)

Today the drone and the robot turn in front of a dark backdrop. Reference: **RIY3** (riy3.com), whose drone flies above a
city at night, through clouds at dusk, with live HUD telemetry and labelled close-ups of its parts: the machine in the
place it works. **Ours goes further:** both machines are real (their CAD), the sky is Saigon's, and the robot plays.

- **The F450 in the sky:** the drone chapter (`DroneChapter`, `drone-chapter.ts`) flies the F450 above Saigon at dusk:
  the generated sky and city below (chat prompt), soft cloud layers drifting past at different depths, the city's
  lights far below; a HUD in the corner with live simulated telemetry (altitude, heading, speed, 4G signal, the real
  720p at 60 fps); close-ups with labelled parts (flight controller, ESCs, Pi 4, camera) from its real CAD.
- **The KitBot on the FRC field:** the robot chapter (`FrcChapter`, `frc-chapter.ts`) stands the KitBot on a real FRC
  field: the 2026 field's carpet and lines (from `public/assets/2026-playing-field-page.webp`), a few of the season's
  field elements, the arena's lights and a softly blurred crowd behind (generated backdrop, chat prompt); the robot
  drives a short path and scores, then turns for its labelled close-ups (Krakens, hopper, intake, Limelight).
- Same rules as the rest: the backdrops are layered pictures with a little depth, not a heavy 3D scene; the model's
  own lighting matches the place (dusk sky, arena lights); 240 fps on the RTX, 60 on a laptop, a still on phones.

### 9. "Play the story" (About)

Reference: **Levi Gavrilut** (levigav.com): the visitor chooses an edition (two complete looks) and a language, then a
documentary plays: the camera flies over his mountains while subtitles write themselves ("This is Levi. He's
sixteen…"), and comes down into his room at night; chapters, a narrator, "Skip intro". **Ours goes further:** it is the
story of a team, told with its real photographs, CAD and builds.

- On About, **"Play the story"**: the founding of JPL in 2025 told as a short film, subtitles writing themselves over the
  real photographs, the sketchbook, the CAD and the builds; chapters (Saigon · the first sketch · the drone · the team ·
  next); "Skip"; it never blocks reading the page (the same story is on the page as text).
- **Editions:** the Glass / Solid switch (section 2) is our edition choice, offered once in the hook's last screen.
- **Later, if wanted:** a Vietnamese version of the site (Tiếng Việt), and a narrator voice made in the chat. Both are
  large; not part of this redesign unless the owner asks.

### 10. Members: the crew sheet, and one sheet per person

References: **Tom de Koning** (his cut-out portrait in a panel of orange light in front of a giant name; a details table
with one fun true stat, "craft beers discovered"; his name scrolling huge in the footer), **Jaspreet Singh** (a
cinematic photograph of him that turns from sunset to a starry night as you scroll; a handwritten name; his real life
and the quotes he lives by), **Douglus Nguyen** (from Saigon: his silhouette filled with ink-wash watercolour, huge
words split around his body; "From Vietnam with Love"), **JarnKet** (Laos: the greeting "ສະບາຍດີ", Lao weaving as the
whole design system, a hand-drawn map of Laos beside his intro, skills as a toolkit board, experience as a table). The
lesson of all four: every one is made from that person's own life. **Ours goes further:** two people on one engineering
sheet, each with their own journey drawn on the map of Vietnam, signed like engineers sign drawings.

- **Members page, the crew sheet:** two large cut-out portraits, each standing in a beam of the site's blue-gold light in
  front of their giant name; their roles (JPL and FRC 10951) in the drawing's "Drawn by / Checked by" block, each with a
  handwritten signature (the site's Caveat). Hover or focus on a person: their light comes up, the other dims to a
  silhouette, and their name runs across the sheet. Click: their own sheet opens from the portrait.
- **Each person's own page:**
  - "Xin chào, mình là Jayden." as the greeting, then the name at full width;
  - a hand-drawn map of Vietnam marking their places (Jayden: Quảng Trị and Nghệ An, the family's towns, and Saigon) with
    their path drawn along it as a route (Jayden: LEGO Mindstorms → Python → C++ → CCNA at VnPro);
  - a cinematic photograph of them that goes from day to night as you scroll (a real photograph only);
  - skills as a toolkit board with their real levels; achievements as a table; sports as their own panel (team, sport);
  - one fun true stat each, only from facts the owner gives (none invented);
  - the story from their file, revealed word by word.
- **Needed from the owner:** a real portrait of Khoa (today his page uses the team logo), a second, wider photograph of
  each (for the day-to-night picture), and the fun facts. Portraits are cut out from their background (Higgsfield's
  remove-background in the chat, or done here). Until a portrait arrives, Khoa's sheet shows his signature and initials
  large, never a made-up face.
- Text stays in `src/text/members/*.md`; new fields (places, fun fact, greeting) are added there for the owner to edit.

### 12. FRC: from the team's own robotics site

The owner's choice: the FRC page takes its inspiration from the Saigon South Dragons site the team already has (the
claude.ai artifact `U2PC5mq6Ud9RcCE7EvPfqv`), instead of the drawing-set look; every other page follows this document.
That site is a race weekend: an F1 "lights out" start; Anton display type in yellow `#f4b62a` and blue `#5b95f2` on
near-black; column lines drawn down the page as you scroll; rolling letters on buttons; a custom cursor with labels;
odometer counters; a statement with small photographs that come into colour as they pass; the robot in a draggable 3D
view with a "built with" wall; the route (Vancouver, Istanbul, then Honolulu and Istanbul); pinned history chapters with
a reel of photographs; a gallery slider; an agenda down which a car drives; the qualification ranks as a starting grid
with the team's slot lit; a photograph that opens to the whole screen; partner, outreach, workshop and families sections.

**Ours goes further, on the real page:** every section the page has today is kept (the FRC splash, the story, the
outreach rows, the photographs); its look and devices come from the team site, and:
- the car on the agenda is the **KitBot itself**, driving down the season's lane (its real CAD, small);
- the **robot showcase on the real field** (section 8) replaces the plain 3D view;
- the **starting grid** shows the real qualification ranks (19 of 44 in Vancouver, 16 of 40 in Istanbul) with
  "first-round pick" lit;
- the lights-out start becomes the page's own short intro (the existing FRC splash, restyled), skippable as all intros;
- it sits inside the site's header, footer, glass and motion rules, so it feels like a special edition of the same
  site, not another site. Fonts: Anton is added for this page only (self-hosted, display sizes only).

### 11. The hook: Pre-flight (both modes, 2D)

Reference: **Yeah Right** (yeahright.co): an elevator counter climbs to 100 and you click to enter; its city's greeting
"Ey up!" splits open; a line grows into the site's frame; a spinning sticker; jokes in his own voice; Pong in the
footer. It works because every piece is about him. **Ours goes further:** the counter is a real flight, the greeting is
Saigon's, the hand-off lands inside the 3D studio, and the footer game is a drone to land.

1. **Arming.** Near-black field, one ink. The F450's real wireframe (from its CAD) draws itself part by part, each part
   labelled as it appears, while a rolling ALTITUDE counter in giant wide type climbs 000 → 120 m ("climbing", then
   "cruise altitude"). A boot log runs in the corner with the drone's real checks: "frame 450 mm ok · ESC 4 of 4 · GPS
   lock · 4G link up · camera 720p60". (Reference: RIY3's loading screen, a drone wireframe with callouts and a boot
   log; ours is the real drone and its real numbers, and it ends in a flight, not a progress bar.) Optional sound, off
   by default: a soft rotor spin-up.
2. **Take off.** "Click, scroll or press any key to take off." Anything the visitor does enters.
3. **"XIN CHÀO!"** at full width splits open sideways (the letters part like the doors of a hangar).
4. Behind it: **SKETCH IT. BUILD IT. SECURE IT.**, with a spinning sticker "JPL INNOVATION · BUILDING STUFF IN SAIGON
   SINCE 2025".
5. A line draws itself into the edge of the first glass sheet, and the page is there. In 3D mode the altitude ends as
   the camera drops into the studio, one continuous move.

Rules: once per visit; skippable at any moment; reduce-motion gets a one-second still; it replaces today's logo intro;
nothing heavy loads during it; under 4 seconds before the take-off prompt.

**Personality lines,** in the site's own voice, only true ones, approved by the owner before they go live (suggestions:
"Powered by bánh mì", "We break drones so you don't have to", "Bench tested, not yet flown"). Stored in `src/text/`.

**Footer game: Land the drone.** In the footer, a small F450 drawn in line: hold Space (or press and hold on a phone)
for throttle, let go to drop, land it on the H pad gently. Best landing kept for the visit. Plain link fallback without
script.

## Part 2: the 3D studio (after the classic redesign, same approval)

Reference: **Pradip Labs** (pradiplabs.dev): one desk floating in warm darkness, lit by a lamp; soft rounded objects;
the devices are the navigation, and clicking one flies the camera in until its screen becomes a real working interface;
"back to the desk"; small delights (a diary, a speaker, a record player). It looks real not because of detail but
because of **light and restraint**. **Ours goes further:** the devices do real engineering, the room is a whole studio
with a city outside, and the Pre-flight hook flies you in.

- **Light first.** Warm pools of light from the desk lamp and the bench lamps, soft contact shadows, the rest of the room
  falling into darkness (dark theme) or soft daylight (light theme). Fewer, better objects in each view.
- **Real objects.** Poly Haven scans (done by Claude Code) and Higgsfield models (`assets-src/room/CHAT-PROMPT.md`),
  slimmed to keep 240 fps on the RTX and 60 on a laptop. Rounded edges everywhere; nothing blocky.
- **Devices you can enter** (click, the camera flies in, the screen becomes live HTML at full size, "Back to the studio"):
  - the **desk monitor**: the site's own Work register and pages;
  - the **test bench laptop**: the F450 ground station with live simulated telemetry, and the simulated flight;
  - the **network rack**: the CCNA terminal (the existing one), where visitors type real router commands;
  - the **FRC cart**: the robot's real CAD, which turns and explodes into its parts.
- **Small delights, JPL's own:** arm the drone on the bench (its props spin up, it never lifts off: it has not flown);
  the sketchbook draws itself; the whiteboard writes itself; the city's traffic below the window.
- **The window:** the generated Saigon panorama (night and dusk) from the chat prompt.

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
2. The Pre-flight hook, the footer and its game, Home (classic).
2b. The showcases in their element: the F450 in the sky, the KitBot on the field.
3. Work, the Drone, Mini drone and Cybersecurity pages; the FRC page from the team site (section 12).
4. Members (the crew sheet and each person's sheet), About with "Play the story", 404.
5. Motion pass, smoothness pass, both themes, phones.
6. Part 2, the 3D studio: light, real objects, the devices you can enter, the window.
