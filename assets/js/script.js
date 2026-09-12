// ==========================================================================
// Portfolio interactivity — B&W, motion-heavy. GSAP for reveals, vanilla JS
// for particles, custom cursor, tilt, typewriter, modal.
// ==========================================================================

document.getElementById("year").textContent = new Date().getFullYear();

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Canvas can't read CSS custom properties, so mirror the active palette's text
// colour into an "r, g, b" string. --seed-fg is always a plain hex (the derived
// tokens are color-mix() and would need resolving), and theme.js fires
// "themechange" whenever the palette or mode moves.
let particleRGB = "245, 245, 245";
function refreshParticleColor() {
  const hex = getComputedStyle(document.documentElement)
    .getPropertyValue("--seed-fg")
    .trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return; // keep the last good value rather than drawing nothing
  const n = parseInt(m[1], 16);
  particleRGB = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
refreshParticleColor();
window.addEventListener("themechange", refreshParticleColor);

function particleColor(alpha) {
  return `rgba(${particleRGB}, ${alpha})`;
}

// --------------------------------------------------------------------------
// Particle background — dots + connecting lines, mouse-repel.
// --------------------------------------------------------------------------
(function particles() {
  const canvas = document.getElementById("bg");
  const ctx = canvas.getContext("2d");
  let w, h, dpr;
  const mouse = { x: -9999, y: -9999 };
  const count = Math.min(90, Math.floor((window.innerWidth * window.innerHeight) / 22000));
  const particles = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = window.innerWidth * dpr;
    h = canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function init() {
    resize();
    particles.length = 0;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3 * dpr,
        vy: (Math.random() - 0.5) * 0.3 * dpr,
        r: (Math.random() * 1.4 + 0.4) * dpr,
      });
    }
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      // mouse repel
      const dx = p.x - mouse.x * dpr;
      const dy = p.y - mouse.y * dpr;
      const d2 = dx * dx + dy * dy;
      const radius = 120 * dpr;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 1;
        const force = (radius - d) / radius;
        p.vx += (dx / d) * force * 0.4;
        p.vy += (dy / d) * force * 0.4;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;

      if (p.x < 0) p.x = w;
      else if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      else if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = particleColor(0.55);
      ctx.fill();
    }

    // connecting lines
    const linkDist = 110 * dpr;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < linkDist) {
          const alpha = (1 - d / linkDist) * 0.25;
          ctx.strokeStyle = particleColor(alpha);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(step);
  }

  window.addEventListener("resize", init);
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseout", () => {
    mouse.x = -9999; mouse.y = -9999;
  });

  init();
  if (!prefersReducedMotion) step();
})();

// --------------------------------------------------------------------------
// Custom cursor (dot + ring with easing)
// --------------------------------------------------------------------------
(function customCursor() {
  if (!isFinePointer) return;
  const dot = document.getElementById("cursor");
  const ring = document.getElementById("cursor-ring");
  let mx = 0, my = 0, rx = 0, ry = 0;

  window.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    document.body.classList.add("cursor-ready");
    // The ring belongs to the window. Over the desktop it reads as a stray
    // artefact, and over a resize corner it hides the arrows that matter, so
    // in both cases hand back to a real cursor.
    const t = e.target;
    document.body.classList.toggle("cursor-outside", !t?.closest?.(".browser"));
    document.body.classList.toggle("cursor-on-handle", !!t?.closest?.(".resize-handle"));
  });

  // How hard the ring chases the pointer each frame: 1 locks it to the dot,
  // lower values trail further behind.
  const RING_EASE = 0.45;

  function animate() {
    rx += (mx - rx) * RING_EASE;
    ry += (my - ry) * RING_EASE;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(animate);
  }
  animate();

  const hoverables = "a, button, .chip, .card, [data-tilt]";
  document.querySelectorAll(hoverables).forEach((el) => {
    el.addEventListener("mouseenter", () => document.body.classList.add("cursor-active"));
    el.addEventListener("mouseleave", () => document.body.classList.remove("cursor-active"));
  });
})();

// --------------------------------------------------------------------------
// Typewriter rotator
// --------------------------------------------------------------------------
(function rotator() {
  const el = document.getElementById("rotator");
  if (!el) return;
  const words = [
    "reliable software",
    "clean APIs",
    "tiny tools",
    "fast systems",
    "thoughtful UIs",
  ];
  let idx = 0, char = 0, deleting = false;

  function tick() {
    const word = words[idx];
    if (!deleting) {
      char++;
      el.textContent = word.slice(0, char);
      if (char === word.length) {
        deleting = true;
        return setTimeout(tick, 1600);
      }
      setTimeout(tick, 70);
    } else {
      char--;
      el.textContent = word.slice(0, char);
      if (char === 0) {
        deleting = false;
        idx = (idx + 1) % words.length;
        return setTimeout(tick, 250);
      }
      setTimeout(tick, 35);
    }
  }
  if (!prefersReducedMotion) tick();
})();

// --------------------------------------------------------------------------
// Card tilt on hover
// --------------------------------------------------------------------------
(function tilt() {
  if (prefersReducedMotion || !isFinePointer) return;
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -10;
      const ry = (px - 0.5) * 12;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
      card.style.setProperty("--mx", px * 100 + "%");
      card.style.setProperty("--my", py * 100 + "%");
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
})();

// --------------------------------------------------------------------------
// Scroll reveals + progress bar (GSAP if available)
// --------------------------------------------------------------------------
(function reveals() {
  const progress = document.getElementById("progress");
  function updateProgress() {
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100;
    progress.style.width = pct + "%";
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  if (prefersReducedMotion) {
    document.querySelectorAll("[data-reveal]").forEach((el) => (el.style.opacity = 1));
    return;
  }

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%" },
      });
    });
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.transition = "opacity 0.9s ease, transform 0.9s ease";
            e.target.style.opacity = 1;
            e.target.style.transform = "none";
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
  }
})();

// --------------------------------------------------------------------------
// Browser tab switching + address bar
// --------------------------------------------------------------------------
(function tabs() {
  const tabBar = document.querySelector(".tab-bar");
  const tabs = document.querySelectorAll(".tab[data-tab]");
  const panels = document.querySelectorAll(".panel[data-panel]");
  const urlDisplay = document.getElementById("url-display");
  const backButton = document.querySelector('[data-nav="back"]');
  const forwardButton = document.querySelector('[data-nav="forward"]');
  const visited = ["home"];
  let visitIndex = 0;

  function syncHistoryButtons() {
    if (backButton) backButton.disabled = visitIndex === 0;
    if (forwardButton) forwardButton.disabled = visitIndex === visited.length - 1;
  }

  function activate(name, options = {}) {
    const target = Array.from(tabs).find((tab) => tab.dataset.tab === name);
    if (!target) return;
    const record = options.record !== false;

    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      const on = p.dataset.panel === name;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    if (urlDisplay) urlDisplay.textContent = "portfolio://" + name;

    // Keep the real address in step so a section can be linked, bookmarked or
    // shared. replaceState rather than pushState: the window chrome's own
    // back/forward run on an internal stack, and pushing here would interleave
    // two histories that disagree.
    if (!options.fromHash) {
      try {
        history.replaceState(
          null,
          "",
          name === "home" ? location.pathname + location.search : "#" + name
        );
      } catch (_) {
        /* file:// and some embedded contexts refuse replaceState */
      }
    }
    document.querySelector(".viewport")?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });

    if (record && visited[visitIndex] !== name) {
      visited.splice(visitIndex + 1);
      visited.push(name);
      visitIndex = visited.length - 1;
    }
    syncHistoryButtons();

    // The Resume tab is still a real tab: select its panel first, then open the
    // full document. Closing the modal now leaves a coherent Resume screen.
    if (name === "resume" && options.openResume !== false) {
      requestAnimationFrame(() => {
        document.querySelector('#panel-resume [data-open-resume]')?.click();
      });
    }
  }

  tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));

  tabBar?.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const ordered = Array.from(tabBar.querySelectorAll(".tab[data-tab]"));
    const current = ordered.indexOf(e.target.closest(".tab[data-tab]"));
    if (current === -1) return;
    e.preventDefault();
    let next = current;
    if (e.key === "ArrowLeft") next = (current - 1 + ordered.length) % ordered.length;
    if (e.key === "ArrowRight") next = (current + 1) % ordered.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = ordered.length - 1;
    ordered[next].focus();
    activate(ordered[next].dataset.tab);
  });

  function moveHistory(direction) {
    const next = visitIndex + direction;
    if (next < 0 || next >= visited.length) return;
    visitIndex = next;
    activate(visited[visitIndex], { record: false });
  }
  backButton?.addEventListener("click", () => moveHistory(-1));
  forwardButton?.addEventListener("click", () => moveHistory(1));
  syncHistoryButtons();

  // Any element with data-goto navigates to that tab
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-goto]");
    if (!trigger) return;
    e.preventDefault();
    activate(trigger.dataset.goto);
  });

  // Expose for other modules
  // A URL that names a section opens it. Suppress the resume modal here: a
  // deep link should land on the section, not throw a full-screen overlay at
  // someone who has just arrived.
  function activateFromHash() {
    const name = decodeURIComponent(location.hash.replace(/^#/, "")).trim();
    if (!name) return;
    if (!Array.from(tabs).some((t) => t.dataset.tab === name)) return;
    activate(name, { fromHash: true, openResume: false });
  }
  window.addEventListener("hashchange", activateFromHash);
  activateFromHash();

  window.__activateTab = activate;
})();

// --------------------------------------------------------------------------
// Draggable browser window — grab the chrome strip to move it around
// --------------------------------------------------------------------------
(function windowManager() {
  // One manager for every .window on the desktop — the browser and the Map
  // app. Each gets its own drag, resize and zoom state; the desktop keeps a
  // single stacking order so the last window touched comes to the front.
  const wins = [...document.querySelectorAll(".window")];
  if (!wins.length) return;

  const MIN_W = 420;
  const MIN_H = 320;
  const EDGE = 8; // breathing room against the viewport
  // Phone-shaped, not merely narrow. This is the same test boot-theme.js uses
  // to stamp .is-phone, so a phone in landscape — wide, but 390px tall — is
  // not handed the desktop's auto-opened windows and flight animations.
  const compact = () =>
    document.documentElement.classList.contains("is-phone") ||
    window.matchMedia("(max-width: 640px)").matches;
  const topLimit = () =>
    parseInt(getComputedStyle(document.documentElement).getPropertyValue("--menubar-h"), 10) || 0;

  // Contents that measure themselves — the map's WebGL canvas — need telling
  // when their window changes size. ResizeObserver covers the live drag, but
  // this fires the moment a gesture ends so nothing can be left stale, and it
  // is targeted rather than a synthetic window "resize", which would pointlessly
  // re-seed the particle field and close any open menu.
  const announce = () => window.dispatchEvent(new CustomEvent("windowresized"));

  const controllers = new Map();
  const dockItems = [...document.querySelectorAll("[data-dock]")];

  // A function declaration, not a const arrow: raise() calls syncDock() during
  // init, before the dock block further down has been evaluated, so anything
  // it reaches for has to be hoisted or the module dies in the dead zone.
  function resolve(id) {
    return document.getElementById(String(id).endsWith("-app") ? id : id + "-app");
  }
  let z = 30;          // stays well under the menu bar at 500
  let focused = wins[0];

  // macOS names the frontmost application in the menu bar; so does this.
  const APP_NAMES = { "map-app": "Map", "resume-app": "Preview" };
  const appNameEl = document.querySelector(".mb-app");

  function raise(win) {
    focused = win;
    wins.forEach((w) => w.classList.toggle("is-focused", w === win));
    if (appNameEl) appNameEl.textContent = APP_NAMES[win.id] || "Portfolio";
    syncDock();
    if (compact()) return;
    win.style.zIndex = ++z;
  }

  function build(win) {
    const chrome = win.querySelector(".browser-chrome, .app-chrome");
    const handles = [...win.querySelectorAll(".resize-handle")];

    // Centring is a CSS transform; dragging and resizing both need real
    // left/top first, or the window grows from its middle instead of from the
    // corner under the pointer.
    let pinned = false;
    function pin() {
      if (pinned) return;
      const r = win.getBoundingClientRect();
      win.style.transform = "none";
      win.style.left = r.left + "px";
      win.style.top = r.top + "px";
      pinned = true;
    }

    // ---- drag by the chrome ------------------------------------------------
    let drag = null;
    chrome?.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || compact()) return;
      // Never hijack a drag that started on a control inside the chrome.
      if (e.target.closest(".tab[data-tab], .tab-new, button, input")) return;
      pin();
      const r = win.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      win.classList.add("dragging-window");
      try { chrome.setPointerCapture(e.pointerId); } catch (_) {}
    });

    chrome?.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const w = win.offsetWidth;
      // Keep at least 80px horizontally and 40px vertically reachable, and
      // never let the title bar slide under the menu bar.
      const nl = Math.max(80 - w, Math.min(window.innerWidth - 80, drag.left + e.clientX - drag.x));
      const nt = Math.max(topLimit(), Math.min(window.innerHeight - 40, drag.top + e.clientY - drag.y));
      win.style.left = nl + "px";
      win.style.top = nt + "px";
    });

    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      try { chrome.releasePointerCapture(drag.id); } catch (_) {}
      drag = null;
      win.classList.remove("dragging-window");
    };
    chrome?.addEventListener("pointerup", endDrag);
    chrome?.addEventListener("pointercancel", endDrag);

    // ---- resize from any corner -------------------------------------------
    // Tracked as four edges rather than an origin plus a size: a corner drag
    // moves two of them and pins the opposite two, which is what keeps the far
    // corner still and stops the minimum size shunting the window sideways.
    let rs = null;
    handles.forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || compact()) return;
        e.preventDefault();
        e.stopPropagation();
        pin();
        win.classList.remove("maximized");
        const r = win.getBoundingClientRect();
        rs = {
          handle, id: e.pointerId, corner: handle.dataset.corner || "se",
          x: e.clientX, y: e.clientY,
          left: r.left, top: r.top, right: r.right, bottom: r.bottom,
        };
        win.classList.add("resizing-window");
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      });

      handle.addEventListener("pointermove", (e) => {
        if (!rs || e.pointerId !== rs.id) return;
        const dx = e.clientX - rs.x;
        const dy = e.clientY - rs.y;
        const c = rs.corner;
        let { left, top, right, bottom } = rs;
        if (c.includes("w")) left = Math.min(rs.left + dx, rs.right - MIN_W);
        if (c.includes("e")) right = Math.max(rs.right + dx, rs.left + MIN_W);
        if (c.includes("n")) top = Math.min(rs.top + dy, rs.bottom - MIN_H);
        if (c.includes("s")) bottom = Math.max(rs.bottom + dy, rs.top + MIN_H);

        left = Math.max(EDGE, left);
        top = Math.max(topLimit() + EDGE, top);
        right = Math.min(window.innerWidth - EDGE, right);
        bottom = Math.min(window.innerHeight - EDGE, bottom);

        win.style.left = left + "px";
        win.style.top = top + "px";
        win.style.width = Math.max(MIN_W, right - left) + "px";
        win.style.height = Math.max(MIN_H, bottom - top) + "px";
      });

      const endResize = (e) => {
        if (!rs || (e && e.pointerId !== rs.id)) return;
        try { rs.handle.releasePointerCapture(rs.id); } catch (_) {}
        rs = null;
        win.classList.remove("resizing-window");
        announce();
      };
      handle.addEventListener("pointerup", endResize);
      handle.addEventListener("pointercancel", endResize);
    });

    // ---- zoom / centre -----------------------------------------------------
    let restore = null;
    function toggleZoom() {
      if (win.classList.contains("maximized")) {
        win.classList.remove("maximized");
        if (restore) Object.assign(win.style, restore);
        restore = null;
      } else {
        const st = win.style;
        restore = { width: st.width, height: st.height, left: st.left, top: st.top, transform: st.transform };
        ["width", "height", "left", "top", "transform"].forEach((k) => (win.style[k] = ""));
        win.classList.add("maximized");
      }
      announce();
    }
    function centre() {
      ["left", "top", "width", "height", "transform"].forEach((k) => (win.style[k] = ""));
      win.classList.remove("maximized");
      pinned = false;
      announce();
    }

    // Touching anywhere in a window brings it forward.
    win.addEventListener("pointerdown", () => raise(win), true);
    win.querySelector("[data-app-zoom]")?.addEventListener("click", toggleZoom);
    win.querySelector("[data-app-close]")?.addEventListener("click", () => closeApp(win.id));
    win.querySelector("[data-app-min]")?.addEventListener("click", () => minimizeApp(win.id));

    controllers.set(win, { pin, toggleZoom, centre });
  }

  wins.forEach(build);
  // The browser is the front application at load. Raising whichever window
  // happens to be last in the markup named the Resume app ("Preview") in the
  // menu bar on phones, where the auto-open block below never runs to correct
  // it.
  raise(document.querySelector(".browser") || wins[wins.length - 1]);

  // ---- opening and closing app windows -------------------------------------
  const everOpened = new Set();
  function openApp(id, { focus = true, animate = true } = {}) {
    const win = document.getElementById(id + "-app");
    if (!win) return;
    // Only a window actually coming back from the dock should fly. Launching
    // one that is already on screen — "Open the Map" while the Map is open, or
    // Window > Open Map — should just bring it forward, not collapse it to
    // dock size and expand it again.
    const wasHidden = win.hidden;
    // Frames inside a window load on first open rather than at page load, so a
    // window nobody opens costs nothing. The Resume PDF is the one that
    // matters: phones never open that window at all.
    const frame = win.querySelector("iframe[data-src]");
    if (frame) {
      frame.src = frame.dataset.src;
      frame.removeAttribute("data-src");
    }
    win.hidden = false;
    // Only the very first open is centred. Keying this off `hidden` would
    // re-centre on every reopen, throwing away wherever the window had been
    // dragged to — closing and reopening should not move it.
    if (!everOpened.has(win)) {
      everOpened.add(win);
      controllers.get(win)?.centre();
    }
    raise(win);
    if (animate && wasHidden) flight(win, "in");
    if (focus) win.querySelector("[data-app-close]")?.focus();
    return win;
  }
  // Hiding is the same operation either way. The difference is what it means
  // next time: a minimised window comes back exactly where you left it, a
  // closed one comes back at its default size and position, which is what
  // closing and reopening an application usually gets you.
  // ---- minimise / restore animation ----------------------------------------
  const FLIGHT_MS = 280;

  function dockRectFor(win) {
    const item = dockItems.find((d) => resolve(d.dataset.dock) === win);
    return item ? item.getBoundingClientRect() : null;
  }

  // The window shrinks toward its own dock icon and back out again. Pinning
  // first gives a known starting transform: a window still held in place by the
  // centring translate would otherwise fly from the wrong origin.
  function flight(win, direction, done) {
    const target = dockRectFor(win);
    if (!target || compact() || prefersReducedMotion) return done && done();

    controllers.get(win)?.pin();
    const r = win.getBoundingClientRect();
    const dx = target.left + target.width / 2 - (r.left + r.width / 2);
    const dy = target.top + target.height / 2 - (r.top + r.height / 2);
    const shrunk = `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.05)`;

    // Land the window explicitly rather than by clearing inline styles. A
    // transition still in flight keeps the computed value at its start — the
    // shrunk, transparent one — so simply removing the class can leave a
    // window invisible at dock size. Killing the transition, forcing the final
    // values, and committing them before restoring the stylesheet makes the
    // end state unconditional.
    const settle = () => {
      win.classList.remove("window-anim");
      win.style.transition = "none";
      win.style.transform = "none";
      win.style.opacity = "1";
      void win.offsetWidth;
      win.style.transition = "";
      win.style.opacity = "";
      done && done();
    };

    if (direction === "out") {
      win.classList.add("window-anim");
      void win.offsetWidth; // commit the start state before changing it
      win.style.transform = shrunk;
      win.style.opacity = "0";
    } else {
      win.style.transform = shrunk; // no transition yet — snap to the dock
      win.style.opacity = "0";
      void win.offsetWidth;
      win.classList.add("window-anim");
      win.style.transform = "none";
      win.style.opacity = "1";
    }

    // transitionend alone is not enough: a transition that never runs — an
    // interrupted one, or a document the browser is not painting — would leave
    // the window stuck mid-flight and never hidden.
    let settled = false;
    const once = () => { if (!settled) { settled = true; settle(); } };
    win.addEventListener("transitionend", once, { once: true });
    setTimeout(once, FLIGHT_MS + 120);
  }

  function hide(win, animate = true) {
    if (!win || win.hidden || win.dataset.flying) return;
    const finish = () => {
      delete win.dataset.flying;
      win.hidden = true;
      const rest = wins.find((w) => !w.hidden);
      if (rest) raise(rest);
      else if (appNameEl) appNameEl.textContent = "Portfolio";
      syncDock();
    };
    if (!animate) return finish();
    win.dataset.flying = "1";
    flight(win, "out", finish);
  }
  function closeApp(id) {
    const win = resolve(id);
    everOpened.delete(win);
    hide(win);
  }
  function minimizeApp(id) {
    hide(resolve(id));
  }

  // ---- the dock ------------------------------------------------------------
  function syncDock() {
    dockItems.forEach((item) => {
      const win = resolve(item.dataset.dock);
      const open = !!win && !win.hidden;
      item.classList.toggle("is-open", open);
      item.classList.toggle("is-focused", open && win === focused);
      item.setAttribute("aria-pressed", open ? "true" : "false");
    });
  }

  dockItems.forEach((item) => {
    item.addEventListener("click", () => {
      const win = resolve(item.dataset.dock);
      if (!win) return;
      if (win.hidden) openApp(item.dataset.dock);
      else if (win !== focused) raise(win);
      else minimizeApp(item.dataset.dock); // clicking the front app tucks it away
    });
  });

  window.__openApp = openApp;
  window.__closeApp = closeApp;
  window.__minimizeApp = minimizeApp;

  // ---- the desktop starts with the Map already running ----------------------
  // A real desktop is not an empty screen with one window on it. The Map opens
  // behind the browser, offset far enough that a corner and its shadow show, so
  // it reads as a second running app and can be clicked to the front.
  // Not on phones: windows are full-screen there, so an auto-opened app would
  // simply hide the site behind it.
  // side: 1 tucks the window out past the browser's right edge, -1 past its
  // left, so two background windows peek from opposite sides instead of
  // stacking on each other.
  function tuckBehind(win, ref, side) {
    controllers.get(win)?.pin();
    const r = ref.getBoundingClientRect();
    const w = win.offsetWidth, h = win.offsetHeight;
    const clamp = (lo, v, hi) => Math.max(lo, Math.min(hi, v));
    // Ask for a generous offset and let the clamp take whatever the viewport
    // actually allows — the screen edge is the real constraint, so requesting
    // more simply means the widest sliver that still fits.
    const wantLeft = side > 0 ? r.right - w + 170 : r.left - 170;
    win.style.transform = "none";
    win.style.left = clamp(EDGE, wantLeft, window.innerWidth - w - EDGE) + "px";
    win.style.top = clamp(topLimit() + EDGE, r.bottom - h + 130, window.innerHeight - h - EDGE) + "px";
  }

  wins.forEach((w) => { if (!w.hidden) everOpened.add(w); });
  syncDock();

  const browserWin = document.querySelector(".browser");
  if (!compact() && browserWin) {
    const mapWin = openApp("map", { focus: false, animate: false });
    if (mapWin) tuckBehind(mapWin, browserWin, 1);
    const cvWin = openApp("resume", { focus: false, animate: false });
    if (cvWin) tuckBehind(cvWin, browserWin, -1);
    raise(browserWin); // the browser is what the visitor should read first
  }

  // The menu bar acts on whichever window is in front.
  window.__pinWindow = () => controllers.get(focused)?.pin();
  window.__centerWindow = () => controllers.get(focused)?.centre();
  window.__toggleZoom = () => controllers.get(focused)?.toggleZoom();

  // Anything marked data-app="map" is a launcher for that window.
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-app]");
    if (!t) return;
    e.preventDefault();
    openApp(t.dataset.app);
  });
})();

// --------------------------------------------------------------------------
// Draggable tabs (reorder by pointer drag, like a real browser)
// --------------------------------------------------------------------------
(function draggableTabs() {
  const bar = document.querySelector(".tab-bar");
  if (!bar) return;

  let dragging = null;
  let pointerId = null;
  let grabOffset = 0;
  let pointerStartX = 0;
  let moved = false;

  function applyPosition(clientX) {
    dragging.style.transform = "";
    const naturalLeft = dragging.getBoundingClientRect().left;
    const targetLeft = clientX - grabOffset;
    dragging.style.transform = `translateX(${targetLeft - naturalLeft}px)`;
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const tab = e.currentTarget;
    dragging = tab;
    pointerId = e.pointerId;
    pointerStartX = e.clientX;
    grabOffset = e.clientX - tab.getBoundingClientRect().left;
    moved = false;
    tab.setPointerCapture(pointerId);
    tab.classList.add("dragging");
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    if (Math.abs(e.clientX - pointerStartX) > 4) moved = true;

    const children = [...bar.children];
    const draggedIdx = children.indexOf(dragging);
    const siblings = children.filter((c) => c !== dragging && c.matches(".tab[data-tab]"));

    for (const sib of siblings) {
      const sibIdx = children.indexOf(sib);
      const r = sib.getBoundingClientRect();
      const sibMid = r.left + r.width / 2;
      if (sibIdx < draggedIdx && e.clientX < sibMid) {
        bar.insertBefore(dragging, sib);
        break;
      }
      if (sibIdx > draggedIdx && e.clientX > sibMid) {
        bar.insertBefore(dragging, sib.nextSibling);
        break;
      }
    }
    applyPosition(e.clientX);
  }

  function onUp(e) {
    if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
    const t = dragging;
    try { t.releasePointerCapture(pointerId); } catch (_) {}
    t.classList.remove("dragging");
    t.style.transition = "transform 0.18s ease";
    t.style.transform = "";
    setTimeout(() => { t.style.transition = ""; }, 200);

    if (moved) {
      // Swallow the synthetic click that follows a drag so we don't switch tabs
      t.addEventListener("click", function swallow(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        t.removeEventListener("click", swallow, true);
      }, true);
    }

    dragging = null;
    pointerId = null;
  }

  bar.querySelectorAll(".tab[data-tab]").forEach((tab) => {
    tab.addEventListener("pointerdown", onDown);
    tab.addEventListener("pointermove", onMove);
    tab.addEventListener("pointerup", onUp);
    tab.addEventListener("pointercancel", onUp);
  });
})();

// --------------------------------------------------------------------------
// Search box behavior on home tab
// --------------------------------------------------------------------------
(function search() {
  const form = document.getElementById("search-form");
  if (!form) return;
  const input = document.getElementById("search-input");
  const clearBtn = document.getElementById("search-clear");
  const lucky = document.getElementById("lucky-btn");
  const box = form;

  const tabTargets = ["home", "about", "skills", "projects", "map", "contact", "resume"];
  function go(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return;
    if (q === "map" || q === "maps" || q === "photo map") return window.__activateTab("map");
    // Direct tab name match
    if (tabTargets.includes(q)) return window.__activateTab(q);
    // Keyword aliases
    if (/(work|exp|me|bio)/.test(q)) return window.__activateTab("about");
    if (/(stack|tech|lang)/.test(q)) return window.__activateTab("skills");
    if (/(proj|build|portfolio|github)/.test(q)) return window.__activateTab("projects");
    if (/(photo|pic|shot|place|travel|camera)/.test(q)) return window.__activateTab("map");
    if (/(mail|email|reach|find|social)/.test(q)) return window.__activateTab("contact");
    if (/(cv|resume|hire)/.test(q)) return window.__activateTab("resume");
    // Fallback: projects
    window.__activateTab("projects");
  }

  input.addEventListener("input", () => {
    box.classList.toggle("has-value", input.value.length > 0);
  });
  clearBtn.addEventListener("click", () => {
    input.value = "";
    box.classList.remove("has-value");
    input.focus();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    go(input.value);
  });
  lucky?.addEventListener("click", () => {
    const pool = tabTargets.filter((t) => t !== "home");
    window.__activateTab(pool[Math.floor(Math.random() * pool.length)]);
  });
})();

// --------------------------------------------------------------------------
// Reload button — re-trigger the active panel's reveal animation
// --------------------------------------------------------------------------
document.querySelector('[data-nav="reload"]')?.addEventListener("click", () => {
  const active = document.querySelector(".panel.active");
  if (!active) return;
  active.style.animation = "none";
  // force reflow
  void active.offsetWidth;
  active.style.animation = "";
});

// Resume modal is wired up in resume.js.

// Appearance and colour themes are owned by theme.js, which loads first and
// exposes __setTheme / __getTheme / __setPalette for the menu bar below.

// --------------------------------------------------------------------------
// macOS menu bar — live clock, battery, and dropdown menus
// --------------------------------------------------------------------------
(function menubar() {
  const bar = document.querySelector(".menubar");
  if (!bar) return;

  // ---- Clock: "Wed Sep 3" / "12:31 AM", refreshed on the minute ----
  (function clock() {
    const dateEl = document.getElementById("mb-date");
    const timeEl = document.getElementById("mb-time");
    if (!dateEl || !timeEl) return;

    function render() {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString([], {
        weekday: "short", month: "short", day: "numeric",
      });
      timeEl.textContent = now
        .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        .replace(/\s/g, " ");
      // Re-sync on the next minute boundary rather than drifting on an interval
      setTimeout(render, (60 - now.getSeconds()) * 1000 + 50);
    }
    render();
  })();

  // ---- Battery: real level via the Battery Status API where supported ----
  (function battery() {
    const wrap = document.getElementById("mb-battery");
    const pct = document.getElementById("mb-batt-pct");
    const fill = document.getElementById("mb-batt-fill");
    if (!wrap || !fill) return;

    const FULL_W = 21.7; // matches the <rect> width in the SVG

    function paint(level, charging) {
      fill.setAttribute("width", String(Math.max(1.5, FULL_W * level)));
      pct.textContent = Math.round(level * 100) + "%";
      wrap.classList.toggle("low", level <= 0.2 && !charging);
      wrap.classList.toggle("charging", charging);
    }

    if (!navigator.getBattery) {
      // Unsupported (Safari, Firefox): show a full battery, drop the number
      // rather than inventing one.
      pct.style.display = "none";
      return;
    }

    navigator.getBattery().then((b) => {
      const sync = () => paint(b.level, b.charging);
      sync();
      b.addEventListener("levelchange", sync);
      b.addEventListener("chargingchange", sync);
    }).catch(() => { pct.style.display = "none"; });
  })();

  // ---- Dropdown menus ----
  const go = (tab) => window.__activateTab?.(tab);
  const click = (sel) => document.querySelector(sel)?.click();
  const setTheme = (t) => window.__setTheme?.(t);
  const themeIs = (t) => () => window.__getTheme?.() === t;

  const appearanceItems = [
    { label: "Auto", check: themeIs("auto"), run: () => setTheme("auto") },
    { label: "Light", check: themeIs("light"), run: () => setTheme("light") },
    { label: "Dark", check: themeIs("dark"), run: () => setTheme("dark") },
    { sep: true },
    { label: "Theme…", run: () => window.__openThemeSettings?.() },
  ];

  const MENUS = {
    apple: [
      { label: "About This Portfolio", run: () => go("about") },
      { sep: true },
      { heading: "Appearance" },
      ...appearanceItems,
      { sep: true },
      { label: "GitHub Profile…", run: () => window.open("https://github.com/namng2", "_blank", "noopener") },
      { sep: true },
      { label: "Restart…", run: () => location.reload() },
    ],
    portfolio: [
      { label: "About Portfolio", run: () => go("about") },
      { sep: true },
      { heading: "Appearance" },
      ...appearanceItems,
      { sep: true },
      { label: "Hide Portfolio", key: "⌘H", disabled: true },
      { label: "Quit Portfolio", key: "⌘Q", disabled: true },
    ],
    file: [
      { label: "New Tab", key: "⌘T", run: () => go("home") },
      { label: "Open Resume…", key: "⌘O", run: () => click("[data-open-resume]") },
      { sep: true },
      { label: "Print Resume…", key: "⌘P", run: () => window.__printResume?.() },
    ],
    edit: [
      { label: "Undo", key: "⌘Z", disabled: true },
      { label: "Redo", key: "⇧⌘Z", disabled: true },
      { sep: true },
      { label: "Cut", key: "⌘X", disabled: true },
      { label: "Copy", key: "⌘C", disabled: true },
      { label: "Paste", key: "⌘V", disabled: true },
      { sep: true },
      {
        label: "Find…",
        key: "⌘F",
        run: () => { go("home"); setTimeout(() => document.getElementById("search-input")?.focus(), 120); },
      },
    ],
    view: [
      { label: "Home", key: "⌘1", run: () => go("home") },
      { label: "About", key: "⌘2", run: () => go("about") },
      { label: "Skills", key: "⌘3", run: () => go("skills") },
      { label: "Projects", key: "⌘4", run: () => go("projects") },
      { label: "Contact", key: "⌘5", run: () => go("contact") },
      { label: "Resume", key: "⌘6", run: () => go("resume") },
      { sep: true },
      { heading: "Appearance" },
      ...appearanceItems,
      { sep: true },
      { label: "Reload", key: "⌘R", run: () => click('[data-nav="reload"]') },
    ],
    window: [
      { label: "Open Map", run: () => window.__openApp?.("map") },
      { label: "Open Resume PDF", run: () => window.__openApp?.("resume") },
      { label: "Zoom", run: () => window.__toggleZoom?.() },
      { label: "Center Window", run: () => window.__centerWindow?.() },
    ],
    help: [
      { label: "Portfolio Help", run: () => go("about") },
      { sep: true },
      { label: "GitHub", run: () => window.open("https://github.com/namng2", "_blank", "noopener") },
      { label: "Email", run: () => { location.href = "mailto:namhnguyen041@gmail.com"; } },
    ],
  };

  let openEl = null;
  let panel = null;
  const menuButtons = Array.from(bar.querySelectorAll(".mb-item[data-menu]"));

  function close(restoreFocus = false) {
    const owner = openEl;
    panel?.remove();
    panel = null;
    openEl?.classList.remove("open");
    openEl?.setAttribute("aria-expanded", "false");
    openEl = null;
    if (restoreFocus) owner?.focus();
  }

  function openMenu(btn, focusFirst = false) {
    close();
    const items = MENUS[btn.dataset.menu];
    if (!items) return;

    panel = document.createElement("div");
    panel.className = "mb-menu";
    panel.setAttribute("role", "menu");

    for (const item of items) {
      if (item.sep) {
        panel.appendChild(document.createElement("hr"));
        continue;
      }
      if (item.heading) {
        const h = document.createElement("p");
        h.className = "mb-heading";
        h.textContent = item.heading;
        panel.appendChild(h);
        continue;
      }

      const b = document.createElement("button");
      b.type = "button";
      b.tabIndex = -1;
      b.setAttribute("role", item.check ? "menuitemradio" : "menuitem");
      b.disabled = !!item.disabled;

      const label = document.createElement("span");
      label.className = "mb-label";
      if (item.check) {
        const on = item.check();
        b.setAttribute("aria-checked", on ? "true" : "false");
        const tick = document.createElement("span");
        tick.className = "mb-check";
        tick.textContent = on ? "✓" : "";
        label.appendChild(tick);
      }
      label.appendChild(document.createTextNode(item.label));
      b.appendChild(label);

      if (item.key) {
        const k = document.createElement("span");
        k.className = "mb-key";
        k.textContent = item.key;
        b.appendChild(k);
      }
      if (item.run) {
        b.addEventListener("click", () => {
          const owner = openEl;
          close();
          owner?.focus();
          item.run();
        });
      }
      panel.appendChild(b);
    }

    panel.addEventListener("keydown", (e) => {
      const items = Array.from(panel.querySelectorAll("button:not(:disabled)"));
      const current = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) || !items.length) return;
      e.preventDefault();
      let next = current;
      if (e.key === "ArrowDown") next = (current + 1) % items.length;
      if (e.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = items.length - 1;
      items[next].focus();
    });

    document.body.appendChild(panel);
    // Keep the panel on screen when a right-hand menu would overflow
    const left = btn.getBoundingClientRect().left;
    panel.style.left =
      Math.min(left, window.innerWidth - panel.offsetWidth - 8) + "px";

    openEl = btn;
    btn.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    if (focusFirst) panel.querySelector("button:not(:disabled)")?.focus();
  }

  menuButtons.forEach((btn, index) => {
    btn.tabIndex = index === 0 ? 0 : -1;
    btn.addEventListener("focus", () => {
      menuButtons.forEach((item) => { item.tabIndex = item === btn ? 0 : -1; });
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEl === btn ? close() : openMenu(btn);
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu(btn, true);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      close();
      const direction = e.key === "ArrowRight" ? 1 : -1;
      menuButtons[(index + direction + menuButtons.length) % menuButtons.length].focus();
    });
    // Once a menu is open, hovering a sibling switches to it (macOS behavior)
    btn.addEventListener("mouseenter", () => {
      if (openEl && openEl !== btn) openMenu(btn);
    });
  });

  document.addEventListener("click", () => close());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close(true);
  });
  window.addEventListener("resize", close);

  // ---- Right-side shortcuts ----
  // #mb-control opens the appearance popover; theme.js binds that one.
  document.getElementById("mb-search")?.addEventListener("click", (e) => {
    e.stopPropagation();
    go("home");
    setTimeout(() => document.getElementById("search-input")?.focus(), 120);
  });
})();
