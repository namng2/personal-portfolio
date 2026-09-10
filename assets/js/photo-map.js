// ==========================================================================
// photo-map.js — the Map tab: photo thumbnails pinned where they were taken.
//
// Provider: MapLibre GL JS + OpenFreeMap. No API key by design — the repo is
// public, so a key would be readable in the source. OpenFreeMap serves vector
// tiles, which Leaflet cannot draw at all; that is why the renderer is
// MapLibre and not Leaflet. Labels stay sharp at any zoom and rotate with the
// map, and each theme gets a real cartographic style rather than a filter.
// (CARTO looks similar but now serves an "API KEY REQUIRED" watermark at HTTP
// 200 — check the pixels, not the status code, if this ever needs revisiting.)
//
// Everything OpenFreeMap needs is on one origin: style JSON, vector tiles,
// glyphs and sprites. All four have to be reachable from the CSP in
// index.html — connect-src for the JSON/pbf, img-src for the sprite sheet and
// the Natural Earth raster underlay, and worker-src blob: because MapLibre
// builds its tile workers from blob URLs.
//
// Markers are plain DOM, positioned by the map's projection, so they do not
// depend on the style being loaded. Do not gate rendering photographs on
// map.on("load") — a slow or failed basemap then costs you the photographs
// too, which is the whole point of the tab.
//
// PUBLISHING A PHOTO (the site is static — nothing uploads at runtime):
//   1. put the image in assets/photos/
//   2. add an entry to assets/data/photos.json
//   3. commit and push
// The "Add a photo…" composer in the Map tab does step 2 for you: it reads
// GPS out of the file's EXIF where present, otherwise you click the map, and
// it prints the JSON to paste.
//
// Entry shape (lat/lng required, everything else optional):
//   { "file": "sunset.jpg", "lat": 37.76, "lng": -122.51,
//     "title": "…", "place": "…", "date": "2026-08-30" }
// ==========================================================================

(function photoMap() {
  const IS_LOCAL =
    location.protocol === "file:" ||
    /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname) ||
    location.hostname.endsWith(".local");

  // FIRST, before any other check. Stripping the author-only composer must not
  // depend on the rest of this module working: it used to sit at the bottom,
  // below a guard that returns when the map library is missing, so a CDN that
  // failed to serve MapLibre left visitors with a dead map AND a live-looking
  // "Add a photo…" button. Removal is not conditional on anything but the host.
  if (!IS_LOCAL) {
    document.getElementById("pm-foot")?.remove();
  }

  const win = document.getElementById("map-app");
  const host = document.getElementById("photo-map");
  if (!win || !host) return;

  // Say so rather than leaving an empty box. MapLibre is a ~1 MB script from a
  // CDN; when it does not arrive there is otherwise nothing on screen and
  // nothing in the console to explain the blank rectangle.
  function mapUnavailable(msg) {
    const empty = document.getElementById("pm-empty");
    if (empty) {
      empty.hidden = false;
      empty.textContent = msg;
    }
    host.classList.add("pm-dead");
  }

  if (typeof maplibregl === "undefined") {
    mapUnavailable("The map library did not load — check your connection or any content blockers.");
    return;
  }

  const PHOTO_DIR = "assets/photos/";
  const MANIFEST = "assets/data/photos.json";
  const OFM = "https://tiles.openfreemap.org/styles/";
  // Liberty is OpenFreeMap's full-colour style; dark is its night counterpart.
  // Both carry their own attribution, which MapLibre renders for us.
  const STYLES = { light: OFM + "liberty", dark: OFM + "dark" };
  // Zoom at which pins stop being dots and become photographs.
  const THUMB_ZOOM = 10;

  let map = null;
  let markers = [];
  let photos = [];

  const currentMode = () =>
    window.__getResolvedTheme?.() === "light" ? "light" : "dark";

  // Dots below THUMB_ZOOM, photographs above it — eleven 64px thumbnails at an
  // overview zoom cover the geography they are meant to sit on. CSS does the
  // switch; this only decides which side of the line we are on.
  const syncZoom = () => {
    if (map) host.classList.toggle("pm-far", map.getZoom() < THUMB_ZOOM);
  };

  // ---- init ---------------------------------------------------------------
  // Built on first reveal, not at load: the window starts hidden, and MapLibre
  // cannot measure a container with no dimensions.

  function build() {
    if (map) return;

    try {
      map = new maplibregl.Map({
        container: host,
        style: STYLES[currentMode()],
        center: [-122.4194, 37.7749], // MapLibre takes lng,lat — not lat,lng
        zoom: 11,
        minZoom: 2,
        attributionControl: { compact: false },
      });
    } catch (err) {
      mapUnavailable("This map needs WebGL, which this browser has turned off.");
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("zoom", syncZoom);
    syncZoom();

    // The window is resizable from any corner, and MapLibre only re-measures
    // its container when told to. Coalesced into a frame so dragging a corner
    // does not trigger a re-measure per pointer event.
    if (typeof ResizeObserver !== "undefined") {
      let queued = false;
      new ResizeObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          map.resize();
        });
      }).observe(host);
    }
    // The desktop's window manager fires this when a window finishes resizing,
    // is zoomed, or is re-centred. ResizeObserver above handles the live drag;
    // this guarantees the canvas is square with its container once the gesture
    // ends, without depending on a rendering-step callback having run.
    window.addEventListener("windowresized", () => map.resize());

    // Composer-only, and gated on IS_LOCAL: onMapClick closes over `composer`,
    // which is never initialised on the deployed site.
    if (IS_LOCAL) map.on("click", onMapClick);
    // Deliberately not inside map.on("load"): the photographs are the content,
    // and they must not wait on — or be lost with — the basemap.
    load();
  }

  // Each theme gets its own cartography. Markers are DOM overlays, so they
  // survive setStyle untouched.
  window.addEventListener("themechange", () => {
    if (map) map.setStyle(STYLES[currentMode()]);
  });

  // ---- data ---------------------------------------------------------------

  async function load() {
    try {
      const res = await fetch(MANIFEST, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      photos = Array.isArray(data) ? data.filter(valid) : [];
    } catch {
      photos = [];
    }
    render();
  }

  // "file" is either a name inside assets/photos/ or a full https:// URL, so
  // photos can live in the repo or on an image host without changing anything
  // here. A host used this way must also be added to img-src in the CSP in
  // index.html, or the browser drops the image with no visible error.
  function photoSrc(p) {
    const f = String(p.file || "").trim();
    if (!f) return "";
    if (/^https?:\/\//i.test(f)) return f;
    if (/^[a-z][a-z0-9+.-]*:/i.test(f)) return ""; // data:, javascript:, … — refuse
    return PHOTO_DIR + f.replace(/^\/+/, "");
  }

  const valid = (p) => p && photoSrc(p) && isFinite(p.lat) && isFinite(p.lng);

  function render() {
    markers.forEach((m) => m.remove());
    markers = [];
    const pts = [];

    photos.forEach((p) => {
      const popup = new maplibregl.Popup({
        className: "pm-popup",
        maxWidth: "320px",
        offset: 12,
      }).setHTML(popupHtml(p));
      markers.push(
        new maplibregl.Marker({ element: thumbEl(p), anchor: "bottom" })
          .setLngLat([p.lng, p.lat])
          .setPopup(popup)
          .addTo(map)
      );
      pts.push([p.lng, p.lat]);
    });

    const empty = document.getElementById("pm-empty");
    if (empty) empty.hidden = photos.length > 0;
    // The count appears in the Map window's chrome and again in the Map
    // section inside the browser, so it is addressed by attribute rather than
    // by a single id.
    const label = photos.length
      ? `${photos.length} photo${photos.length === 1 ? "" : "s"}`
      : "";
    document.querySelectorAll("[data-pm-count]").forEach((el) => {
      el.textContent = label;
    });

    if (pts.length === 1) {
      map.jumpTo({ center: pts[0], zoom: 13 });
    } else if (pts.length > 1) {
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((c) => b.extend(c));
      // animate:false so the fit lands even while the window is mid-reveal —
      // an eased flight can be interrupted and leave the view somewhere else.
      map.fitBounds(b, { padding: 60, maxZoom: 14, animate: false });
    }
    syncZoom();
  }

  // Thumbnail pin, in the style of the Photos-on-a-map pin: rounded image with
  // a pointer beneath it. A plain element, styled with the site's own tokens.
  // MapLibre gives markers no intrinsic size, so .pm-pin-wrap sets its own in
  // styles.css; anchor:"bottom" then puts the tail on the coordinate.
  function thumbEl(p) {
    const el = document.createElement("div");
    el.className = "pm-pin-wrap";
    el.title = p.title || p.file || "";
    el.innerHTML =
      '<span class="pm-pin">' +
      `<img src="${escAttr(photoSrc(p))}" alt="${escAttr(p.title || "")}" loading="lazy">` +
      "</span>";
    return el;
  }

  function popupHtml(p) {
    const bits = [];
    if (p.title) bits.push(`<h4 class="pm-pop-title">${esc(p.title)}</h4>`);
    const meta = [p.place, formatDate(p.date)].filter(Boolean).map(esc).join(" · ");
    if (meta) bits.push(`<p class="pm-pop-meta">${meta}</p>`);
    const i = photos.indexOf(p);
    return (
      `<button type="button" class="pm-pop-open" data-index="${i}" ` +
      `aria-label="View ${escAttr(p.title || "photo")} full size">` +
      `<img class="pm-pop-img" src="${escAttr(photoSrc(p))}" alt="${escAttr(p.title || "")}">` +
      `<span class="pm-pop-zoom" aria-hidden="true">View full size</span></button>` +
      bits.join("")
    );
  }

  function formatDate(d) {
    if (!d) return "";
    // "2026-07-04" is parsed as UTC midnight by Date.parse, which then renders
    // as the 3rd anywhere west of Greenwich. Build it as a local date instead.
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d).trim());
    const dt = ymd
      ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3])
      : new Date(Date.parse(d));
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Photo titles and places come from the manifest, which is authored by hand;
  // escaping anyway keeps a stray quote or angle bracket from breaking out.
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ---- full-size viewer ---------------------------------------------------
  // The popup is only ~320px wide, so the 2200px file is heavily downscaled
  // there. This shows it at full size, and lets you go to 1:1 to inspect it.

  let box = null, boxImg = null, boxCap = null, boxIndex = 0, boxReturn = null;

  function buildBox() {
    box = document.createElement("div");
    box.className = "pm-box";
    box.id = "pm-box";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Photo viewer");
    box.innerHTML =
      '<button type="button" class="pm-box-close" aria-label="Close viewer">&#10005;</button>' +
      '<button type="button" class="pm-box-nav pm-box-prev" aria-label="Previous photo">&#8249;</button>' +
      '<button type="button" class="pm-box-nav pm-box-next" aria-label="Next photo">&#8250;</button>' +
      '<div class="pm-box-stage"><img class="pm-box-img" alt=""></div>' +
      '<p class="pm-box-cap"></p>';
    boxImg = box.querySelector(".pm-box-img");
    boxCap = box.querySelector(".pm-box-cap");

    box.querySelector(".pm-box-close").addEventListener("click", closeBox);
    box.querySelector(".pm-box-prev").addEventListener("click", () => step(-1));
    box.querySelector(".pm-box-next").addEventListener("click", () => step(1));
    // Clicking the backdrop closes; clicking the photo toggles 1:1.
    box.addEventListener("click", (e) => { if (e.target === box) closeBox(); });
    boxImg.addEventListener("click", () => {
      box.classList.toggle("is-zoomed");
      boxImg.setAttribute("aria-label", box.classList.contains("is-zoomed")
        ? "Actual size. Select to fit to screen" : "Fit to screen. Select for actual size");
    });
    document.body.appendChild(box);
  }

  function showAt(i) {
    const p = photos[i];
    if (!p) return;
    boxIndex = i;
    box.classList.remove("is-zoomed");
    boxImg.src = photoSrc(p);
    boxImg.alt = p.title || "";
    const meta = [p.place, formatDate(p.date)].filter(Boolean).join(" · ");
    boxCap.textContent = [p.title, meta].filter(Boolean).join(" — ");
    const many = photos.length > 1;
    box.querySelector(".pm-box-prev").hidden = !many;
    box.querySelector(".pm-box-next").hidden = !many;
  }

  const step = (d) => showAt((boxIndex + d + photos.length) % photos.length);

  function openBox(i) {
    if (!box) buildBox();
    boxReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    showAt(i);
    box.hidden = false;
    document.body.style.overflow = "hidden";
    // Focused directly, not inside a frame callback: rAF does not run in a
    // hidden document and the focus would simply be dropped.
    box.querySelector(".pm-box-close").focus();
    document.addEventListener("keydown", onBoxKey, true);
  }

  function closeBox() {
    if (!box || box.hidden) return;
    box.hidden = true;
    box.classList.remove("is-zoomed");
    boxImg.removeAttribute("src"); // stop decoding a 2200px image behind the map
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onBoxKey, true);
    boxReturn?.focus();
    boxReturn = null;
  }

  function onBoxKey(e) {
    if (box.hidden) return;
    if (e.key === "Escape") { e.stopPropagation(); closeBox(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
    if (e.key !== "Tab") return;
    // Keep focus inside the dialog.
    const f = [...box.querySelectorAll("button")].filter((b) => !b.hidden);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Delegated: Leaflet rebuilds popup markup each time one opens.
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".pm-pop-open");
    if (!t) return;
    e.preventDefault();
    openBox(Number(t.dataset.index) || 0);
  });

  // ---- reveal -------------------------------------------------------------
  // The window is hidden until the app is launched; MapLibre needs telling
  // once it has real dimensions or it renders into a zero-sized canvas.

  new MutationObserver(() => {
    if (win.hidden) return;
    build();
    requestAnimationFrame(() => map?.resize());
  }).observe(win, { attributes: true, attributeFilter: ["hidden"] });

  if (!win.hidden) build();

  // ---- composer -----------------------------------------------------------
  // Author-only. Nothing here could ever publish for a visitor — the composer
  // just prints JSON on screen, and a static host has no endpoint to write to
  // — but leaving the button on the live site reads as "anyone can upload".
  // The markup itself was already removed at the top of this module, which
  // also keeps it out of the tab order and out of screen readers; this just
  // skips wiring up handlers for elements that are gone.
  if (!IS_LOCAL) return;

  const composer = document.getElementById("pm-composer");
  const fileInput = document.getElementById("pm-file");
  const out = document.getElementById("pm-json");
  const draft = { file: "", lat: null, lng: null };
  let draftMarker = null;

  const field = (id) => document.getElementById(id);

  document.getElementById("pm-add")?.addEventListener("click", () => {
    build();
    composer.hidden = !composer.hidden;
    if (!composer.hidden) composer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  document.getElementById("pm-cancel")?.addEventListener("click", () => {
    composer.hidden = true;
    if (draftMarker) {
      draftMarker.remove();
      draftMarker = null;
    }
  });

  fileInput?.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    draft.file = f.name;
    // Clear the previous photo's position first, or a second file with no GPS
    // silently inherits wherever the last one was pinned.
    draft.lat = null;
    draft.lng = null;
    if (draftMarker) {
      draftMarker.remove();
      draftMarker = null;
    }
    const note = document.getElementById("pm-file-note");

    const exif = await readExif(f).catch(() => null);
    if (exif && exif.lat != null) {
      draft.lat = exif.lat;
      draft.lng = exif.lng;
      placeDraft(exif.lat, exif.lng, true);
      if (note) note.textContent = "GPS found in the photo — pin placed for you.";
    } else if (note) {
      note.textContent = "No GPS in this photo — click the map to place it.";
    }
    if (exif && exif.date && !field("pm-date").value) field("pm-date").value = exif.date;
    if (!field("pm-date").value) {
      field("pm-date").value = new Date(f.lastModified).toISOString().slice(0, 10);
    }
    emit();
  });

  ["pm-title", "pm-place", "pm-date"].forEach((id) =>
    field(id)?.addEventListener("input", emit)
  );
  document.getElementById("pm-copy")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(out.textContent);
      const b = document.getElementById("pm-copy");
      b.textContent = "Copied";
      setTimeout(() => (b.textContent = "Copy JSON"), 1400);
    } catch {
      /* clipboard blocked — the JSON is on screen to select manually */
    }
  });

  function placeDraft(lat, lng, recentre) {
    if (draftMarker) draftMarker.remove();
    const el = document.createElement("div");
    el.className = "pm-pin-wrap";
    el.innerHTML = '<span class="pm-pin pm-pin-draft"></span>';
    draftMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);
    if (recentre) map.jumpTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13) });
  }

  // Clicking the map only sets a location while the composer is open, so it
  // does not hijack ordinary panning.
  function onMapClick(e) {
    if (composer.hidden) return;
    draft.lat = +e.lngLat.lat.toFixed(6);
    draft.lng = +e.lngLat.lng.toFixed(6);
    placeDraft(draft.lat, draft.lng, false);
    emit();
  }

  function emit() {
    if (!out) return;
    if (!draft.file) {
      out.textContent = "Choose an image to begin.";
      return;
    }
    if (draft.lat == null) {
      out.textContent = "Now click the map to set where this was taken.";
      return;
    }
    const entry = {
      file: draft.file,
      lat: draft.lat,
      lng: draft.lng,
      title: field("pm-title").value.trim() || draft.file,
      place: field("pm-place").value.trim(),
      date: field("pm-date").value,
    };
    out.textContent = JSON.stringify(entry, null, 2);
  }

  // ---- minimal EXIF GPS reader -------------------------------------------
  // Only what is needed: the GPS IFD and DateTimeOriginal. Hand-rolled rather
  // than pulling in another CDN dependency (and another CSP origin) for one
  // convenience feature. Returns null for anything it cannot parse.

  function readExif(file) {
    return new Promise((resolve) => {
      const slice = file.slice(0, 256 * 1024); // EXIF lives in the first block
      const fr = new FileReader();
      fr.onerror = () => resolve(null);
      fr.onload = () => {
        try {
          resolve(parseExif(new DataView(fr.result)));
        } catch {
          resolve(null);
        }
      };
      fr.readAsArrayBuffer(slice);
    });
  }

  function parseExif(view) {
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG
    let off = 2;
    while (off + 4 < view.byteLength) {
      if (view.getUint8(off) !== 0xff) return null;
      const marker = view.getUint8(off + 1);
      const size = view.getUint16(off + 2);
      if (marker === 0xe1) {
        // APP1 — check for the "Exif\0\0" signature
        if (view.getUint32(off + 4) !== 0x45786966) return null;
        return readTiff(view, off + 10);
      }
      off += 2 + size;
    }
    return null;
  }

  function readTiff(view, base) {
    const le = view.getUint16(base) === 0x4949; // "II" little-endian, "MM" big
    const u16 = (p) => view.getUint16(p, le);
    const u32 = (p) => view.getUint32(p, le);
    if (u16(base + 2) !== 42) return null;

    const entries = (dir, cb) => {
      const n = u16(dir);
      for (let i = 0; i < n; i++) cb(dir + 2 + i * 12);
    };
    const rational = (p) => u32(p) / u32(p + 4);
    const dms = (p) => rational(p) + rational(p + 8) / 60 + rational(p + 16) / 3600;

    let gpsDir = 0;
    let exifDir = 0;
    entries(base + u32(base + 4), (e) => {
      const tag = u16(e);
      if (tag === 0x8825) gpsDir = base + u32(e + 8);
      if (tag === 0x8769) exifDir = base + u32(e + 8);
    });

    const result = { lat: null, lng: null, date: "" };

    if (gpsDir) {
      let lat = null, lng = null, latRef = "N", lngRef = "E";
      entries(gpsDir, (e) => {
        const tag = u16(e);
        const valOff = base + u32(e + 8);
        if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(e + 8));
        if (tag === 0x0002) lat = dms(valOff);
        if (tag === 0x0003) lngRef = String.fromCharCode(view.getUint8(e + 8));
        if (tag === 0x0004) lng = dms(valOff);
      });
      if (lat != null && lng != null && isFinite(lat) && isFinite(lng)) {
        result.lat = +((latRef === "S" ? -lat : lat).toFixed(6));
        result.lng = +((lngRef === "W" ? -lng : lng).toFixed(6));
      }
    }

    if (exifDir) {
      entries(exifDir, (e) => {
        if (u16(e) !== 0x9003) return; // DateTimeOriginal
        let s = "";
        const p = base + u32(e + 8);
        for (let i = 0; i < 10; i++) s += String.fromCharCode(view.getUint8(p + i));
        // "2026:08:30" -> "2026-08-30"
        if (/^\d{4}:\d{2}:\d{2}$/.test(s)) result.date = s.replace(/:/g, "-");
      });
    }

    return result.lat == null && !result.date ? null : result;
  }
})();
