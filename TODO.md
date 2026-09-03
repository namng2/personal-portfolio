# TODO

## 1. Replace template placeholders — highest value, quick

`index.html` still ships with the starter template's fake identity. Real values
are in `assets/resume/resume.tex`.

| Placeholder | Should be |
|---|---|
| `Your Name` (incl. `<title>` and footer) | Nam Nguyen |
| `you@example.com` | namhnguyen041@gmail.com |
| `github.com/your-handle` | the real GitHub URL |
| `linkedin.com/in/your-handle` | linkedin.com/in/namnguyenh1 |
| Project One / Two / Three cards | real projects from the resume |
| Skills chips | still the old stack; resume now lists a different one |

Also in `assets/js/script.js` — the Apple, Help and Email menu items point at
`your-handle` / `you@example.com`.

## 2. Fix content errors in the resume

These came from the source PDF and were transcribed faithfully rather than
silently changed:

- The **"Research Assistant - Building the next NVDIA"** entry's four bullets
  actually describe the old SpartanUp marketplace (Next.js, FastAPI, MongoDB,
  Figma, AWS EC2). They don't match the title or its `Tableau, Linux` tags.
- **"NVDIA"** is presumably meant to be **"NVIDIA"**.
- Its start date `October 2026 – Present` is in the future.

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
- **Clickjacking** isn't defended: `frame-ancestors` only works as an HTTP
  header and GitHub Pages can't set one. Low risk; noted for completeness.

## Done

Menu bar, wallpaper, window centring/resizing, slim scrollbars, resume content
update, resume layout fixes, GitHub Pages deploy, security hardening (SRI, CSP,
`noopener`, URL allowlist), Safari lookbehind fix, SVG charging-bolt fix.
