# TODO

## 1. Fix content errors in the resume

These came from the source PDF and were transcribed faithfully rather than
silently changed:

- The **"Research Assistant - Building the next NVDIA"** entry's four bullets
  actually describe the old SpartanUp marketplace (Next.js, FastAPI, MongoDB,
  Figma, AWS EC2). They don't match the title or its `Tableau, Linux` tags.
- **"NVDIA"** is presumably meant to be **"NVIDIA"**.
- Its start date `October 2026 – Present` is in the future.

## 2. Publish the first Photo Map entry

The map is intentionally empty until a real photograph, date, and location are
added. Follow `assets/photos/README.md`; do not invent a location from the
wallpaper alone.

## 3. Smaller polish

- **Dead CSS** in `styles.css`: `.r-project`, `.r-project-head`,
  `.r-project-name`, `.r-project-link`, `.r-tagline` are styled but never
  emitted by `resume.js`.
- **Window geometry resets on reload** — could persist size/position to
  `localStorage` the way the theme already does.
- **Only the bottom-right corner resizes.** Real windows resize from any edge.
- **`RING_EASE`** in `script.js` eases per frame, so the cursor ring converges
  about twice as fast on a 120 Hz display as on 60 Hz. Normalise to elapsed time
  if it looks inconsistent across monitors.
- **GitHub repository website URL** still points to the retired Vercel preview.
  Change it in the repository's About settings to the GitHub Pages URL.
- **Clickjacking** isn't defended: `frame-ancestors` only works as an HTTP
  header and GitHub Pages can't set one. Low risk; noted for completeness.

## Done

Menu bar, wallpaper, window centring/resizing, slim scrollbars, resume content
update, resume layout fixes, GitHub Pages deploy, security hardening (SRI, CSP,
`noopener`, URL allowlist), Safari lookbehind fix, SVG charging-bolt fix,
browser Print / Save PDF flow, dropped the phone number and citizenship line
from the resume, resume indent hierarchy, 9-palette theme system with
Auto/Light/Dark and a Control Centre popover, real identity/contact links,
featured project cards, grouped skills, working browser history controls, and
keyboard-safe tabs, menus, and resume modal.
