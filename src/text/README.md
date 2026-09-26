# Changing the words on the website

**Every word on the site lives in this folder (`src/text/`).** You never need to open the page or component code to change wording.

## Which file do I open?

| On the website | Open this file |
| :-- | :-- |
| **Top menu** (Services, Work, Members, Contact) | `site.ts` → `menu` |
| **Footer** (bottom of every page) | `site.ts` → `footer` |
| **Blue "Let's work together" box** (bottom of every page) | `site.ts` → `contact` |
| **Contact email address** (everywhere) | `site.ts` → `email` |
| **"Email us" pop-up** | `site.ts` → `emailPopup` |
| **"Page not found" page** | `site.ts` → `notFound` |
| **Home page**: the "JPL" opening screen and the text over the photo | `home.ts` → `hero` |
| Home: "What we do" (services) | `home.ts` → `servicesSection` and `services` |
| Home: "Selected work" heading | `home.ts` → `workSection` |
| Home: "Our mission", "What we hold ourselves to", "How we work" | `home.ts` → `mission` |
| Home: the timeline (2023 → 2029+) | `home.ts` → `journey` |
| Home: "The team" heading | `home.ts` → `teamSection` |
| **Work page** (`/work/`) heading and intro | `work.ts` |
| **Project cards** (title, description, "Build in progress" badge, picture, order) | `projects/drone.md`, `projects/cybersecurity.md`, `projects/frc.md` |
| **FIRST Robotics page** (`/work/frc/`): headings, 3D robot text, scroll scene | `projects/frc.ts` → `frcPage` |
| FRC: team info, "About Team 10951" | `projects/frc.ts` → `team` |
| FRC: 2027 tab | `projects/frc.ts` → `season2027` (headings: `seasonsText`) |
| FRC: 2026 tab (game, timeline, robot specs, results, photos) | `projects/frc.ts` → `season2026` (headings: `seasonsText`) |
| FRC: "Hardware we use" (motors, CAN devices, Limelight) | `projects/frc.ts` → `hardwareText`, `motors`, `controlStack`, `vision` |
| FRC: the big intro sentence under "Team 10951" | `projects/frc.md` → `description` |
| **Drone page** (`/work/drone/`): everything | `projects/drone.ts` |
| Drone: parts, prices, budget | `projects/drone.ts` → `partGroups` |
| **Cybersecurity page** (`/work/cybersecurity/`): title, intro, the long write-up | `projects/cybersecurity.md` |
| Cybersecurity: labels, "CCNA in motion", subnetting box | `projects/cybersecurity.ts` |
| Cybersecurity: the commands typed in the Cisco console | `projects/cybersecurity-terminal.ts` |
| **Members page** (`/members/`) headings | `members.ts` → `membersPage` |
| **A person** (name, photo, roles, CEO/COO titles, skills, achievements, sports, story) | `members/jayden.md`, `members/khoa.md` |

Labels floating inside the 3D models ("Intake rollers", "TEAM MEMBER"...) are the only exception: they're in `src/lib/three/models/`.

## How to edit safely

**`.ts` files:** change only the words **between the quotes**.

```ts
heading: "What we do",          // ✅ change What we do
```

- Keep the quotes `"…"` or `'…'` and the comma at the end of the line.
- Inside `'single quotes'`, write an apostrophe as `’` (or switch the quotes to `"double"`): `'We’re'` or `"We're"`.
- Lists look like `[ "one", "two" ]`. To add an item, copy a whole line (including its comma) and change the words.

**`.md` files:** the part between the two `---` lines holds the settings (`title:`, `description:`...). Change the text after the colon. Everything below the second `---` is plain writing: just type.

## Can't find some text?

Press **Ctrl + Shift + F** in VS Code and search for a few words you see on the site. The result shows the file and line.

## See your change, then publish it

1. `npm run dev` → open http://localhost:4321. The page updates by itself when you save.
2. If the page shows a red error, you probably removed a quote or a comma. Press Ctrl + Z to undo the last change.
3. When it looks right, publish:
   ```
   git add -A
   git commit -m "Update wording"
   git push old-origin main
   git push origin main
   ```
   `old-origin` is the live site (https://jpl-innovation.github.io). It updates about a minute after the push. `origin` is the backup copy at github.com/JPLInnovation/jpl-innovation-site.
