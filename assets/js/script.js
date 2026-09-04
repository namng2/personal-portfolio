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
  const tabs = document.querySelectorAll(".tab[data-tab]");
  const panels = document.querySelectorAll(".panel[data-panel]");
  const urlDisplay = document.getElementById("url-display");

  function activate(name) {
    // Resume tab opens the modal instead of swapping panels
    if (name === "resume") {
      const opener = document.querySelector("[data-open-resume]");
      if (opener) opener.click();
      return;
    }
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((p) => {
      p.classList.toggle("active", p.dataset.panel === name);
    });
    if (urlDisplay) urlDisplay.textContent = "portfolio://" + name;
    document.querySelector(".viewport")?.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));

  // Any element with data-goto navigates to that tab
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-goto]");
    if (!trigger) return;
    e.preventDefault();
    activate(trigger.dataset.goto);
  });

  // Expose for other modules
  window.__activateTab = activate;
})();

// --------------------------------------------------------------------------
// Draggable browser window — grab the chrome strip to move it around
// --------------------------------------------------------------------------
(function draggableWindow() {
  const browser = document.querySelector(".browser");
  const chrome = browser?.querySelector(".browser-chrome");
  if (!browser || !chrome) return;
  if (window.matchMedia("(max-width: 640px)").matches) return;

  let dragging = false;
  let pointerId = null;
  let startX = 0, startY = 0;
  let originLeft = 0, originTop = 0;

  // Convert the centering transform to absolute left/top on first interaction
  // so subsequent drags are coordinate-based.
  let pinned = false;
  function pin() {
    if (pinned) return;
    const r = browser.getBoundingClientRect();
    browser.style.transform = "none";
    browser.style.left = r.left + "px";
    browser.style.top = r.top + "px";
    pinned = true;
  }

  chrome.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // Don't hijack drags on tabs, the new-tab button, or any nested control
    if (e.target.closest(".tab[data-tab], .tab-new, button, input")) return;
    pin();
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const r = browser.getBoundingClientRect();
    originLeft = r.left;
    originTop = r.top;
    browser.classList.add("dragging-window");
    chrome.setPointerCapture(pointerId);
  });

  chrome.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = browser.offsetWidth;
    const h = browser.offsetHeight;
    // Keep at least 80px horizontally and 40px vertically on screen
    const minLeft = 80 - w;
    const maxLeft = window.innerWidth - 80;
    // Don't let the window slide underneath the menu bar
    const minTop = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--menubar-h"), 10
    ) || 30;
    const maxTop = window.innerHeight - 40;
    const nl = Math.max(minLeft, Math.min(maxLeft, originLeft + dx));
    const nt = Math.max(minTop, Math.min(maxTop, originTop + dy));
    browser.style.left = nl + "px";
    browser.style.top = nt + "px";
  });

  function endDrag(e) {
    if (!dragging) return;
    if (e && e.pointerId !== pointerId) return;
    try { chrome.releasePointerCapture(pointerId); } catch (_) {}
    dragging = false;
    pointerId = null;
    browser.classList.remove("dragging-window");
  }
  chrome.addEventListener("pointerup", endDrag);
  chrome.addEventListener("pointercancel", endDrag);

  // Menu bar "Center Window" hands control back to the CSS centering rules.
  window.__centerWindow = () => {
    browser.style.left = "";
    browser.style.top = "";
    browser.style.transform = "";
    pinned = false;
  };

  // Resizing anchors the top-left corner, so it needs the same conversion from
  // the centering transform to absolute coordinates that dragging does.
  window.__pinWindow = pin;
})();

// --------------------------------------------------------------------------
// Resizable browser window — drag the bottom-right grip
// --------------------------------------------------------------------------
(function resizableWindow() {
  const browser = document.querySelector(".browser");
  const handle = browser?.querySelector(".resize-handle");
  if (!browser || !handle) return;
  if (window.matchMedia("(max-width: 640px)").matches) return;

  const MIN_W = 420;
  const MIN_H = 320;

  let pointerId = null;
  let startX = 0, startY = 0, startW = 0, startH = 0;

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Pin first: while the window is still centred by a transform, changing its
    // size would grow it from the middle instead of the top-left corner.
    window.__pinWindow?.();
    browser.classList.remove("maximized");

    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const r = browser.getBoundingClientRect();
    startW = r.width;
    startH = r.height;
    browser.classList.add("resizing-window");
    handle.setPointerCapture(pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const r = browser.getBoundingClientRect();
    const maxW = window.innerWidth - r.left - 8;
    const maxH = window.innerHeight - r.top - 8;
    browser.style.width =
      Math.max(MIN_W, Math.min(maxW, startW + e.clientX - startX)) + "px";
    browser.style.height =
      Math.max(MIN_H, Math.min(maxH, startH + e.clientY - startY)) + "px";
  });

  function end(e) {
    if (pointerId === null || (e && e.pointerId !== pointerId)) return;
    try { handle.releasePointerCapture(pointerId); } catch (_) {}
    pointerId = null;
    browser.classList.remove("resizing-window");
  }
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);

  // Zoom toggles fullscreen, remembering the size to come back to. Inline
  // width/height would otherwise win over the .maximized rules.
  let restore = null;
  window.__toggleZoom = () => {
    if (browser.classList.contains("maximized")) {
      browser.classList.remove("maximized");
      if (restore) Object.assign(browser.style, restore);
      restore = null;
    } else {
      const s = browser.style;
      restore = { width: s.width, height: s.height, left: s.left, top: s.top, transform: s.transform };
      ["width", "height", "left", "top", "transform"].forEach((p) => (browser.style[p] = ""));
      browser.classList.add("maximized");
    }
  };
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

  const targets = ["home", "about", "skills", "projects", "map", "contact", "resume"];

  function go(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return;
    // Direct tab name match
    if (targets.includes(q)) return window.__activateTab(q);
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
    const pool = targets.filter((t) => t !== "home");
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
      { label: "App Store…", run: () => window.open("https://github.com/your-handle", "_blank", "noopener") },
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
      { sep: true },
      { heading: "Appearance" },
      ...appearanceItems,
      { sep: true },
      { label: "Reload", key: "⌘R", run: () => click('[data-nav="reload"]') },
    ],
    window: [
      { label: "Zoom", run: () => window.__toggleZoom?.() },
      { label: "Center Window", run: () => window.__centerWindow?.() },
    ],
    help: [
      { label: "Portfolio Help", run: () => go("about") },
      { sep: true },
      { label: "GitHub", run: () => window.open("https://github.com/your-handle", "_blank", "noopener") },
      { label: "Email", run: () => window.open("mailto:you@example.com", "_blank", "noopener") },
    ],
  };

  let openEl = null;
  let panel = null;

  function close() {
    panel?.remove();
    panel = null;
    openEl?.classList.remove("open");
    openEl?.setAttribute("aria-expanded", "false");
    openEl = null;
  }

  function openMenu(btn) {
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
        b.addEventListener("click", () => { close(); item.run(); });
      }
      panel.appendChild(b);
    }

    document.body.appendChild(panel);
    // Keep the panel on screen when a right-hand menu would overflow
    const left = btn.getBoundingClientRect().left;
    panel.style.left =
      Math.min(left, window.innerWidth - panel.offsetWidth - 8) + "px";

    openEl = btn;
    btn.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  bar.querySelectorAll(".mb-item[data-menu]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEl === btn ? close() : openMenu(btn);
    });
    // Once a menu is open, hovering a sibling switches to it (macOS behavior)
    btn.addEventListener("mouseenter", () => {
      if (openEl && openEl !== btn) openMenu(btn);
    });
  });

  document.addEventListener("click", () => close());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
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
