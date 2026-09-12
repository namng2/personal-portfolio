// ==========================================================================
// boot-theme.js — runs BEFORE first paint, from <head>, render-blocking.
//
// Its only job is to stamp data-theme / data-palette onto <html> so the page
// paints in the right colours immediately. Without it the browser paints the
// default palette and then repaints once theme.js loads at the end of <body>,
// which is a visible flash on every page load.
//
// Keep this file tiny and dependency-free. The real logic lives in theme.js;
// this must stay cheap enough to block rendering on.
// ==========================================================================

(function () {
  var root = document.documentElement;

  // Storage is unavailable in private modes and when the user blocks cookies;
  // in that case fall back to system preference rather than throwing here,
  // which would leave the page unstyled.
  var mode = null;
  var palette = null;
  try {
    mode = localStorage.getItem("theme");
    palette = localStorage.getItem("palette");
  } catch (e) {
    /* ignore — defaults below */
  }

  if (mode !== "light" && mode !== "dark") mode = "auto";
  if (mode === "auto") {
    mode = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  // Always written explicitly (rather than leaving dark implied by the absence
  // of the attribute) so selectors and the settings-panel probe never have to
  // special-case it.
  root.setAttribute("data-theme", mode);

  // Any unknown value is ignored, which lands on the default Midnight palette.
  if (palette && /^[a-z0-9-]+$/.test(palette) && palette !== "midnight") {
    root.setAttribute("data-palette", palette);
  }

  // ---- phone build ---------------------------------------------------------
  // On a handset the desktop becomes an iPhone home screen (mobile.css +
  // springboard.js). The decision is a class, not a media query alone, because
  // CSS and JS both have to agree on what counts as a phone — and it is
  // stamped here, before first paint, so the Mac layout never flashes first.
  //
  // The second clause catches a phone held sideways: 844x390 is wider than any
  // width-only breakpoint, but it is still a phone, and the desktop's windows
  // do not fit in 390px of height.
  var PHONE_MQ = "(max-width: 640px), (max-height: 500px) and (pointer: coarse)";
  window.__PHONE_MQ = PHONE_MQ;
  if (window.matchMedia && window.matchMedia(PHONE_MQ).matches) {
    root.classList.add("is-phone");
  }
})();
