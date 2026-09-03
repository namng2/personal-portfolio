// ==========================================================================
// photo-map.js — the Map tab: photo thumbnails pinned where they were taken.
//
// Provider: Leaflet + Esri's Gray Canvas basemaps. Chosen because they need
// no API key, which matters on a public static repo where any key would be
// readable in the source, and because they come as a matching light/dark pair
// so the map follows the palette system instead of fighting it.
// (CARTO's basemaps look similar but now serve an "API KEY REQUIRED"
// watermark — the tiles still return HTTP 200, so check the pixels, not the
// status code, if this ever needs revisiting.)
//
// Esri splits labels out of the basemap, so each mode is two layers: the gray
// canvas underneath and a transparent reference layer of place names on top.
// Note the tile path is {z}/{y}/{x}, not Leaflet's usual {z}/{x}/{y}.
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
  if (!panel || !host || typeof L === "undefined") return;

  const PHOTO_DIR = "assets/photos/";
  const MANIFEST = "assets/data/photos.json";
  const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/";
  const TILES = {
    light: {
      base: ESRI + "World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      labels: ESRI + "World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    },
    dark: {
      base: ESRI + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      labels: ESRI + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    },
  };
  const ATTRIB =
    'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>';
  // The canvas tiles stop at z16; past that Leaflet upscales the last real
  // tile instead of requesting 404s, so zooming in stays smooth.
  const TILE_OPTS = { attribution: ATTRIB, maxNativeZoom: 16, maxZoom: 19 };

  let map = null;
  let baseLayer = null;
  let labelLayer = null;
  let markerGroup = null;
  let photos = [];

  // ---- init ---------------------------------------------------------------
  // Built on first reveal, not at load: Leaflet measures its container, and
  // the panel is display:none until its tab is opened.

  function build() {
    if (map) return;

    map = L.map(host, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      // Keeps the world from repeating sideways when zoomed out.
      worldCopyJump: true,
      minZoom: 2,
    }).setView([37.7749, -122.4194], 11);

    const set = TILES[currentMode()];
    baseLayer = L.tileLayer(set.base, TILE_OPTS).addTo(map);
    labelLayer = L.tileLayer(set.labels, { ...TILE_OPTS, attribution: "" }).addTo(map);

    markerGroup = L.layerGroup().addTo(map);
    load();
  }

  const currentMode = () =>
    window.__getResolvedTheme?.() === "light" ? "light" : "dark";

  // Swap basemaps with the palette rather than CSS-filtering the tiles, so
  // place names stay legible in both modes.
  window.addEventListener("themechange", () => {
    if (!baseLayer) return;
    const set = TILES[currentMode()];
    baseLayer.setUrl(set.base);
    labelLayer.setUrl(set.labels);
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

  const valid = (p) =>
    p && typeof p.file === "string" && isFinite(p.lat) && isFinite(p.lng);

  function render() {
    markerGroup.clearLayers();
    const bounds = [];

    photos.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: thumbIcon(p), title: p.title || p.file });
      marker.bindPopup(popupHtml(p), { className: "pm-popup", maxWidth: 320, minWidth: 240 });
      marker.addTo(markerGroup);
      bounds.push([p.lat, p.lng]);
    });

    const empty = document.getElementById("pm-empty");
    if (empty) empty.hidden = photos.length > 0;
    const count = document.getElementById("pm-count");
    if (count) {
      count.textContent = photos.length
        ? `${photos.length} photo${photos.length === 1 ? "" : "s"}`
        : "";
    }

    if (bounds.length === 1) map.setView(bounds[0], 13);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }

  // Thumbnail pin, in the style of the Photos-on-a-map pin: rounded image with
  // a pointer beneath it. divIcon rather than an image icon so it can be styled
  // with the site's own tokens.
  function thumbIcon(p) {
    return L.divIcon({
      className: "pm-pin-wrap",
      html:
        '<span class="pm-pin">' +
        `<img src="${escAttr(PHOTO_DIR + p.file)}" alt="${escAttr(p.title || "")}" loading="lazy">` +
        "</span>",
      iconSize: [64, 72],
      iconAnchor: [32, 72],
      popupAnchor: [0, -70],
    });
  }

  function popupHtml(p) {
    const bits = [];
    if (p.title) bits.push(`<h4 class="pm-pop-title">${esc(p.title)}</h4>`);
    const meta = [p.place, formatDate(p.date)].filter(Boolean).map(esc).join(" · ");
    if (meta) bits.push(`<p class="pm-pop-meta">${meta}</p>`);
    return (
      `<img class="pm-pop-img" src="${escAttr(PHOTO_DIR + p.file)}" alt="${escAttr(p.title || "")}">` +
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

  // ---- reveal -------------------------------------------------------------
  // The panel is hidden until its tab is picked; Leaflet needs telling once it
  // has real dimensions or it renders a grey box with misplaced tiles.

  new MutationObserver(() => {
    if (!panel.classList.contains("active")) return;
    build();
    requestAnimationFrame(() => map.invalidateSize());
  }).observe(panel, { attributes: true, attributeFilter: ["class"] });

  if (panel.classList.contains("active")) build();

  // ---- composer -----------------------------------------------------------

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
      map.removeLayer(draftMarker);
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
      map.removeLayer(draftMarker);
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
    if (draftMarker) map.removeLayer(draftMarker);
    draftMarker = L.marker([lat, lng], {
      icon: L.divIcon({ className: "pm-pin-wrap", html: '<span class="pm-pin pm-pin-draft"></span>', iconSize: [64, 72], iconAnchor: [32, 72] }),
    }).addTo(map);
    if (recentre) map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }

  // Clicking the map only sets a location while the composer is open, so it
  // does not hijack ordinary panning.
  function onMapClick(e) {
    if (composer.hidden) return;
    draft.lat = +e.latlng.lat.toFixed(6);
    draft.lng = +e.latlng.lng.toFixed(6);
    placeDraft(draft.lat, draft.lng, false);
    emit();
  }
  const wire = setInterval(() => {
    if (!map) return;
    map.on("click", onMapClick);
    clearInterval(wire);
  }, 200);

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
