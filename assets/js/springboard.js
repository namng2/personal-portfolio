// ==========================================================================
// springboard.js — the phone home screen.
//
// On a handset this site is an iPhone rather than a Mac. #springboard is the
// home screen; every section opens full-screen as an "app" and returns with
// the back control or the home indicator.
//
// Nothing here duplicates content. An icon calls __activateTab() and shows the
// browser window, so About exists in exactly one place whatever the screen
// size — the phone build changes the chrome around the sections, not the
// sections. The Map is the existing Map window, shown full-screen.
//
// Loaded last, after script.js: it calls __activateTab.
// Inert until <html> carries .is-phone (stamped by boot-theme.js).
// ==========================================================================

(function springboard() {
  const board = document.getElementById("springboard");
  const browser = document.getElementById("portfolio-app");
  if (!board || !browser) return;

  const root = document.documentElement;
  const mapWin = document.getElementById("map-app");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mq = window.matchMedia(window.__PHONE_MQ || "(max-width: 640px)");

  const TITLES = {
    about: "About",
    skills: "Skills",
    projects: "Projects",
    contact: "Contact",
    resume: "Resume",
    map: "Map",
  };
  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>';

  let open = null; // the app on screen, or null at the home screen
  let origin = null; // the icon it grew out of, so it can shrink back into it

  const isPhone = () => root.classList.contains("is-phone");
  const windowFor = (name) => (name === "map" ? mapWin : browser);

  // ---- chrome injected into a window while it is an app ---------------------
  // Built here rather than written into index.html because it is phone-only
  // behaviour: the markup and the code that drives it stay one unit.
  function ensureChrome(win, title, float) {
    let bar = win.querySelector(".ph-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "ph-bar";
      bar.innerHTML =
        '<button type="button" class="ph-back">' + CHEVRON + "<span>Home</span></button>" +
        '<span class="ph-title"></span>';
      bar.querySelector(".ph-back").addEventListener("click", homeTapped);
      win.insertBefore(bar, win.firstChild);
    }
    bar.classList.toggle("is-float", !!float);
    bar.querySelector(".ph-title").textContent = title || "";

    // No home indicator over the Map: its photo sheet owns the bottom edge,
    // and the floating back control already covers the gesture.
    if (!float && !win.querySelector(".ph-home")) {
      const home = document.createElement("button");
      home.type = "button";
      home.className = "ph-home";
      home.setAttribute("aria-label", "Back to the home screen");
      home.addEventListener("click", homeTapped);
      win.appendChild(home);
    }
  }

  // The Contacts-app header. Assembled from the panel that is already there,
  // so the addresses themselves are still written in one place.
  function contactCard() {
    const panel = document.getElementById("panel-contact");
    if (!panel || panel.querySelector(".ph-card")) return;
    const card = document.createElement("div");
    card.className = "ph-card";
    card.innerHTML =
      '<span class="ph-card-mono" aria-hidden="true">NN</span>' +
      '<span class="ph-card-name">Nam Nguyen</span>' +
      '<span class="ph-card-role">Software engineer</span>';
    panel.insertBefore(card, panel.firstChild);
  }

  // ---- opening and closing --------------------------------------------------
  function openApp(name, icon, { push = true } = {}) {
    if (!isPhone()) return;
    const win = windowFor(name);
    if (!win) return;

    if (open && open !== name) {
      const previous = windowFor(open);
      previous.hidden = true;
      previous.classList.remove("ph-open");
    }

    if (name === "map") {
      ensureChrome(win, TITLES.map, true);
    } else {
      if (name === "contact") contactCard();
      // fromHash keeps activate() from writing its own history entry on top of
      // the one pushed below; openResume keeps the Resume panel from throwing
      // the desktop modal at a phone.
      window.__activateTab?.(name, { fromHash: true, openResume: false });
      ensureChrome(win, TITLES[name] || name, false);
    }

    // photo-map.js watches #map-app for this attribute and builds the map on
    // first reveal, so showing the window is all that is needed to start it.
    win.hidden = false;
    win.classList.add("ph-open");
    open = name;
    origin = icon || null;

    board.setAttribute("aria-hidden", "true");
    if ("inert" in board) board.inert = true;
    grow(win, icon);
    // The map measures its own container and cannot do that while hidden.
    window.dispatchEvent(new CustomEvent("windowresized"));

    if (push) {
      try {
        history.pushState({ sbApp: name }, "", "#" + name);
      } catch (_) {
        /* some embedded contexts refuse pushState */
      }
    }
  }

  function closeToHome() {
    if (!open) return;
    const win = windowFor(open);
    const icon = origin;
    open = null;
    origin = null;
    board.removeAttribute("aria-hidden");
    if ("inert" in board) board.inert = false;
    shrink(win, icon, () => {
      win.hidden = true;
      win.classList.remove("ph-open");
    });
  }

  // Going home walks the history back when this session put the app there, so
  // the stack does not grow an entry per tap. A visitor who arrived straight
  // on #projects has no entry to go back to, so that one is rewritten instead.
  function homeTapped() {
    // Nothing open means nothing to go back from. Without this, a second tap
    // on a back control — an impatient double tap — walks the history past
    // this site's own entry and leaves the page.
    if (!open) return;
    if (history.state && history.state.sbApp) {
      history.back();
      return;
    }
    closeToHome();
    try {
      history.replaceState({}, "", location.pathname + location.search);
    } catch (_) {
      /* ignore */
    }
  }

  // ---- the zoom out of an icon and back into it -----------------------------
  function iconTransform(icon) {
    if (!icon || reduceMotion) return null;
    const r = icon.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const scale = Math.max(0.1, r.width / window.innerWidth);
    const dx = Math.round(r.left + r.width / 2 - window.innerWidth / 2);
    const dy = Math.round(r.top + r.height / 2 - window.innerHeight / 2);
    return `translate(${dx}px, ${dy}px) scale(${scale.toFixed(3)})`;
  }

  function grow(win, icon) {
    const from = iconTransform(icon);
    if (!from) return settle(win);
    win.style.transition = "none";
    win.style.transform = from;
    win.style.opacity = "0";
    void win.offsetWidth; // commit the start state before changing it
    win.classList.add("ph-anim");
    win.style.transform = "none";
    win.style.opacity = "1";
    whenDone(win, () => settle(win));
  }

  function shrink(win, icon, done) {
    const to = iconTransform(icon);
    if (!to) {
      settle(win);
      return done();
    }
    win.classList.add("ph-anim");
    void win.offsetWidth;
    win.style.transform = to;
    win.style.opacity = "0";
    whenDone(win, () => {
      settle(win);
      done();
    });
  }

  // transitionend alone is not enough: a transition that never runs — an
  // interrupted one, or a document the browser is not painting — would leave a
  // window stuck mid-flight.
  function whenDone(el, fn) {
    let fired = false;
    const once = () => {
      if (fired) return;
      fired = true;
      fn();
    };
    el.addEventListener("transitionend", once, { once: true });
    setTimeout(once, 420);
  }

  // End by forcing the final values rather than clearing them: a transition
  // still in flight keeps its computed value at the start, which leaves a
  // window invisible at icon size.
  function settle(win) {
    win.classList.remove("ph-anim");
    win.style.transition = "none";
    win.style.transform = "none";
    win.style.opacity = "1";
    void win.offsetWidth;
    win.style.transition = "";
    win.style.opacity = "";
  }

  // ---- wiring ---------------------------------------------------------------
  board.addEventListener("click", (e) => {
    const target = e.target.closest("[data-sb-app]");
    if (!target) return;
    const name = target.dataset.sbApp;
    e.preventDefault();
    // Appearance is a real settings panel, not a section: theme.js owns it.
    if (name === "settings") return window.__openThemeSettings?.();
    openApp(name, target);
  });

  window.addEventListener("popstate", (e) => {
    if (!isPhone()) return;
    const name = e.state && e.state.sbApp;
    if (name && TITLES[name]) openApp(name, origin, { push: false });
    else closeToHome();
  });

  // A phone turned on its side is still a phone, and a desktop browser window
  // dragged narrow becomes one. Both directions have to leave a coherent
  // screen behind.
  function syncMode() {
    root.classList.toggle("is-phone", mq.matches);
    if (mq.matches) {
      if (!open) {
        browser.hidden = true;
        browser.classList.remove("ph-open");
        if (mapWin) mapWin.hidden = true;
      }
    } else {
      open = null;
      origin = null;
      board.removeAttribute("aria-hidden");
      if ("inert" in board) board.inert = false;
      [browser, mapWin].forEach((win) => {
        if (!win) return;
        win.classList.remove("ph-open");
        settle(win);
      });
      browser.hidden = false;
    }
  }

  if (mq.addEventListener) mq.addEventListener("change", syncMode);
  else if (mq.addListener) mq.addListener(syncMode);

  // A link that names a section opens that app directly — the phone build must
  // honour the same deep links the desktop does.
  function initialApp() {
    const name = decodeURIComponent(location.hash.replace(/^#/, "")).trim();
    return TITLES[name] ? name : null;
  }

  syncMode();
  if (isPhone()) {
    const first = initialApp();
    if (first) {
      try {
        history.replaceState({ sbApp: first }, "", "#" + first);
      } catch (_) {
        /* ignore */
      }
      openApp(first, null, { push: false });
    }
  }
})();
