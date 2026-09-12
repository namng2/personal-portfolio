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
assets/js/photo-map.js  Map app: MapLibre + photo pins + the add-photo helper
assets/data/photos.json the photo manifest (what the Map tab renders)
assets/photos/          the photo files themselves
assets/js/script.js     particles, cursor, tabs, the window manager, menu bar
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

## Windows

The desktop runs three: the browser, the Map, and Resume — a Preview-style
window showing `assets/resume/resume.pdf` in an `<iframe>`. It has to be an
iframe: the CSP sets `object-src 'none'`, which kills `<embed>` and `<object>`,
while `frame-src` falls back to `child-src 'self'`. The chrome *inside* that
frame is the browser's own PDF viewer and cannot be styled from here — Chromium
ignores `toolbar=0` and `navpanes=0`, so the window is sized wide enough to
live with its sidebar.

The Map is both an app and a browser section: the tab introduces it and
launches it, the window holds the actual map. Browser navigation (the tab bar,
the Home shortcut, the search box) goes to the section; the dock and the Window
menu open the application. The photo count appears in both, so it is written to
every `[data-pm-count]` rather than to one id.

The desktop runs more than one window. Anything with `class="window"` is picked
up by the window manager in `script.js`, which gives it dragging by its chrome,
resizing from all four corners, zoom, centring, and a place in the stacking
order — clicking a window brings it to the front and greys the other's traffic
lights. `__openApp(id)` / `__closeApp(id)` show and hide an app window by its
`<id>-app` element; `__toggleZoom` and `__centerWindow` act on whichever window
is in front.

Minimising sends a window to the **dock** at the bottom; its icon lights when
its window is on screen, and clicking it restores, focuses, or — if that window
is already in front — tucks it away again. Close and minimise both just hide:
the difference is that a closed window forgets its geometry and reopens at its
default, a minimised one comes back exactly where you left it.

Three rules that cost time when broken. The first two have now each cost it
twice, so check them before debugging anything else:

- **New markup must be parsed before the scripts that look for it.** Putting
  `#map-app`, and later the dock, after the `<script>` tags left `photo-map.js`
  bailing at its null guard and `querySelectorAll("[data-dock]")` returning an
  empty list. No console error either time — just a dead feature.
- **A mobile override must out-rank *and* out-order the rule it overrides.**
  Equal specificity means source order decides, so an `@media (max-width: 640px)`
  block placed earlier in the file silently loses — it hit `.app-window`, then
  `.dock`. Specificity bites too: `.dot-min` loses to `.window-controls .dot`,
  and `.app-window` loses to `#resume-app`, which sets its own width as an id
  and so has to be named in the media query by hand.
- **`display` on a window outranks `[hidden]`.** Both `.browser` and
  `.app-window` set `display: flex`, which beats the user-agent rule for
  `[hidden]`, so each needs its own `[hidden] { display: none }` or hiding it
  does nothing at all.
- **End a transition by forcing its final values, not by clearing styles.**
  Minimising flies the window into its dock icon. Removing the transition class
  and clearing the inline `transform`/`opacity` looked right but left the
  *computed* values stuck at the start of an unfinished transition — a window
  invisible at dock size. Set `transition: none`, write the final values,
  reflow, then restore the stylesheet. And always pair `transitionend` with a
  timeout: in a document the browser is not painting, it never fires.
- **Anything `raise()` touches must be hoisted.** `raise()` runs during init,
  before the dock block further down has been evaluated, so a `const` arrow
  there dies in the temporal dead zone and takes the whole module with it. Use
  a `function` declaration.
- **Window contents that measure themselves need telling when the window
  changes size.** The manager fires a `windowresized` event on `window` at the
  end of a resize, zoom or centre, and `photo-map.js` calls `map.resize()` on
  it. ResizeObserver covers the live drag in a real browser but never fires in
  the agent's pane, so it cannot be the only mechanism.

## The phone build

**A handset gets an iPhone, not a shrunken Mac.** `#springboard` is a home
screen — wallpaper, two widgets, an icon grid and a dock — and each section
opens full-screen as an "app" with a title bar and a home indicator.

```
assets/css/mobile.css       every phone rule, nothing else
assets/js/springboard.js    the home screen: open/close, history, animation
assets/img/wallpaper-phone.jpg  one of the map's own photographs
site.webmanifest + assets/img/apple-touch-icon.png   Add to Home Screen
```

**The switch is a class, not a media query.** `boot-theme.js` stamps
`.is-phone` on `<html>` before first paint from `window.__PHONE_MQ`:

```
(max-width: 640px), (max-height: 500px) and (pointer: coarse)
```

CSS keys off the class, `springboard.js` keeps it in step with `matchMedia`,
and `script.js`'s `compact()` reads it too. The second clause is a phone held
sideways — 844x390 is wider than any width breakpoint and still a phone.

**mobile.css loads after styles.css**, so a rule in it always wins on source
order. That is the structural fix for the trap that has broken the phone
layout three times; put phone rules there and nowhere else.

Things that matter when editing it:

- **No content is duplicated.** An icon calls `__activateTab()` and shows the
  browser window full-screen; the Map icon shows `#map-app`. Both builds read
  the same panels, so a section is written once.
- **The phone never calls `__openApp`.** springboard.js sets `hidden` and
  `.ph-open` itself, which keeps stacking deterministic (`raise()` already
  skips z-index when `compact()`), and still trips photo-map.js's observer on
  `#map-app[hidden]`.
- **The title bar and home indicator are injected by springboard.js**, because
  they are phone-only behaviour — markup and the code driving it stay one unit.
- **Back closes the app.** Opening pushes a history entry, the home control
  walks it back, and `popstate` closes. Without that, a back swipe leaves the
  site.
- **`--menubar-h` is zeroed** rather than the rules being rewritten, so every
  `calc(100vh - var(--menubar-h))` in styles.css resolves to full screen.
- **Heights are `100dvh`.** On iPhone Safari `100vh` is measured with the
  toolbars retracted, and these windows never scroll the page, so the last
  80-odd pixels would sit behind the toolbar.
- **Never draw a fake status bar.** The iPhone's real clock and battery are
  directly above; two of them read as a bug. The fake menu bar is hidden, and
  Appearance moved to a home-screen icon so the palettes stay reachable.
- **The Resume icon opens the PDF itself**, handed to iOS's own viewer. An
  iframe is unreliable there. That frame now carries `data-src`, and the window
  manager sets `src` on first open, so a phone never downloads 126 KB it will
  not display.
- **The photo sheet is built at every screen size** and shown by mobile.css
  only on a phone, so a rotation has nothing to create or tear down. `PEEK` in
  photo-map.js repeats the sheet's closed offset from mobile.css — keep the
  two in step.

**Verifying it here has one blind spot**: the agent's browser pane only
emulates touch below 768px, so the landscape clause cannot match at 844x390 in
the pane. Test it at 740x390, or on a real handset:
`python3 -m http.server 5500` already listens on every interface, so the phone
opens `http://<the Mac's LAN IP>:5500` over the same Wi-Fi.

## The photo map

**The map is its own application window, not a browser tab.** It is launched
from the Home shortcut grid, the search box, or Window ▸ Open Map, and it
builds on first reveal — the window starts `hidden`, and MapLibre cannot
measure a container with no dimensions.

MapLibre GL JS + OpenFreeMap vector tiles. **No API key by design** — the repo
is public, so a key would be readable in source. Vector tiles are why the
renderer is MapLibre and not Leaflet: Leaflet draws `<img>` raster tiles and
cannot render vector at all. Each mode loads a real cartographic style —
`liberty` (full colour) for light, `dark` for dark — swapped via `setStyle` on
`themechange`. No CSS filter is involved.

Everything OpenFreeMap needs is on `tiles.openfreemap.org`, and **all of it has
to be in the CSP**: `connect-src` for style JSON / vector tiles / glyphs,
`img-src` for the sprite sheet and Natural Earth underlay, and `worker-src
blob:` because MapLibre builds tile workers from blob URLs. Miss one and the
map is blank with nothing useful in the console.

**Markers are DOM overlays**, positioned by the map's projection, so they work
before the style loads and survive `setStyle`. Never gate rendering photographs
on `map.on("load")` — a slow or broken basemap would then cost the photographs
too, which are the point of the tab. MapLibre gives markers no intrinsic size,
so `.pm-pin-wrap` sets its own 64×72 and the marker uses `anchor: "bottom"`.

Publishing a photo is: file into `assets/photos/`, run
`./assets/photos/build-thumbs.sh`, entry into `assets/data/photos.json`, push.

**Pins and popups load `assets/photos/thumbs/`, not the originals.** They render
at 64px and ~320px, so serving the 2200px file meant ~9 MB to draw a handful of
thumbnails; the full-size viewer still fetches the original on demand. Forget
the build script and the new photo's pin is a broken image.
The viewer opens on the cached thumbnail and swaps in the original when it
arrives: a 900 KB photograph over a phone connection is otherwise a blank
frame for several seconds.

**Originals must be upright in their pixels before they go in.** Rotate by the
EXIF orientation, resize, then strip metadata *last* (sips re-adds its own on
resize). Read the orientation from the EXIF bytes themselves, not from
`sips -g orientation`: it reported nothing for a camera file tagged
orientation 8, and an image viewer honours the tag, so the preview looked
right. Stripping would then have removed the tag and published a portrait
photo sideways. This is how 7 of the first 11 nearly shipped. A manifest `file` may also be a full
`https://` URL if the photo is hosted elsewhere — add that host to `img-src`
in the CSP when you do.

**The Add a photo… composer is author-only**: `photo-map.js` removes it from
the DOM unless the page is served from localhost. It never could publish for
a visitor (it only prints JSON on screen, and a static host has no write
endpoint), but leaving the button live reads as "anyone can upload".

That removal runs **first, above every early return**, and must stay there. It
used to sit at the bottom of the module, below the guard that bails when the
map library is missing — so anything that stopped MapLibre loading (a CDN
hiccup, a content blocker, a bad SRI) shipped visitors a dead map *and* a
live-looking "Add a photo…" button. A security-shaped behaviour must never be
downstream of a feature working.

- **Verify a tile provider by looking at the pixels, not the status code.**
  CARTO's basemaps were the first choice and returned HTTP 200 `image/png` —
  the PNG was an "API KEY REQUIRED" watermark.
  OSM's own servers are the mirror image: they answer `curl` with a 403 image
  and a browser with a real tile, so check from a browser, not the shell.
- **Verifying MapLibre from an agent needs an rAF shim.** The agent's browser
  pane reports `visibilityState: "hidden"`, so `requestAnimationFrame` never
  fires and MapLibre's render loop never runs: the canvas stays one flat
  colour, `load` and `idle` never fire, and zero tiles are requested. Injecting
  `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`
  *before the map is built* makes it render normally and pixel-verifiable. This
  is a **test-time shim only** — never ship it; real browsers have real rAF.
- That same frozen `rAF` freezes CSS transitions. Pins stuck mid-fade are an
  artifact of the harness, not a bug; inject `transition: none !important` to
  see the settled state.
- OSM's official `shortbread_v1` vector endpoint was the other candidate. It
  caps at **z14** and ships no style, glyphs or sprites, so OpenFreeMap wins on
  both counts.

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
