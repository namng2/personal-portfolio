// ==========================================================================
// phone-mirror.js — the Phone window.
//
// The window itself is built in index.html and driven by the window manager
// in script.js like any other app; its screen is an <iframe> of this page
// with ?mirror=1, which makes the framed copy stamp itself .is-phone and come
// up as the home screen. So there is nothing here about what the phone looks
// like — that is mobile.css and springboard.js, unchanged and unaware.
//
// Three things the frame cannot do for itself are left:
//
//   1. Fit. The phone is 874px of device and the Mac may not have 874px to
//      spare, so the whole object is scaled. Scaled, not resized: the page
//      inside has to keep laying itself out at 393px or it stops being a
//      phone and starts being a narrow desktop.
//   2. Zoom. Stretching a phone across the desktop would be nonsense, so the
//      green light grows the device instead — up to the whole of the room
//      between the menu bar and the dock, past actual size on a tall screen.
//      script.js hands the request over rather than maximising the window.
//   3. Focus. Clicks inside an iframe never reach the page around it, so
//      without this the Phone window would be the one window on the desktop
//      that does not come to the front when you use it.
// ==========================================================================

(function phoneMirror() {
  const root = document.documentElement;
  // Nothing to mirror from inside the mirror, and a phone is already a phone.
  if (root.classList.contains("is-mirror")) return;

  const win = document.getElementById("phone-app");
  if (!win) return;
  const frame = win.querySelector(".phone-screen");

  let zoomed = false;

  // ---- fit the device to the screen -----------------------------------------
  const px = (name, fallback) => {
    const v = parseFloat(getComputedStyle(win).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  const deskVar = (name) =>
    parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;

  function fit() {
    // Read the device back out of the stylesheet rather than repeating its
    // numbers here: styles.css owns how big a phone is.
    const edge = px("--rim", 2) + px("--bez", 9);
    const deviceW = px("--scr-w", 393) + 2 * edge;
    const deviceH = px("--scr-h", 852) + 2 * edge;
    const pad = px("--pad", 14);
    const furniture = px("--bar", 34) + 2 * pad;

    // The desktop's menu bar and dock are painted above every window, so a
    // window that grows past either is not bigger, it is partly hidden. Both
    // sizes below stay inside what is left, and the window's own centring in
    // styles.css then lands it with even margins.
    const room = window.innerHeight - deskVar("--menubar-h") - deskVar("--dock-h") - furniture - 28;
    const across = window.innerWidth - 2 * pad - 32;
    const full = Math.min(room / deviceH, across / deviceW);

    // At rest the phone leaves the desktop around it visible and never draws
    // itself larger than life. Zoomed it takes the room it can — which is
    // always about a fifth more, so the light always does something — and may
    // go past actual size on a tall screen, since that is what was asked for.
    let scale = zoomed ? Math.min(full, 1.5) : Math.min(full * 0.82, 1);
    scale = Math.max(0.5, scale);
    win.style.setProperty("--s", scale.toFixed(3));
  }

  let queued = false;
  function refit() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fit();
    });
  }

  fit();
  window.addEventListener("resize", refit);

  // ---- the zoom light --------------------------------------------------------
  // The window grows around its top-left corner, so one that had been dragged
  // near an edge would walk off the screen as it grew. Centring is what macOS
  // does when a window zooms, and here it also clears the inline position so
  // the stylesheet's own centring takes the new size into account.
  win.addEventListener("zoomrequest", () => {
    zoomed = !zoomed;
    fit();
    if (win.classList.contains("is-focused")) window.__centerWindow?.();
  });

  // Closing an app and opening it again gets you its default size, the way it
  // does everywhere else on this desktop — minimising, which keeps the window
  // exactly as you left it, deliberately does not go through here.
  win.querySelector("[data-app-close]")?.addEventListener("click", () => {
    zoomed = false;
    fit();
  });

  // ---- clicking the screen brings the window forward -------------------------
  // The page loses focus to the frame; the frame is what has it afterwards.
  // Re-opening an already-open window only raises it, and focus stays where
  // the visitor put it.
  window.addEventListener("blur", () => {
    if (win.hidden || document.activeElement !== frame) return;
    window.__openApp?.("phone", { focus: false, animate: false });
  });
})();
