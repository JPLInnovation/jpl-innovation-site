# JPL Innovation website audit (27 September 2026)

> **Status: Phase 3 report, before any fixes.** The fix log, before/after results and deploy outcome are
> added at the end as the work continues (sections 9 to 11).

**Scope.** Every page of https://jpl-innovation.github.io, audited on commit `baf5d9d` (`main`, which is
exactly what is live), at 375, 768 and 1440 px wide, in dark and light mode. I checked the local production
build and the live site. Both gave identical results.

**In one paragraph.** Nothing is broken in the usual sense. Every link, button and in-page anchor works, the
console is clean, there are no secrets in the code or its history, and the 404 page works on GitHub Pages.
The real problems are:
- **Phone layout.** Two pages are wider than the phone screen at 375 px (FRC by 179 px, Cybersecurity by
  10 px). That same overflow causes most of the mobile **layout shift** (CLS 0.40 on FRC, 0.19 on home;
  Google's "good" limit is 0.1).
- **Image weight.** Pages download about **0.5 MB more image data than they display**.
- **Accessibility and reduced motion.** There are some contrast and reduced-motion gaps.
- **SEO.** No canonical URLs, no social cards and no sitemap.

| Severity | Count | Fixed on the branch |
| --- | --- | --- |
| Critical | 0 | |
| High | 4 | see section 9 |
| Medium | 10 | see section 9 |
| Low | 14 | see section 9 |
| Needs Jayden (content, design or file deletions) | 13 | not changed |

---

## 1. Which site is live (read first)

| Address | Repository | What it is |
| --- | --- | --- |
| **https://jpl-innovation.github.io** | `jpl-innovation/jpl-innovation.github.io` (git remote `old-origin`) | **This project.** Astro 6.4.8, commit `baf5d9d`. This is the site the audit and the deploy cover. |
| https://jplinnovation.github.io | `JPLInnovation/jplinnovation.github.io` | A different, older site: Astro 5.18, 2 commits by `znotfireman` (9 March 2026). It has **no shared history** with this project. I didn't touch it. |
| (backup) | `JPLInnovation/jpl-innovation-site` (git remote `origin`) | Backup copy of this project. Pages is not enabled on it. |
| (staging) | `JPLInnovation/website2` | Empty repository (no branches). |

---

## 2. Tools used (Phase 0)

| Tool | Status | Used for |
| --- | --- | --- |
| Playwright MCP | Failed to connect (30 s timeout) | Replaced, as instructed, by the **webapp-testing** skill: Python Playwright driving the installed Chrome |
| context7 | Loaded | Current Astro, Tailwind and three.js docs before changing config or components |
| ui-ux-pro-max, frontend-design, design-taste-frontend | Loaded | Visual and UX review of the screenshots (preserve mode: no redesign) |
| design-motion-principles | Loaded | Motion audit (section 7) |
| security-review, code-review | Loaded | Run on the fix branch's diff before merging (section 10) |
| git | Works | Branch, commits, pushes. `gh` is not installed, and the GitHub MCP failed (bad auth header). |
| Lighthouse 13.5 (`npx lighthouse`) | Works | Before and after scores, median of 3 runs per page and form factor |
| axe-core 4.x (injected by the crawler) | Works | WCAG 2.2 AA checks on every page, width and theme |

---

## 3. Install, build and pages (Phase 1)

**Install.**
- `npm ci` installed 497 packages cleanly.
- `npm install --dry-run` reports "up to date", so the lockfile matches.
- Both print one warning: *allowScripts: 2 packages have install scripts not yet covered* (`esbuild@0.27.7`
  postinstall and `sharp@0.34.5` install). That's finding **M10**.
- `npm audit` reports 6 vulnerabilities (1 critical, 3 high, 2 low). See **H4** and **L8**.

**Type check and build.**
- `astro check`: 0 errors, 0 warnings, 0 hints (68 files).
- `astro build`: 9 pages, no warnings.
- One chunk is over 500 kB: three.js (`stage.js`, 593 kB). It loads only when a 3D model scrolls into view,
  and `astro.config.mjs` raises the warning limit on purpose.

**Crawls.**
- **Local production build:** every page at 375, 768 and 1440 px in dark and light (50 page loads).
- **Dev server:** every page, with and without reduced motion.
- **Live site:** every page at the same widths and themes.

**Pages and routes (all build to static HTML):**

| Route | Source | Notes |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | Scroll hero (`home-portal.tsx` + `ui/glyph-portal.tsx`), services, work, mission, timeline, team |
| `/work/` | `src/pages/work.astro` | Project list from `src/text/projects/*.md` |
| `/work/drone/` | `src/pages/work/drone.astro` | 3D drone, parts table |
| `/work/cybersecurity/` | `src/pages/work/cybersecurity.astro` | 3D lab network, Cisco terminal, subnet diagram |
| `/work/frc/` | `src/pages/work/frc.astro` | Odometer heading, scroll scene, 3D robot, seasons, hardware |
| `/work/[slug]/` | `src/pages/work/[...slug].astro` | Generic project page (no project uses it at the moment) |
| `/members/` | `src/pages/members.astro` | Leadership, 3D badges, member list |
| `/members/jayden/`, `/members/khoa/` | `src/pages/members/[...slug].astro` | From `src/text/members/*.md` |
| `/404.html` | `src/pages/404.astro` | GitHub Pages serves it for unknown paths (checked live: status 404, custom page) |

**Stack:**
- Astro 6 with React 19 islands and Tailwind v4 (`@tailwindcss/vite`).
- Motion (`motion`) for scroll and React animations, three.js for the 3D models, and Archivo Variable
  (self-hosted via Fontsource) for the typography.
- No environment variables, no backend and no forms that submit anywhere. The email pop-up opens Gmail or
  the mail app, or copies the address.

**Deploy pipeline.**
- `.github/workflows/deploy.yml` runs on every push to `main`: `withastro/action@v5` (npm) builds the site,
  then `actions/deploy-pages@v4` publishes it.
- It is live about a minute later at `old-origin`'s Pages site.
- `astro.config.mjs` sets `site: 'https://jpl-innovation.github.io'` with no `base`. That is correct for a
  `<user>.github.io` repository.

---

## 4. Lighthouse before fixes

Local production build (`astro preview`), **median of 3 runs** per page. P = Performance, A = Accessibility,
BP = Best practices.

> `astro preview` serves files uncompressed while GitHub Pages compresses them, so local mobile Performance
> is lower than live (home mobile: 66 local vs 94 live). Before/after comparisons always use the same setup.

| Page | Mobile P · A · BP · SEO | Mobile LCP · TBT · CLS | Desktop P · A · BP · SEO | Desktop CLS |
| --- | --- | --- | --- | --- |
| Home | 66 · 96 · 100 · 100 | 6.16 s · 1 ms · **0.192** | 98 · 96 · 100 · 100 | 0.024 |
| Work | 90 · 100 · 100 · 100 | 3.38 s · 0 ms · 0.000 | 100 · 100 · 100 · 100 | 0.012 |
| Drone | 60 · 100 · 100 · 100 | 5.73 s · **594 ms** · 0.010 | 94 · 100 · 100 · 100 | 0.024 |
| Cybersecurity | 63 · 100 · 100 · 100 | 5.19 s · **500 ms** · 0.000 | 93 · 100 · 100 · 100 | 0.011 |
| FRC | 54 · 100 · 100 · 100 | 6.99 s · 0 ms · **0.398** | 93 · 100 · 100 · 100 | **0.130** |
| Members | 58 · 100 · 100 · 100 | 6.48 s · **612 ms** · 0.000 | 95 · 100 · 100 · 100 | 0.011 |
| Jayden | 54 · 100 · 100 · 100 | 6.16 s · **575 ms** · 0.000 | 96 · 100 · 100 · 100 | 0.011 |
| Khoa | 61 · 100 · 100 · 100 | 5.54 s · **532 ms** · 0.000 | 96 · 100 · 100 · 100 | 0.011 |
| 404 | 85 · 100 · 100 · 100 | 3.91 s · 0 ms · 0.034 | 100 · 100 · 100 · 100 | 0.011 |

Live home page (single run, for reference): mobile 94 · 96 · 100 · 100, desktop 100 · 96 · 100 · 100.

---

## 5. Findings by severity

Each finding gives the file and line, what is wrong, and the proposed fix. "Needs Jayden" items are listed
in section 8 and are **not** changed.

### High

**H1 · FRC page is 179 px wider than a 375 px phone**
- **Where:** `src/components/HardwareStack.astro:22`.
- **What:** The "Hardware we use" grid has no column definition below `lg`, so its implicit column grows to
  the widest content. The right-aligned vendor labels ("CTRE", "Wiring", "Power", "Limelight Vision") are
  cut off, and the page scrolls sideways (screenshot: `audit/before/work_frc-375-dark.jpg`).
- **Fix:** Add `grid-cols-1`, so the column is `minmax(0, 1fr)` and content wraps inside it.

**H2 · Mobile layout shift (CLS) above the 0.1 "good" limit**
- **Where:** FRC 0.40 and home 0.19 on mobile, FRC 0.13 on desktop.
- **Root cause (traced with the Layout Instability API):**
  - When a page overflows sideways, mobile Chrome widens the layout viewport. Every `position: fixed`
    element (the animated background, the intro's Skip button) then resizes and moves. Lighthouse blames
    `div.site-bg__mesh`, but the mesh itself is fine (it only animates `transform`).
  - The overflow comes from H1 on FRC. On home it comes from the loading placeholder "JPL"
    (`src/components/home-portal.tsx:142`, `font-size: min(38svh, 60vw)`), which is about 2 em wide, so
    roughly 490 px on a 412 px phone until the scroll hero replaces it.
  - On FRC, the "Team 10951" heading also reflows when the Archivo font arrives, because nothing preloads
    the font (`src/layouts/BaseLayout.astro`).
- **Fix:**
  - Fix H1.
  - Size the placeholder word to fit, `min(38svh, 42vw)`. That is 84 % of the width, the same as the scroll
    hero's own opening frame, so the hand-off also lines up better.
  - Preload the Archivo latin subset.

**H3 · Images: about 530–600 KB downloaded but never shown, on every page**
- **The logo:** `src/components/Logo.astro:10-11` loads **both** logo PNGs (687 × 248 px, 105 KB each) to
  show one 155 px logo in the header and footer.
- **The photos:**
  - `FRC.JPG` (2000 px, 339 KB) is shown about 520 px wide on the home and Work cards.
  - `FRCnew.jpg` (2000 px, 275 KB) is used on the home hero and FRC.
  - `10951.jpg` (764 px, 78 KB) is shown at 80 px.
  - `Jayden_pfp.jpg` (900 px, 132 KB) is shown at 80–357 px.
  - Render sites: `ProjectList.astro:30`, `MemberList.astro:19`, `Leadership.astro:33`, `members.astro:34`,
    `members/[...slug].astro:46`, `work/frc.astro:38,75,91,108`, `home-portal.tsx:80`,
    `frc-seasons.tsx:354`.
- **Fix:** Add resized WebP copies next to the originals and serve them with `srcset`/`sizes`. The
  originals stay for "open full size" links and the 3D textures.

**H4 · npm audit: 1 critical, 3 high**
- **Critical:** `astro` < 7.0.6 has XSS through unescaped spread-attribute names. It is not exploitable
  here: the site is static and renders only its own content, with no user input. The only fix is Astro 7,
  a major upgrade that also moves to Vite 8. That needs a supervised session (see **Needs Jayden**).
- **High:**
  - `svgo` and `smol-toml` have fixes available without a major upgrade.
  - `sharp` (libvips issues) is build-time only and not used by this site, since images are served as-is.
    Its fix comes with Astro 7.
- **Fix now:** `npm audit fix` (no `--force`) for svgo and smol-toml.

### Medium

**M1 · Long page titles overflow at 375 px**
- **Where:** `src/components/PageIntro.astro:11`.
- **What:** "Cybersecurity" is one unbreakable word in the wide display font. At the 2.6rem minimum it is
  368 px, and the content area is 343 px.
- **Fix:** Use `min(2.6rem, 9.6vw)` as the minimum, so it's unchanged above about 430 px and only shrinks on
  narrow phones.

**M2 · React hydration error on FRC with reduced motion**
- **Where:** `src/components/frc-robot-reveal.tsx:15,40`.
- **What:** `useReducedMotion()` is false on the server and true on the first client render, so React
  throws error #418 and re-creates the scene (seen in the console with "Reduce motion" on).
- **Fix:** Render the server markup first and switch to the still version after mounting.

**M3 · FRC season switcher animates even with reduced motion**
- **Where:** `src/components/frc-seasons.tsx:50`.
- **What:** Motion's React components ignore the OS setting unless told otherwise, and the global CSS rule
  can't reach JS-driven animations, so the panel slide and the sliding tab pill still move.
- **Fix:** Wrap the switcher in `<MotionConfig reducedMotion="user">`.

**M4 · Home "Our mission" words are nearly invisible before you scroll to them**
- **Where:** `src/styles/global.css:269`, `src/scripts/motion.ts:77`.
- **What:** Words rest at 18 % opacity, which gives contrast of 1.5:1 in dark and 1.45:1 in light. WCAG AA
  needs 3:1 for text this large. This caused home's only Accessibility loss (96).
- **Fix:** Raise the resting floor to 45 %. The words still light up as you scroll, and at rest they pass 3:1.

**M5 · Subnet labels fail contrast**
- **Where:** `src/components/SubnetSplit.astro:11`.
- **What:** White 12 px bold text on the chart colours gives 3.2–3.6:1 (AA needs 4.5:1).
- **Fix:** It needs a colour change, so it's in **Needs Jayden**.

**M6 · No canonical URL, `og:url`, Twitter/X card or structured data**
- **Where:** `src/layouts/BaseLayout.astro:22-35`.
- **Fix:** Add `<link rel="canonical">`, `og:url`, `twitter:card`, and Organization JSON-LD on the home page.

**M7 · No `sitemap.xml` or `robots.txt`**
- **What:** Both return 404 on the live site.
- **Fix:** Add a small static `sitemap.xml` endpoint listing every page, with no new dependency, and a
  `robots.txt` that points to it.

**M8 · 3D pages block the main thread for 500–610 ms on mobile**
- **Where:** `src/lib/three/stage.ts:364-365`.
- **What:** The first render compiles every shader synchronously, as one 1.28 s task.
- **Fix:** `await renderer.compileAsync(scene, camera)` before the first render (three r186), so shaders
  compile in parallel. It will be measured, and kept only if it helps.

**M9 · Links to the public GitHub repository**
- **Where:** `src/text/site.ts:13,40`, `src/text/home.ts:76`, `src/components/SiteFooter.astro:28`.
- **What:** You asked earlier for these to be removed. The removal exists only on the unmerged
  `wip-frc-splash` branch.
- **Fix:** Apply the same edit here.

**M10 · Install scripts not reviewed (npm `allowScripts`)**
- **What:** npm 11 warns that `esbuild` and `sharp` run install scripts no one has approved, and a future
  npm release will block them.
- **Fix:** Both are the official packages' own install checks, so approve them, pinned to the reviewed
  versions (`npm approve-scripts esbuild sharp`).

### Low

**L1 · The FRC heading's text includes 40 hidden digits**
- **Where:** `src/components/Odometer.astro:22`.
- **What:** Screen readers are fine (the digits are `aria-hidden` and the real number is in `sr-only`), but
  anything that reads the page's text gets "Team 10951 01234567890123…".
- **Fix:** Draw the digit strip with CSS generated content instead of 20 `<span>`s per digit.

**L2 · Both member pages share one meta description**
- **Where:** `src/pages/members/[...slug].astro:31`.
- **What:** Both profiles open with "Passionate about technology, innovation, and creating solutions that
  make a difference", so the descriptions are almost the same.
- **Fix:** Prefix each with the person's name and roles from their existing data.

**L3 · Wrong alt text on Khoa's image**
- **Where:** `src/text/members/khoa.md:3-4`.
- **What:** The image is the Team 10951 logo, but its alt text says "Khoa Le".
- **Fix:** Change the alt text to describe the image. His real photo is in **Needs Jayden**.

**L4 · Small text fixes**
- `jayden.md:32` "ie." → "i.e.,".
- The academy is spelled "VnPro" in `jayden.md:15` and "VN Pro" in `jayden.md:39` and
  `cybersecurity.md:16`. Standardise on VnPro, the academy's own spelling.
- `khoa.md:15` "Tin Hoc Tre" → "Tin Học Trẻ", with diacritics like the rest of the site's Vietnamese.

**L5 · Two unused components**
- `src/components/glyph-portal-demo.tsx` and `src/components/ui/separator.tsx` are never imported.
- **Fix:** Delete them. Git history keeps them.

**L6 · Stale overrides in `package.json`**
- **What:** `package.json` overrides `esbuild` → `esbuild-wasm` and `rollup` → `@rollup/wasm-node` (the old
  Smart App Control workaround). The lockfile doesn't apply them, and the native builds work on this PC now.
- **Fix:** Documented only, not changed: changing the toolchain has no benefit for the live site.

**L7 · Harmless shader warning on the Drone page**
- **What:** The console shows a `THREE.WebGLProgram … X4122` precision warning from Windows' graphics
  driver.
- **Fix:** None needed.

**L8 · esbuild dev-server advisory (Windows)**
- **What:** It affects esbuild's own `serve` mode, which Vite doesn't use.
- **Fix:** Not applicable. Documented.

**L9 · 24 unused files in `public/assets/`, about 600 KB**
- **What:** `AI_pics.webp`, `IOT.jpg`, `IOT2.jpg`, `JPL_INNOVATION.jpg`, `zaloicon.jpg` and all of
  `backgrounds/`. They still deploy, but nothing references them.
- **Fix:** In **Needs Jayden**, because old links elsewhere may point at them.

**L10 · `website-old-main/` is in the repository**
- **What:** 79 tracked files (27 MB) of an old Bootstrap site. It isn't deployed, but anyone who opens the
  public repo can see it.
- **Fix:** In **Needs Jayden**.

**L11 · Ambient animations can't be paused**
- **What:** The starfield, the colour drift, the contact-band sheen, the drone propellers and the CAN-bus
  sweep all loop. WCAG 2.2.2 asks for a pause control on moving content that lasts more than 5 s. Reduced
  motion does stop all of them.
- **Fix:** In **Needs Jayden** (it adds a UI control).

**L12 · Render-blocking stylesheet**
- **What:** One 19 KB (gzipped) stylesheet on every page.
- **Fix:** Accepted. Inlining it would make every page heavier and lose caching.

**L13 · Stale `bun.lock`**
- **What:** CI ignores it, because the workflow pins npm.
- **Fix:** In **Needs Jayden**. It's harmless.

**L14 · Services and process copy is marked as placeholder**
- **Where:** `src/text/home.ts:33,100`.
- **What:** The copy is marked "TODO: confirm … PLACEHOLDERS".
- **Fix:** In **Needs Jayden**. The TODO comments are accurate, so they stay.

### Checked and fine

**Functionality**
- Every internal link, asset link, in-page anchor and the external link return 200.
- All 67 buttons respond.
- No failed network requests.
- No console errors in normal mode, apart from the expected 404 on the 404 test URL.
- The 404 page exists and works on GitHub Pages.
- Internal links consistently end with `/`, and GitHub Pages redirects `/work` → `/work/` (301).

**Content**
- CEO Jayden Phan Le and COO Khoa Le are correct everywhere.
- The email `jpl.innovation05@gmail.com` is correct everywhere.
- The copyright year updates itself (© 2026).
- No lorem ipsum.

**Accessibility**
- `lang="en"`, one `<h1>` per page, and heading levels never skip.
- Every image has alt text (decorative ones are empty).
- Keyboard: 44 Tab stops on home, all with visible focus rings.
- Every target is at least 24 × 24 px (WCAG 2.2 target size), and the skip link works.
- With reduced motion, no content is left hidden.

**Security**
- No secrets in the code or the full git history, and no `.env` or key file was ever committed.
- No mixed content.
- Every `target="_blank"` link has `rel="noopener"`.
- No third-party forms, so spam protection doesn't apply.
- GitHub Pages can't send security headers. A `<meta>` CSP was assessed but not added: Astro's inline
  scripts (theme, splash) would need hashes regenerated on every change, and a wrong CSP silently breaks
  the page.

**Design**
- 768 and 1440 px layouts are clean in both themes.
- Favicon and Apple touch icon are present.

---

## 6. Screenshots (before)

Full-page captures, split into columns so each fits one image:

| | |
| --- | --- |
| Home, phone, dark | `audit/before/home-375-dark.jpg` |
| Home, phone, light | `audit/before/home-375-light.jpg` |
| Home, desktop, dark | `audit/before/home-1440-dark.jpg` |
| FRC, phone, dark (cut-off hardware labels) | `audit/before/work_frc-375-dark.jpg` |
| FRC, desktop, dark / light | `audit/before/work_frc-1440-dark.jpg`, `audit/before/work_frc-1440-light.jpg` |
| Cybersecurity, phone, dark (title hits the edge) | `audit/before/work_cybersecurity-375-dark.jpg` |
| Khoa, phone, dark | `audit/before/members_khoa-375-dark.jpg` |

Blank stretches in the home and FRC captures are the pinned scroll scenes, which a static capture can't
show mid-scroll. They aren't layout gaps.

---

## 7. Motion audit (design-motion-principles, Audit mode)

The skill's HTML report is meant to open in a browser. Because this run is unattended, the full audit is
written here in the skill's terminal format instead.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 AUDIT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 1 Critical  |  🟡 4 Important  |  🟢 4 Opportunities
Primary lens: Jakub Krehel (showcase/landing site for a student startup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Reconnaissance.**
- **Project:** a portfolio-style showcase and landing site for a student engineering startup.
- **Style:** Motion (`motion`) springs with `bounce: 0` (0.9 s reveals), custom cubic-béziers
  (`0.32, 0.72, 0, 1` for the menu, `0.16, 1, 0.3, 1` for counters and the odometer), CSS keyframes for
  ambient loops, scroll-linked scenes (the JPL fly-through, the FRC reveal) and a 2.8 s intro splash.
- **Motion gaps:** none. Every conditional render is either static content or intentionally animated
  (the season pill uses a shared `layoutId`, and panels spring in).
- **Weighting:** Jakub primary, Jhey secondary, Emil selective (nav, menu, tabs).
- **Owner's intent:** you like the current design, so recommendations that change the look go to
  **Needs Jayden**.

**Overall assessment.** The motion is well engineered:
- one clock per scene, transform/opacity only, GPU-friendly
- paused when off-screen or the tab is hidden
- a global reduced-motion rule, plus JS checks in every script

The scroll hero (`ui/glyph-portal.tsx`) is especially careful. It throttles to animation frames, freezes the
font to avoid mid-scroll jumps, and has a separate reduced-motion layout. The weak spots:
- One React island ignores reduced motion.
- The mission sentence's resting state is unreadable.
- The same rise-and-fade reveal is used on almost every block, which flattens the hierarchy.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 JAKUB KREHEL — Production Polish          (Primary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
What's working well
- ✓ Springs with `bounce: 0` everywhere, so there's no cartoon overshoot on a professional site — `src/scripts/motion.ts:21`
- ✓ Hover transitions exist and are short (buttons 150 ms, press `scale(0.97)` at 120 ms) — `src/components/ui/button.tsx`, `src/styles/global.css:276-281`
- ✓ The 3D canvas fades in over its fallback image instead of popping in (700 ms / 500 ms) — `src/components/model-viewer.tsx:82-91`
- ✓ The season pill slides between tabs with a shared `layoutId` (FLIP) — `src/components/frc-seasons.tsx:80-86`

Issues to address
- ✗ 🟡 **One reveal everywhere** — `src/scripts/motion.ts:45-53`. The identical `opacity + y: 28`, 0.9 s spring
  is on nearly every section, heading and paragraph ("uniform fade-in" and "motion on static content").
  Recommended: keep it for cards, images and hero moments, and let headings and body copy appear with a
  short opacity fade, or none. **Design change → Needs Jayden.**
- ✗ 🟡 **Same hover zoom on four card types** — `group-hover:scale-[1.03]` in `ProjectList.astro`, `MemberList.astro`
  and `frc-seasons.tsx` (×2). Recommended: keep it on the project cards (the primary content) and use a shadow
  or border lift on the others. **Design change → Needs Jayden.**

Through Jakub's lens: polished and physically consistent. The next step up is hierarchy. Not everything needs to
make an entrance.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 JHEY TOMPKINS — Experimentation & Delight  (Secondary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
What's working well
- ✓ The JPL fly-through, where the camera flies through the letters into a photo, is a memorable signature moment — `src/components/ui/glyph-portal.tsx`
- ✓ The odometer heading rolls each digit a full turn with a 90 ms stagger. It's a single deliberate moment, not stagger-spam — `src/components/Odometer.astro:53-56`
- ✓ The CAN-bus light sweep shows data travelling. It's functional, not a status "pulse", and it's gated by reduced motion — `src/components/HardwareStack.astro:92-115`

Issues to address
- ✗ 🟡 **Mission words unreadable at rest** — `src/styles/global.css:269`, `src/scripts/motion.ts:77`. A lovely effect,
  but at 18 % opacity the unread words fail contrast (1.5:1). Recommended: a 45 % floor keeps the reveal but is readable.
  **Fixed on the branch (M4).**

Opportunities
- 💡 A tiny tilt or parallax on the 3D fallbacks while they load would tie them to the finished models (low priority).

Through Jhey's lens: the site has two real signature moments, the fly-through and the odometer. Protect them by
keeping everything around them quieter.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ EMIL KOWALSKI — Restraint & Speed          (Selective)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
What's working well
- ✓ The menu uses a strong custom ease (`0.32, 0.72, 0, 1`) at 300–400 ms with a small 50 ms stagger, and it's disabled under reduced motion — `src/components/SiteHeader.astro:92-180`
- ✓ Press feedback fires on pointer-down, not release — `src/styles/global.css:276-281`

Issues to address
- ✗ 🔴 **Reduced motion ignored in a React island** — `src/components/frc-seasons.tsx:50`. The panel spring (`y: 24`) and
  the pill slide still run when "Reduce motion" is on, because Motion for React defaults to ignoring the OS setting.
  Recommended: `<MotionConfig reducedMotion="user">` around the switcher. **Fixed on the branch (M3).**
- ✗ 🟡 **Ambient loops can't be paused** — the starfield, colour drift, contact sheen, propellers and CAN sweep. Reduced motion
  stops them all, but WCAG 2.2.2 wants a visible pause control. **UI addition → Needs Jayden.**

Opportunities
- 💡 `transition-all` on tab triggers (`src/components/ui/tabs.tsx:64`) could name its properties, so it never animates layout by accident.
- 💡 The intro splash is 2.8 s on first visit, with Skip, any key and reduced motion as exits. That's fine for a rare event. Keep it once per visit.

Through Emil's lens: navigation and feedback are fast and purposeful. The one hard rule broken is reduced motion in
the FRC season switcher.

**Combined recommendations**

| | Issue | File | Fix |
| --- | --- | --- | --- |
| 🔴 | Reduced motion ignored | `frc-seasons.tsx:50` | `MotionConfig reducedMotion="user"` (fixed, M3) |
| 🟡 | Mission words 1.5:1 at rest | `global.css:269`, `motion.ts:77` | 45 % floor (fixed, M4) |
| 🟡 | One reveal on every block | `motion.ts:45-53` | Reserve it for cards and hero moments (Needs Jayden) |
| 🟡 | Same hover zoom on four card types | `ProjectList`, `MemberList`, `frc-seasons` | Zoom only on project cards (Needs Jayden) |
| 🟡 | No pause for ambient loops | `background.ts`, `global.css`, `ContactSection`, `DroneIllustration`, `HardwareStack` | Pause toggle (Needs Jayden) |
| 🟢 | `transition-all` on tabs | `ui/tabs.tsx:64` | Name the properties |
| 🟢 | 3D fallback tilt | `model-viewer.tsx` | Optional delight |
| 🟢 | Keep intro once per visit | `intro-splash.ts` | No change |
| 🟢 | Keep the signature moments quiet around them | site-wide | Guidance |

> **Lens referenced most:** Jakub Krehel, Production Polish. Why: a public showcase that visitors revisit, where
> motion should feel smooth without calling attention to itself.
> - To follow Emil more strictly: drop reveals on text, shorten the menu to about 250 ms, and remove the ambient loops.
> - To follow Jakub more strictly: add a small blur to card entrances, and differentiate reveals by element type.
> - To follow Jhey more strictly: lean into the fly-through and odometer, and add one playful moment on the Members badges.

---

## 8. Needs Jayden (not changed)

These change content meaning, design, colours, fonts or files, or delete things, so they wait for you.

1. **The other site, `jplinnovation.github.io`.** It runs an unrelated older site. Decide whether to leave it,
   point it here, or archive it. Replacing it would need a force-push, which I never do.
2. **Astro 7 upgrade.** This fixes the critical `astro` advisory and the `sharp` ones (H4). It's a major upgrade
   (Vite 8, `@astrojs/react` 7) and deserves a supervised session with a full re-test.
3. **Services and process copy.** The code says these are unconfirmed placeholders (`src/text/home.ts:33,100`):
   the four services, "How we work", the timeline claims (e.g. "open source, internships" for 2026). Please confirm
   or rewrite them.
4. **Khoa's photo.** His profile, 3D badge and team cards use the Team 10951 dragon logo. Add a portrait at
   `public/assets/`, then set `img:` in `src/text/members/khoa.md`.
5. **Profile wording.**
   - Jayden: "My hometown is originally from both Quang Tri and Nghe An" (suggested: "My family comes from Quang
     Tri and Nghe An"), and "I'm a Vietnamese boy…" (tone).
   - Khoa: his story is generic and reads as template text.
   - Both descriptions start with the same sentence.
6. **Subnet label colours** (M5). Use dark text on the four chart colours, or darken the chart colours by about
   15 %, to reach 4.5:1.
7. **Motion design choices** (section 7):
   - one reveal on every block
   - the hover zoom on four card types
   - a pause control for ambient animations (WCAG 2.2.2)
8. **Unused images** (L9). 24 files, about 600 KB, in `public/assets/`. Delete them if nothing outside the site
   links to them.
9. **`website-old-main/`** (L10). 27 MB of an old site, visible to anyone who opens the public repo. Delete it?
10. **Stale `bun.lock`** (L13). Delete it. The workflow already pins npm.
11. **Stale `package.json` overrides** (L6). Remove them if Smart App Control stays off. They're harmless either way.
12. **The repository is public.** Even with the GitHub links removed, the `jpl-innovation.github.io` address names
    the GitHub account. Keeping the source private on a free plan means building from a private repo and
    publishing to the public one. I can set that up on request.
13. **Local permissions file.** You asked for `.claude/settings.local.json` with the allowed and denied commands.
    The permission system blocked me from writing my own permissions, so the ready-to-paste content is in my chat
    message.

---

## 9. Fix log (Phase 4)

*Filled in as fixes land on branch `audit-fixes-2026-09-27`.*

## 10. Verification (Phase 5)

*Pending.*

## 11. Deploy (Phase 6)

*Pending.*
