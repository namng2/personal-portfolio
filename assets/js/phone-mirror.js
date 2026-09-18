// ==========================================================================
// phone-mirror.js — the iPhone Mirroring window.
//
// The window itself is built in index.html and driven by the window manager
// in script.js like any other app; its screen is an <iframe> of this page
// with ?mirror=1, which makes the framed copy stamp itself .is-phone and come
// up as the home screen. So there is nothing here about what the phone looks
// like — that is mobile.css and springboard.js, unchanged and unaware.
//
// Two things the frame cannot do for itself are left:
//
//   1. Fit. The phone is 874px of device and the Mac may not have 874px to
//      spare, so the whole object is scaled. Scaled, not resized: the page
//      inside has to keep laying itself out at 393px or it stops being a
//      phone and starts being a narrow desktop.
//   2. Focus. Clicks inside an iframe never reach the page around it, so
//      without this the mirror would be the one window on the desktop that
//      does not come to the front when you use it.
// ==========================================================================

(function phoneMirror() {
  const root = document.documentElement;
  // Nothing to mirror from inside the mirror, and a phone is already a phone.
  if (root.classList.contains("is-mirror")) return;

  const win = document.getElementById("phone-app");
  if (!win) return;
  const frame = win.querySelector(".phone-screen");

  // ---- fit the device to the screen -----------------------------------------
  const px = (name, fallback) => {
    const v = parseFloat(getComputedStyle(win).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  function fit() {
    // Read the device back out of the stylesheet rather than repeating its
    // numbers here: styles.css owns how big a phone is.
    const deviceH = px("--scr-h", 852) + 2 * (px("--rim", 2) + px("--bez", 9));
    const gutter = px("--gutter", 34);
    const chrome = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
    // 28px of daylight so the phone never sits flush against the dock.
    const room = window.innerHeight - chrome("--menubar-h") - chrome("--dock-h") - gutter - 28;
    // Below about half size the screen stops being readable, and a phone that
    // runs off the bottom of a very short window is the better failure.
    const scale = Math.min(1, Math.max(0.5, room / deviceH));
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

  // ---- clicking the screen brings the window forward -------------------------
  // The page loses focus to the frame; the frame is what has it afterwards.
  // Re-opening an already-open window only raises it, and focus stays where
  // the visitor put it.
  window.addEventListener("blur", () => {
    if (win.hidden || document.activeElement !== frame) return;
    window.__openApp?.("phone", { focus: false, animate: false });
  });
})();
