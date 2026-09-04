// ==========================================================================
// theme.js — appearance engine + the Control Centre settings popover.
//
// Two independent axes, like macOS System Settings:
//   mode     auto | light | dark      ("auto" follows prefers-color-scheme)
//   palette  one of PALETTES below    (colour scheme; "midnight" is default)
//
// Colours are NOT defined here. themes.css owns every colour value; this file
// only flips data-theme / data-palette on <html> and reads palette colours
// back out of the stylesheet to draw the swatches. To add a palette: add the
// two CSS blocks in themes.css, then add its id to PALETTES.
//
// boot-theme.js applies the stored choice before first paint; this file takes
// over afterwards for changes, persistence and UI.
// ==========================================================================

(function themeSystem() {
  const root = document.documentElement;

  // Display order in the settings grid. Labels and colours come from the CSS.
  const PALETTES = [
    "midnight",
    "catppuccin",
    "tokyo-night",
    "nord",
    "gruvbox",
    "rose-pine",
    "dracula",
    "solarized",
    "mono",
  ];
  const MODES = [
    ["auto", "Auto"],
    ["light", "Light"],
    ["dark", "Dark"],
  ];

  const lightMQ = window.matchMedia("(prefers-color-scheme: light)");

  // ---- state ------------------------------------------------------------

  function stored(key, allowed, fallback) {
    let v = null;
    try {
      v = localStorage.getItem(key);
    } catch {
      /* storage blocked — use the fallback */
    }
    return allowed.includes(v) ? v : fallback;
  }

  function persist(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage blocked — the choice just won't survive a reload */
    }
  }

  let mode = stored("theme", ["auto", "light", "dark"], "auto");
  let palette = stored("palette", PALETTES, "midnight");

  const resolvedMode = () =>
    mode === "auto" ? (lightMQ.matches ? "light" : "dark") : mode;

  // ---- applying ---------------------------------------------------------

  function apply({ save = true } = {}) {
    root.setAttribute("data-theme", resolvedMode());
    if (palette === "midnight") root.removeAttribute("data-palette");
    else root.setAttribute("data-palette", palette);

    if (save) {
      persist("theme", mode);
      persist("palette", palette);
    }
    syncUI();
    window.dispatchEvent(
      new CustomEvent("themechange", {
        detail: { mode, palette, resolved: resolvedMode() },
      })
    );
  }

  // Only matters while mode === "auto", but the listener is harmless otherwise
  // and avoids having to add/remove it as the mode changes.
  lightMQ.addEventListener("change", () => {
    if (mode === "auto") apply({ save: false });
  });

  // ---- reading palette colours out of the stylesheet ---------------------
  // A detached probe carrying the palette's attributes lets getComputedStyle
  // resolve that palette's seeds without touching the live page. This is why
  // themes.css lists [data-theme="dark"] explicitly.

  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";

  function readPalette(id, forMode) {
    // data-palette is always set, even for midnight: removing it would let the
    // probe inherit the live palette from <html> instead of showing its own.
    probe.setAttribute("data-theme", forMode);
    probe.setAttribute("data-palette", id);

    const cs = getComputedStyle(probe);
    const get = (n) => cs.getPropertyValue(n).trim();
    return {
      id,
      label: get("--palette-label").replace(/^["']|["']$/g, "") || id,
      bg: get("--seed-bg"),
      fg: get("--seed-fg"),
      accents: [get("--seed-a1"), get("--seed-a2"), get("--seed-a3")],
    };
  }

  // ---- settings popover --------------------------------------------------

  let panel = null;
  let modeButtons = [];
  let paletteCards = [];

  function buildPanel() {
    panel = document.createElement("div");
    panel.className = "theme-panel";
    panel.id = "theme-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Appearance settings");
    panel.hidden = true;

    // Appearance segmented control
    const modeGroup = document.createElement("div");
    modeGroup.className = "tp-segmented";
    modeGroup.setAttribute("role", "radiogroup");
    modeGroup.setAttribute("aria-label", "Appearance");
    modeButtons = MODES.map(([id, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tp-seg";
      b.dataset.mode = id;
      b.textContent = label;
      b.setAttribute("role", "radio");
      b.addEventListener("click", () => {
        mode = id;
        apply();
      });
      modeGroup.appendChild(b);
      return b;
    });

    // Palette grid
    const grid = document.createElement("div");
    grid.className = "tp-grid";
    grid.setAttribute("role", "radiogroup");
    grid.setAttribute("aria-label", "Color theme");
    paletteCards = PALETTES.map((id) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "tp-card";
      card.dataset.palette = id;
      card.setAttribute("role", "radio");

      const chip = document.createElement("span");
      chip.className = "tp-chip";
      const dots = [0, 1, 2].map(() => {
        const d = document.createElement("i");
        chip.appendChild(d);
        return d;
      });

      const name = document.createElement("span");
      name.className = "tp-name";

      card.append(chip, name);
      card._paint = (p) => {
        chip.style.background = p.bg;
        // Hint at the palette's text colour without shouting it.
        chip.style.borderColor = `color-mix(in oklch, ${p.fg} 35%, transparent)`;
        dots.forEach((d, i) => (d.style.background = p.accents[i]));
        name.textContent = p.label;
        card.setAttribute("aria-label", p.label);
        card.title = p.label;
      };

      card.addEventListener("click", () => {
        palette = id;
        apply();
      });
      grid.appendChild(card);
      return card;
    });

    panel.append(
      section("Appearance", modeGroup),
      section("Theme", grid)
    );
    document.body.append(probe, panel);

    wireArrowKeys(modeButtons, 1, (i) => {
      mode = MODES[i][0];
      apply();
    });
    wireArrowKeys(paletteCards, 3, (i) => {
      palette = PALETTES[i];
      apply();
    });
  }

  // role="radio" promises arrow-key movement, so honour it. cols > 1 means the
  // group is a grid and up/down step a whole row; otherwise every arrow moves
  // by one. Movement clamps at the ends rather than wrapping, which is what
  // the grid case wants.
  function wireArrowKeys(items, cols, pick) {
    items.forEach((el, i) => {
      el.addEventListener("keydown", (e) => {
        const last = items.length - 1;
        let next;
        if (e.key === "ArrowRight") next = i + 1;
        else if (e.key === "ArrowLeft") next = i - 1;
        else if (e.key === "ArrowDown") next = cols > 1 ? i + cols : i + 1;
        else if (e.key === "ArrowUp") next = cols > 1 ? i - cols : i - 1;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = last;
        else return;
        e.preventDefault();
        if (next < 0 || next > last) return;
        items[next].focus();
        pick(next);
      });
    });
  }

  function section(title, content) {
    const wrap = document.createElement("section");
    wrap.className = "tp-section";
    const h = document.createElement("h4");
    h.className = "tp-title";
    h.textContent = title;
    wrap.append(h, content);
    return wrap;
  }

  // Swatches preview each palette in the mode you'd actually get, so switching
  // to Light re-renders every card in its light variant.
  function syncUI() {
    if (!panel) return;
    const shown = resolvedMode();
    // Roving tabindex: a radiogroup is one tab stop, and arrow keys move
    // within it. Without this the panel is 12 separate stops.
    modeButtons.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    paletteCards.forEach((c) => {
      const on = c.dataset.palette === palette;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-checked", String(on));
      c.tabIndex = on ? 0 : -1;
      c._paint(readPalette(c.dataset.palette, shown));
    });
    const t = document.getElementById("theme-toggle");
    if (t) {
      t.textContent = shown === "light" ? "🌙" : "☀️";
      t.title = shown === "light" ? "Switch to dark mode" : "Switch to light mode";
    }
  }

  const trigger = () => document.getElementById("mb-control");

  function openPanel() {
    if (!panel) buildPanel();
    syncUI();
    panel.hidden = false;
    trigger()?.setAttribute("aria-expanded", "true");
    // Focus moves immediately; only the open transition waits for a frame.
    // Tying focus to rAF would drop it whenever rAF is throttled.
    panel.querySelector('.tp-seg[aria-checked="true"]')?.focus();
    requestAnimationFrame(() => panel.classList.add("is-open"));
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
  }

  function closePanel() {
    if (!panel || panel.hidden) return;
    panel.classList.remove("is-open");
    trigger()?.setAttribute("aria-expanded", "false");
    // Hand focus back rather than dropping it on <body>.
    if (panel.contains(document.activeElement)) trigger()?.focus();
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => {
      if (!panel.classList.contains("is-open")) panel.hidden = true;
    }, 180);
  }

  function onOutside(e) {
    if (panel.contains(e.target) || e.target.closest?.("#mb-control")) return;
    closePanel();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closePanel();
    }
  }

  function togglePanel() {
    if (!panel || panel.hidden) openPanel();
    else closePanel();
  }

  // ---- wiring ------------------------------------------------------------

  buildPanel();
  apply({ save: false });

  document.getElementById("mb-control")?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePanel();
  });

  // The address-bar button stays a plain light/dark flip, which is the common
  // case; the menu-bar control opens the full panel.
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    mode = resolvedMode() === "light" ? "dark" : "light";
    apply();
  });

  // Public API. __setTheme/__getTheme predate this file and are still called
  // from the menu bar in script.js, so their contract is preserved.
  window.__setTheme = (m) => {
    mode = ["auto", "light", "dark"].includes(m) ? m : "dark";
    apply();
  };
  window.__getTheme = () => mode;
  window.__getResolvedTheme = resolvedMode;
  window.__setPalette = (p) => {
    if (!PALETTES.includes(p)) return;
    palette = p;
    apply();
  };
  window.__getPalette = () => palette;
  window.__listPalettes = () => PALETTES.slice();
  window.__openThemeSettings = openPanel;
})();
