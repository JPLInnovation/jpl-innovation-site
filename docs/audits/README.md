# Audits

Reports from earlier reviews of the site, kept for reference.

- `AUDIT_REPORT.md`: the 27 September 2026 audit (findings, fixes, Lighthouse before and after). `audit/` holds its
  screenshots and the Lighthouse report; `motion-audits/` holds the motion audit of the same day.

What has changed since the report was written (22 October 2026):

- **L10, `website-old-main/`** (an old Bootstrap site, 27 MB): removed from `main`. It is kept on the branch
  `archive/old-bootstrap-site`.
- **L13, stale `bun.lock`**: deleted. The workflow and the README use npm.
- **L9, unused images in `public/assets/`** (`AI_pics.webp`, `IOT.jpg`, `IOT2.jpg`, `zaloicon.jpg`, `backgrounds/`): still
  there on purpose. Nothing on the site uses them, but old links elsewhere may point at them; delete them only once
  you know none do.
- The report's description of the home page, the header and the 404 page is out of date: the home page is now the 3D
  studio (see `docs/SHOWCASE.md`).
