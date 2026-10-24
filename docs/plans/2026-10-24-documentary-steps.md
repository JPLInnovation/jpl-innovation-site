# Documentary redesign: the next three steps

From Jayden's answers on 24 Oct 2026 to "JPL Innovation: The Documentary — Site Redesign Plan" (the PDF).
Each step is on its own branch and goes live only after Jayden says OK. Push to all three repos: old-origin (live),
origin (backup), https://github.com/jpl-innovation/jpl_site2. Show screenshots, then wait.

Settled decisions: no Blender (the room stays built in code) · Archivo Wide · sideways camera only on Home and the
chapters · light and dark themes · sound later · no new libraries · drone first · launch on jpl-innovation.github.io.
All wording lives in src/text/. Never invent facts: if one is missing, add a marked TODO and list it in the report.

**If the live site breaks after a deploy:** revert the merge (a new revert commit, never a force-push) on all three
repos and tell Jayden straight away.

**Frame rate:** headless Playwright renders in software, so its frame rate says nothing about the Iris Xe. Jayden
checks the frame rate himself on his laptop before he says OK.

---

## Step 1: hook, regionals, slogan, bio (branch `phase-0-hook`)

Done (commit on the branch):
- [x] FRC 2027 (src/text/projects/frc.ts `season2027`): Kickoff "Jan 9, 2027", the game is "BIOCORE presented by
      Haas"; Competitions "Mar – Apr 2027: Hawaii Regional, March 18–21. Marmara Regional, April 2–4." with a
      TODO for the venues and cities. **Every other FRC fact stays as it is** (Jayden is checking them with Khoa).
- [x] Jayden's bio (src/text/members/jayden.md): "robotics, mechanical design, networking and C++".

To do:
1. **Hook text** in src/text/home.ts, word for word, as `hook = { heading, lines, lampLine, skip }`:
   - heading: `Most student engineering disappears.`
   - lines (joined with spaces, they are exactly Jayden's paragraph):
     0 `Students build remarkable things:`
     1 `a robot for a competition season, a drone at a desk at home, a network in a training lab.`
     2 `Then the season ends, the parts get reused, and the files sit in a folder nobody opens again.`
     3 `What's left is one line on a résumé.`
     4 `We started JPL Innovation so our work doesn't vanish.`  ← lampLine = 4
     5 `Every sketch, every failed test and every hour on the bench is documented here,`
     6 `so anyone can see not just what we built, but how we learned to build it.`
   - skip: `Skip`
   - playLines: `[2, 3, 4]`: the 3D cut. The heading, then lines 2, 3 and 4, about 16 s, lamp at about 11 s
     (line 4 is the lampLine, lit as it appears). `lines` stays complete: Classic and the screen-reader text always
     have the full paragraph.
   - continue: `Continue` (the reduced-motion card's button)
2. **Classic** (src/components/ClassicHome.astro): a section right after `<HomePortal>` and before #services:
   the h2 in the same type as the other headings, the paragraph as `lines.join(" ")`, with line 4 in
   text-foreground, semibold. `data-reveal` like the others.
3. **3D** (src/pages/index.astro, inside `<Studio>` *after* the title section, so `[data-scene]:first-child` and
   the panels list are unaffected; not a `[data-scene]` itself):
   - Markup: `<div class="studio-hook" data-studio-hook>` with the h2, a `<p>` of `<span>` lines (trailing space
     in each, so screen readers read one paragraph), and `<button data-hook-skip hidden>`.
   - When not playing it is visually hidden (sr-only), so keyboard and screen-reader users always get normal text.
   - Two html classes: `studio-dark` (the engine keeps the lamp off and the opening clock still, like
     `splash`) and `studio-hook` (the overlay shows; the scene panels and the ruler are hidden).
     Engine change, src/lib/studio/engine.ts line ~198: `waiting = splash || studio-dark`; the idle check at
     ~253 the same.
   - Script (module in index.astro): arm when html.studio-on and the studio is not data-read, at
     astro:page-load or on the `studio:on` event (first visit, 3D picked on the opening page); only if
     localStorage `hook-seen` is unset and scrollY is near 0. Add `studio-dark` at once (before `splash` goes),
     wait until `splash` is gone and the studio has `data-live`, then play **only `playLines`** (the full
     paragraph stays in the sr-only text): heading 2.4 s alone, then each play line for 0.9 s + 0.26 s a word,
     rolling: the current line full, the previous one at 40 %, older ones gone (translate the column so the
     current line is centred). When the lampLine appears, remove `studio-dark` (the lamp warms over LAMP_TIME).
     Tune the timings so the whole cut is about 16 s with the lamp at about 11 s. After the last line hold
     1.5 s, fade out 0.8 s, remove `studio-hook`, set `hook-seen`.
   - Skip: the button (bottom centre, where the ruler sits) **shows from the first frame**; it and Esc finish at
     once (both classes off, hook-seen set). Wheel, touch and scroll keys also skip, **but only after the first
     1.5 s** (ignore them before, so trackpad momentum from picking 3D on the opening page doesn't skip it).
     Abort if html.studio-on goes away (fell back to Classic).
   - **prefers-reduced-motion** (and html.reduce-motion): no timed hook. Show the heading and the lampLine
     together as a still card with a `Continue` button; Continue lights the room (instant lamp) and closes it.
     (Today the studio doesn't start at all with reduced motion, so this applies if a reduced-motion visitor
     chooses 3D in Settings; check what the page does in that case and make the card work there.)
   - **"Replay the opening" in Settings** (src/components/ — the settings panel; label in src/text/site.ts under
     `settings`): clears `hook-seen` and the intro's seen flags, then reloads the home page at the top, so the
     opening page, the logo and the hook all play again. Shown in both modes.
   - Overlay: fixed, centred, z-index above the panels; headline font-stretch 125 %, weight 850,
     clamp(2rem, 4.5vw, 3.75rem); lines clamp(1.25rem, 2.2vw, 1.75rem), max 34ch; a soft radial scrim of
     --background behind the text for contrast in the light theme.
4. **Slogan under the wall logo** (src/lib/studio/room.ts ~line 290): a canvas-texture plane under the logo
   with site.slogan (`Sketch it. Build it. Secure it.`, src/text/site.ts) in the site font, colour following the
   theme like the logo; it fades in with the lamp (opacity follows `level`, starting from 0, unlike the logo's
   0.25 floor). Add it to RoomContent if it needs the text passed in from index.astro.
   **Where the slogan is (checked 24 Oct):** on the opening page directly under the logo: yes
   (IntroSplash.astro `intro-slogan`). At the top of Classic: **no**, the hero shows the kicker, the JPL letters
   and hero.support (src/components/home-portal.tsx). On the 3D wall: **no**, until this item.
   → Also add site.slogan to Classic's hero, directly under the JPL letters and above hero.support, styled as a
   small wide-type line. Report all three places in the step's summary.
5. Check: `npx astro build`, then `astro preview` on 4321; Playwright screenshots of the 3D hook (a line
   mid-way, the lamp moment, the lit room with the slogan), the reduced-motion card, the Settings replay,
   Classic's hero slogan and hook section, both themes; the FRC 2027 timeline; Jayden's profile. Test that a
   wheel in the first 1.5 s does not skip and one after does. Clear `hook-seen` in the test context. Commit,
   show, wait for OK.

Report: the TODO for the regionals' venues and cities.

---

## Step 2: home page polish, both modes (branch `phase-2-home-polish`)

No redesign. Show before and after screenshots of every scene (3D) and every section (Classic), then wait.

1. **One idea per scene, a few words.** Trim each studio card to a tag, a heading and one short line; longer
   text stays in the page for Classic and screen readers only where both modes already have it. Proposed copy
   changes go to Jayden as a before/after list; edit src/text/home.ts only (both modes read it).
2. **Proof counters (real numbers only)**, added to src/text/home.ts as `proof` and computed where possible,
   never typed by hand:
   - projects: 4 (count of src/text/projects/*.md, via getProjects())
   - drone parts: 18, and the budget 9.311.000 ₫ (from drone.ts's parts list and its total). The budget counter
     must say **"estimate, parts not yet priced excluded"**, as the drone page does (drone.ts `totalNote`).
   - drone build steps done: 4 of 6 (roadmap states in drone.ts)
   - mini drone build steps done: 3 of 5 (mini-drone.ts)
   Each counter is labelled as what it counts: **"projects documented"**, **"drone parts"**, **"build steps
   done"** (labels in src/text/home.ts).
   Show them in 3D on the wall scene's card (or the title card) and in Classic under "Selected work".
3. **Same words in both modes.** Checklist of differences found so far:
   - Classic's timeline doesn't show the "Before JPL" tag on 2023 and 2024 (the studio does) → add it.
   - The studio's title card shows hero.kicker + hero.support; Classic's hero shows the same → keep.
   - Check every section's heading and text comes from the same src/text key in both.
4. Branch, build, screenshots (before = main), commit, wait.

---

## Step 3: the F450 drone chapter (branch `phase-4-drone-chapter`)

The PDF's 9 beats on /work/drone/, built from what the page already has (src/text/projects/drone.ts and the
existing showcase, src/components/showcase*). No new facts; estimates stay labelled. HUD shows real state only:
"PRE-FLIGHT · ON THE BENCH", Ho Chi Minh City, the local time.

| Beat | Content (all from today's page) |
|---|---|
| 1 Prologue | "Ho Chi Minh City", live local time; the problem: a drone's video only reaches as far as its radio link |
| 2 The stakes | one giant number: **"720p at 60 fps camera"** (checked 24 Oct: drone.ts only says the Camera Module 3 "streams 720p at 60 fps" into the Pi, never that the 4G stream runs at 60 fps). Mention the 4G link separately, without a frame rate. |
| 3 The reveal | "Meet the F450 4G": the model rises out of the dark; status "Bench tested"; credits |
| 4 Anatomy | the existing Part by part showcase; hero dimension 450 mm |
| 5 01/04–04/04 | Fly (MC6C → MicoAir743, INAV 9.1) · See (Camera Module 3, 720p60) · Stream (Pi 4, MF833 4G, Tailscale) · Watch (anywhere online, live dashboard) |
| 6 The system | the three systems with moving dots; chips (Power, Flight control, Live video) light that system on the model |
| 7 The value | 18 parts, 9.311.000 ₫ estimate, 58 % to video and 4G; before/after: Logitech C920 → Camera Module 3, 142 g lighter |
| 8 Status | the 6-step build log as a draggable line, stopped at today (step 5, printed mounts); flashback to the May 2025 flight controller experiments |
| 9 Call to action | "Next chapter: first flight"; follow the build; Camera POV; contact |

- A chapter map pinned at the side (one dot per beat, current lit, each a link); beats numbered.
- Parts and budget tables open in a spec-sheet panel (scrolls inside, Esc closes) and appear in full in Classic.
- **Classic chapter**: every beat's text in order as one ordinary page. Shown under 768 px wide, with reduced
  motion, or without WebGL (and when Classic is chosen).
- Before building: verify each number above against drone.ts (they are the PDF's; the page is the source of truth).
- Budgets from the PDF: 60 fps on an Iris Xe laptop, never below 30 (Jayden measures this himself); CLS 0;
  Lighthouse accessibility ≥ 95.
- **Two checkpoints**, screenshots in both themes at each, then wait for OK:
  1. Beats 1 to 4, with the chapter map and the Classic order.
  2. Beats 5 to 9.
- Note: the camera POV HUD says "1080P30" while drone.ts says 720p at 60 fps; still an open question for Jayden,
  don't change it without his answer.

Later (not in these steps): Work wall, Cybersecurity and Mini drone chapters, FRC after Khoa's checks, Members,
About, the drone sub-pages' shell.
