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
assets/css/themes.css   ALL colour: palettes + the derivation layer
assets/css/styles.css   everything else; no colour literals belong here
assets/js/boot-theme.js runs from <head> before paint; stops the theme flash
assets/js/theme.js      appearance engine + the Control Centre popover
assets/js/photo-map.js  Map tab: Leaflet + photo pins + the add-photo helper
assets/data/photos.json the photo manifest (what the Map tab renders)
assets/photos/          the photo files themselves
assets/js/script.js     particles, cursor, tabs, window drag/resize, menu bar
assets/js/resume.js     fetches + parses resume.tex into the modal
assets/resume/resume.tex  the resume content rendered into the modal
assets/resume/resume.pdf  archival copy; the current UI prints the rendered resume
```

Keep the two in sync if the PDF is ever linked again. The current UI renders
`.tex` and uses the browser's Print / Save PDF dialog; nothing regenerates the
archival PDF from the LaTeX source.

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
6. **CSS comments do not nest.** A `/* … */` inside a block comment ends it
   early and turns the rest of the file into garbage that fails silently — no
   console error, just unstyled output. It killed all of `themes.css` once.
   Don't put example code containing comments inside a header comment.
7. **Editing the CDN script version invalidates its SRI hash.** Get the new one
   from `https://api.cdnjs.com/libraries/<lib>/<version>?fields=sri`, or the
   script silently refuses to load. A CSP in `index.html` also restricts script
   sources — new external origins must be added there.

## The colour system

Two independent axes on `<html>`, the way macOS System Settings works:
`data-theme` (`light`/`dark`, resolved from a stored `auto`/`light`/`dark`) and
`data-palette` (9 palettes; absent = Midnight).

**Adding a palette is two CSS blocks and one array entry.** Each palette gives
five seed colours per mode — `--seed-bg`, `--seed-fg`, `--seed-a1/a2/a3` — and
the derivation layer at the bottom of `themes.css` turns those into the ~25
tokens the site actually uses, via `color-mix(in oklch, …)`. Then add the id to
`PALETTES` in `theme.js`. Labels and swatch colours are read back out of the
CSS, so ids are the only thing duplicated.

Gotchas found the hard way:

- **Restate all five seeds in every mode block**, even unchanged accents. The
  settings panel reads palettes off a probe element inside `<body>`; anything
  it doesn't match a rule for inherits the *live* palette from `<html>` and the
  swatch previews the wrong theme.
- **Check contrast when adding a palette.** `--muted` is `--seed-fg` at 65%
  toward the background; that number is set by the worst palette (Solarized
  dark, 3.1:1). A palette whose own fg/bg contrast is low drags its muted text
  under 3:1 — fix the seed, not the percentage.

## The photo map

Leaflet + Esri Gray Canvas tiles. **No API key by design** — the repo is
public, so a key would be readable in source. Each mode is two tile layers
(gray canvas + a transparent label layer), and the tile path is `{z}/{y}/{x}`,
not Leaflet's usual `{z}/{x}/{y}`.

Publishing a photo is: file into `assets/photos/`, entry into
`assets/data/photos.json`, push. A manifest `file` may also be a full
`https://` URL if the photo is hosted elsewhere — add that host to `img-src`
in the CSP when you do.

**The Add a photo… composer is author-only**: `photo-map.js` removes it from
the DOM unless the page is served from localhost. It never could publish for
a visitor (it only prints JSON on screen, and a static host has no write
endpoint), but leaving the button live reads as "anyone can upload".

- **Verify a tile provider by looking at the pixels, not the status code.**
  CARTO's basemaps were the first choice and returned HTTP 200 `image/png` —
  the PNG was an "API KEY REQUIRED" watermark.
- The thin grey lines across the map are county boundaries Esri draws, not
  tile seams. Tiles are exactly adjacent; it was checked.

## Conventions

- JS is vanilla, organised as named IIFEs. Cross-module calls go through a few
  `window.__*` helpers (`__activateTab`, `__setTheme`, `__toggleZoom`, …).
- `__getTheme()` returns the *mode* (`auto`/`light`/`dark`);
  `__getResolvedTheme()` returns the `light`/`dark` actually showing.
- Wallpaper tint is dark-mode only; light mode sets it `transparent`.
- Verify UI changes in a browser before claiming they work.

## Running more than one agent at once

Not needed at this size — almost every open item edits `index.html`, so two
agents would collide on the same file. Kept here because the rules are the
same wherever this pattern gets used next.

**Before splitting anything**, list the work and the files each item touches.
If the file sets overlap, sequence it instead. Overlapping files are the only
thing that reliably breaks parallel agents; ticket count is irrelevant.

**Freeze the interface first.** One session writes only the contract — type
definitions, function signatures, schema, file layout — and commits it. Then
fan out. Skip this and each agent invents its own shape of the same thing, and
integration turns into a rewrite.

**One worktree per agent**, so they cannot touch each other's checkout:

```
git worktree add ../proj-api -b feat/api
git worktree list          # see them
git worktree remove ../proj-api
```

**Give each lane an owner and an escape hatch.** While parallel work is in
flight, record it here, e.g.:

```
feat/api   owns src/api/**, migrations/**
feat/web   owns src/components/**, src/styles/**
```

> If you need a change outside your lane: **do not make it.** Append the
> request to `HANDOFF.md`, commit, and carry on without it.

That rule is the important one. Without it an agent needing one line in
someone else's file will just take it, and you find out at merge.

**Markup and the script that drives it are one lane, never two.** Changing
`data-`/ARIA attributes in `index.html` without changing the module that reads
them leaves the two out of sync — the markup promises behaviour the JS never
implements. If a change spans both, it is a single unit of work.

**Merge short and often**, foundational lane first, and rebase the others onto
it before they drift. Each lane proves its own work in a browser before review;
otherwise you inherit several debugging sessions at once.

**Ceiling: two or three concurrent**, because the constraint is one human
reading the diffs, not tooling. Never parallelise wide refactors, dependency
upgrades, or anything touching shared config.

Open work: see [TODO.md](TODO.md).
