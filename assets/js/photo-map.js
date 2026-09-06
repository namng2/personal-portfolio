// ==========================================================================
// photo-map.js — the Map tab: photo thumbnails pinned where they were taken.
//
// Provider: MapLibre GL JS + OpenStreetMap Standard raster tiles. MapLibre is
// renderer-independent, while the colorful OSM layer needs no API key — an
// important property for a public static repo where every client secret would
// be readable. The provider details live in MAP_STYLE so a future tile service
// can be swapped without touching the marker, popup, or authoring code.
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
  const panel = document.querySelector('[data-panel="map"]');
  const host = document.getElementById("photo-map");
  if (!panel || !host || typeof maplibregl === "undefined") return;

  const PHOTO_DIR = "assets/photos/";
  const MANIFEST = "assets/data/photos.json";
  // OpenFreeMap: OpenStreetMap vector tiles, no API key and no signup, which is
  // the constraint that rules out most alternatives on a public repo. Liberty
  // is the Google-Maps-like style; Dark is its night counterpart, so the map
  // gets a real dark basemap instead of a CSS filter over a light one.
  // Everything the styles reference — vector tiles, glyphs, sprites, the
  // Natural Earth raster underlay — comes from tiles.openfreemap.org, so that
  // single host is all the CSP has to allow.
  const STYLES = {
    light: "https://tiles.openfreemap.org/styles/liberty",
    dark: "https://tiles.openfreemap.org/styles/dark",
  };
  const POPUP_OFFSET = {
    center: [0, -36],
    top: [0, 8],
    "top-left": [0, 8],
    "top-right": [0, 8],
    bottom: [0, -72],
    "bottom-left": [0, -72],
    "bottom-right": [0, -72],
    left: [8, -36],
    right: [-8, -36],
  };

  // Declared up here, not down by the composer, because build() consults it
  // and build() can run before that point.
  const IS_LOCAL =
    location.protocol === "file:" ||
    /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname) ||
    location.hostname.endsWith(".local");

  let map = null;
  let markers = [];
  let photos = [];
  let photoBounds = null;
  let userMoved = false;

  const currentMode = () =>
    window.__getResolvedTheme?.() === "light" ? "light" : "dark";

  // Markers are DOM overlays, not part of the style, so they survive setStyle.
  window.addEventListener("themechange", () => {
    if (map) map.setStyle(STYLES[currentMode()]);
  });

  // ---- init ---------------------------------------------------------------
  // Built on first reveal, not at load: MapLibre measures its container, and
  // the panel is display:none until its tab is opened.

  function build() {
    if (map) return;

    map = new maplibregl.Map({
      container: host,
      style: STYLES[currentMode()],
      center: [-122.4194, 37.7749],
      zoom: 11,
      minZoom: 2,
      maxZoom: 19,
      renderWorldCopies: false,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-right");

    // The window is resizable from any corner, and MapLibre only measures its
    // container when told to. Without this the tiles keep the old dimensions
    // and cover part of the box. Coalesced into a frame so a drag does not
    // trigger a re-measure per pointer event.
    if (typeof ResizeObserver !== "undefined") {
      let queued = false;
      new ResizeObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          map.resize();
          fitToPhotos();
        });
      }).observe(host);
    }
    // Composer-only, and gated on IS_LOCAL: onMapClick closes over `composer`,
    // which is never initialised on the deployed site.
    if (IS_LOCAL) map.on("click", onMapClick);

    // Once the visitor pans or zooms, stop re-framing the view under them.
    // Read from DOM events rather than MapLibre's movestart/zoomstart, because
    // fitBounds fires those itself and would instantly mark the map as moved.
    ["pointerdown", "wheel", "keydown"].forEach((evt) =>
      host.addEventListener(evt, () => { userMoved = true; }, { passive: true })
    );

    // Deliberately NOT map.once("load", load). Gating the manifest on the
    // basemap means one bad tile response takes the photographs down with it —
    // markers are DOM overlays and do not need the style to exist. Worst case
    // is pins over an empty background rather than an empty map.
    load();
  }

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

  const valid = (p) => {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    return Boolean(
      p && photoSrc(p) && Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    );
  };

  function render() {
    markers.forEach((marker) => marker.remove());
    markers = [];
    const bounds = new maplibregl.LngLatBounds();

    photos.forEach((p, index) => {
      const position = [Number(p.lng), Number(p.lat)];
      const popup = new maplibregl.Popup({
        className: "pm-popup",
        closeOnMove: true,
        maxWidth: "250px",
        offset: POPUP_OFFSET,
        padding: 8,
      }).setDOMContent(popupElement(p, index));
      const marker = new maplibregl.Marker({ element: thumbElement(p), anchor: "bottom" })
        .setLngLat(position)
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
      bounds.extend(position);
    });

    const empty = document.getElementById("pm-empty");
    if (empty) empty.hidden = photos.length > 0;
    const count = document.getElementById("pm-count");
    if (count) {
      count.textContent = photos.length
        ? `${photos.length} photo${photos.length === 1 ? "" : "s"}`
        : "";
    }

    if (photos.length === 1) {
      map.jumpTo({ center: bounds.getCenter(), zoom: 13 });
    } else if (photos.length > 1) {
      photoBounds = bounds;
      fitToPhotos();
    }
  }

  // The panel starts display:none and the window is resizable, so the first fit
  // routinely runs against a mis-measured container and lands the view nowhere
  // near the photographs. Re-fit whenever the size changes, until the visitor
  // takes over.
  function fitToPhotos() {
    if (userMoved || !map || !photoBounds) return;
    map.fitBounds(photoBounds, { padding: 50, maxZoom: 14, duration: 0 });
  }

  // Thumbnail pin, in the style of the Photos-on-a-map pin: rounded image with
  // a pointer beneath it. A real button preserves keyboard access to popups.
  function thumbElement(p) {
    const label = p.title || p.place || p.file;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pm-pin-wrap";
    button.title = label;
    button.setAttribute("aria-label", `Open photo: ${label}`);
    button.innerHTML =
      '<span class="pm-pin">' +
      `<img src="${escAttr(photoSrc(p))}" alt="${escAttr(p.title || "")}" loading="lazy">` +
      "</span>";
    return button;
  }

  function popupElement(p, index) {
    const bits = [];
    if (p.title) bits.push(`<h4 class="pm-pop-title">${esc(p.title)}</h4>`);
    const meta = [p.place, formatDate(p.date)].filter(Boolean).map(esc).join(" · ");
    if (meta) bits.push(`<p class="pm-pop-meta">${meta}</p>`);
    const content = document.createElement("div");
    content.innerHTML =
      `<button type="button" class="pm-pop-open" ` +
      `aria-label="View ${escAttr(p.title || "photo")} full size">` +
      `<img class="pm-pop-img" src="${escAttr(photoSrc(p))}" alt="${escAttr(p.title || "")}">` +
      `<span class="pm-pop-zoom" aria-hidden="true">View full size</span></button>` +
      bits.join("");
    content.querySelector(".pm-pop-open").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBox(index);
    });
    return content;
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

  // ---- reveal -------------------------------------------------------------
  // The panel is hidden until its tab is picked; MapLibre needs telling once it
  // has real dimensions or it renders a grey box with misplaced tiles.

  new MutationObserver(() => {
    if (!panel.classList.contains("active")) return;
    build();
    requestAnimationFrame(() => {
      map?.resize();
      fitToPhotos();
    });
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });

  if (panel.classList.contains("active")) build();

  // ---- composer -----------------------------------------------------------
  // Author-only. Nothing here could ever publish for a visitor — the composer
  // just prints JSON on screen, and a static host has no endpoint to write to
  // — but leaving the button on the live site reads as "anyone can upload".
  // So on anything other than a local dev server the markup is removed
  // outright rather than hidden, which also keeps it out of the tab order and
  // out of screen readers.
  if (!IS_LOCAL) {
    document.getElementById("pm-composer")?.remove();
    document.getElementById("pm-add")?.remove();
    return;
  }

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
    const element = document.createElement("span");
    element.className = "pm-pin-wrap is-draft";
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = '<span class="pm-pin pm-pin-draft"></span>';
    draftMarker = new maplibregl.Marker({ element, anchor: "bottom" })
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
