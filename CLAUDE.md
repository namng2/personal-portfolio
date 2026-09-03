# Personal Portfolio — project notes

Static site styled as a fake macOS desktop: liquid-glass menu bar, a draggable/
resizable "browser" window, wallpaper behind it. **No build step, no npm.**

- Repo root is this folder. Branch: `main`. Remote: `namng2/personal-portfolio`.
- Live: https://namng2.github.io/personal-portfolio/ (GitHub Pages, `main` / root).
- Run locally — **never open `index.html` as `file://`**, relative paths break:
  `python3 -m http.server 5500` from this folder.

## Layout

```
index.html              markup + CSP + pinned CDN scripts
assets/css/styles.css   all styles; design tokens in :root / [data-theme="light"]
assets/js/script.js     particles, cursor, tabs, window drag/resize, menu bar
assets/js/resume.js     fetches + parses resume.tex into the modal
assets/resume/resume.tex  the resume content (source of truth)
```

## Traps that have already cost time — read before editing

1. **Bump the cache version.** `index.html` loads `styles.css?v=N` and
   `script.js?v=N`. Editing either without bumping `N` means returning visitors
   keep the old file and never see the change. This silently shipped broken
   fixes once. (`resume.tex` is exempt — fetched with `cache: "no-store"`.)
2. **Never put `var()` inside the CSS `background` shorthand.** It invalidates
   the whole declaration and every layer disappears with no error. `body` uses
   longhand `background-image`/`-size`/`-position`/`-repeat`/`-attachment`.
3. **Asset filenames must be lowercase.** macOS is case-insensitive, GitHub
   Pages is not — a `.JPG` referenced as `.jpg` works locally and 404s live.
4. **No regex lookbehind** (`(?<=`, `(?<!`). Syntax error in Safari < 16.4,
   which fails the entire file at parse time.
5. **`hidden` does nothing on SVG elements** — it's an `HTMLElement` feature.
   Toggle a class and use CSS `display` instead.
6. **Editing the CDN script version invalidates its SRI hash.** Get the new one
   from `https://api.cdnjs.com/libraries/<lib>/<version>?fields=sri`, or the
   script silently refuses to load. A CSP in `index.html` also restricts script
   sources — new external origins must be added there.

## Conventions

- JS is vanilla, organised as named IIFEs. Cross-module calls go through a few
  `window.__*` helpers (`__activateTab`, `__setTheme`, `__toggleZoom`, …).
- Theme is `[data-theme="light"]` on `<html>`; dark is the default (no attribute).
- Wallpaper tint is dark-mode only; light mode sets it `transparent`.
- Verify UI changes in a browser before claiming they work.

Open work: see [TODO.md](TODO.md).
