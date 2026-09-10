# TODO

## 1. Fix content errors in the resume

These came from the source PDF and were transcribed faithfully rather than
silently changed:

- The **"Research Assistant - Building the next NVDIA"** entry's four bullets
  actually describe the old SpartanUp marketplace (Next.js, FastAPI, MongoDB,
  Figma, AWS EC2). They don't match the title or its `Tableau, Linux` tags.
- **"NVDIA"** is presumably meant to be **"NVIDIA"**.
- Its start date `October 2026 – Present` is in the future.

## 2. Smaller polish

- **Photo dates**: the 13 map photos have no `date` field. EXIF was stripped
  before publishing, so capture dates would have to come from you.
- **No `og:image`.** Every other Open Graph tag is set, so a shared link renders
  as a bare grey rectangle on LinkedIn, Slack and iMessage. Needs one 1200x630
  image plus `twitter:card` changed to `summary_large_image`.
- **The reveal system is inert.** `script.js` observes `[data-reveal]` and
  `styles.css` styles it, but no element in the markup carries the attribute —
  it has been absent for at least a dozen commits. Either wire it up or delete
  both halves.
- **Projects 02 and 03 have no measured outcome**, and the air-hockey repo has
  no README — the strongest claim on the site lands on a bare file listing.
- **Dead CSS** in `styles.css`: `.r-project`, `.r-project-head`,
  `.r-project-name`, `.r-project-link`, `.r-tagline` are styled but never
  emitted by `resume.js`.
- **Window geometry resets on reload** — could persist size/position to
  `localStorage` the way the theme already does.
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
 Eleven photographs published to the Photo Map, EXIF stripped.
