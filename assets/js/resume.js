// ==========================================================================
// resume.js — fetch resume.tex, parse the "Jake's Resume" LaTeX subset
// (\section, \resumeSubheading, \resumeProjectHeading, \resumeItem, itemize,
// \href, \textbf, \textit, \emph, $|$, etc.) and render into the modal.
// ==========================================================================

(function () {
  const modal = document.getElementById("resume-modal");
  const body = document.getElementById("resume-render");
  const openers = document.querySelectorAll("[data-open-resume]");
  const closers = document.querySelectorAll("[data-close-resume]");
  const printBtn = document.querySelector("[data-print-resume]");
  if (!modal || !body) return;

  let loaded = false;

  function openModal(e) {
    if (e) e.preventDefault();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (!loaded) {
      loaded = true;
      load();
    } else {
      animateIn();
    }
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function animateIn() {
    if (!window.gsap || !body.children.length) return;
    gsap.from(body.children, {
      opacity: 0,
      y: 14,
      duration: 0.5,
      stagger: 0.03,
      ease: "power2.out",
    });
  }

  async function load() {
    try {
      const res = await fetch("assets/resume/resume.tex", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const src = await res.text();
      body.innerHTML = parseResume(src);
      wireInteractions();
      animateIn();
    } catch (err) {
      body.innerHTML = `
        <div class="r-error">
          <h3>Couldn't load resume.tex</h3>
          <p>If you opened <code>index.html</code> directly via <code>file://</code>, the browser blocks the fetch.
          Run a local server in this folder:</p>
          <pre><code>python3 -m http.server 8000</code></pre>
          <p>Then open <code>http://localhost:8000</code>.</p>
          <p class="r-error-detail">${escapeHtml(String(err))}</p>
        </div>`;
    }
  }

  function wireInteractions() {
    body.querySelectorAll(".r-contact .r-copy").forEach((el) => {
      el.addEventListener("click", async (e) => {
        if (e.metaKey || e.ctrlKey || e.button === 1) return;
        const text = el.dataset.copy;
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          toast("Copied " + text);
        } catch {
          /* clipboard blocked — let link behavior happen */
        }
      });
    });
  }

  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 1600);
  }

  openers.forEach((b) => b.addEventListener("click", openModal));
  closers.forEach((b) => b.addEventListener("click", closeModal));
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      document.body.classList.add("printing");
      window.print();
      setTimeout(() => document.body.classList.remove("printing"), 200);
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  // ------------------------------------------------------------------------
  // Parser entry
  // ------------------------------------------------------------------------

  function parseResume(src) {
    src = src.replace(/(?<!\\)%[^\n]*/g, ""); // strip LaTeX comments
    const begin = src.indexOf("\\begin{document}");
    if (begin !== -1) src = src.slice(begin + "\\begin{document}".length);
    const end = src.indexOf("\\end{document}");
    if (end !== -1) src = src.slice(0, end);
    return renderTokens(tokenize(src));
  }

  // ------------------------------------------------------------------------
  // Tokenizer: produces { type: cmd|text|break|sep|math|begin|end, ... }
  // ------------------------------------------------------------------------

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    const L = src.length;

    function readBraces() {
      if (src[i] !== "{") return "";
      let depth = 1;
      i++;
      const start = i;
      while (i < L && depth > 0) {
        const c = src[i];
        if (c === "\\") { i += 2; continue; }
        if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) break; }
        i++;
      }
      const content = src.slice(start, i);
      if (src[i] === "}") i++;
      return content;
    }

    function skipOptional() {
      if (src[i] !== "[") return;
      let depth = 1;
      i++;
      while (i < L && depth > 0) {
        if (src[i] === "[") depth++;
        else if (src[i] === "]") { depth--; if (depth === 0) { i++; return; } }
        i++;
      }
    }

    function skipWS() {
      while (i < L && (src[i] === " " || src[i] === "\t" || src[i] === "\n" || src[i] === "\r")) i++;
    }

    function readArgs() {
      const args = [];
      while (true) {
        const save = i;
        skipWS();
        if (src[i] !== "{") { i = save; break; }
        args.push(readBraces());
      }
      return args;
    }

    while (i < L) {
      const c = src[i];
      if (c === "\\") {
        const nx = src[i + 1];
        // line break \\
        if (nx === "\\") {
          tokens.push({ type: "break" });
          i += 2;
          while (i < L && (src[i] === " " || src[i] === "\t")) i++;
          skipOptional();
          if (src[i] === "*") i++;
          continue;
        }
        // escaped characters
        if (nx && /[%&$#_{} ]/.test(nx)) {
          tokens.push({ type: "text", content: nx });
          i += 2;
          continue;
        }
        if (nx === "~" || nx === "^") { i += 2; continue; }

        i++;
        const s = i;
        while (i < L && /[a-zA-Z]/.test(src[i])) i++;
        const name = src.slice(s, i);
        if (!name) continue;
        skipWS();

        if (name === "begin" || name === "end") {
          let env = "";
          if (src[i] === "{") env = readBraces();
          skipWS();
          skipOptional();
          skipWS();
          while (src[i] === "{") { readBraces(); skipWS(); }
          tokens.push({ type: name, env });
          continue;
        }

        skipOptional();
        const args = readArgs();
        tokens.push({ type: "cmd", name, args });
      } else if (c === "$") {
        i++;
        const start = i;
        while (i < L && src[i] !== "$") {
          if (src[i] === "\\") i += 2;
          else i++;
        }
        const content = src.slice(start, i);
        if (src[i] === "$") i++;
        const t = content.trim();
        if (t === "|") tokens.push({ type: "sep" });
        else tokens.push({ type: "math", content: t });
      } else {
        const s = i;
        while (i < L && src[i] !== "\\" && src[i] !== "$") i++;
        const text = src.slice(s, i);
        if (text) tokens.push({ type: "text", content: text });
      }
    }
    return tokens;
  }

  // ------------------------------------------------------------------------
  // Top-level renderer
  // ------------------------------------------------------------------------

  function renderTokens(tokens) {
    let out = "";
    let i = 0;
    let bulletOpen = false;
    const openBullet = () => {
      if (!bulletOpen) { out += '<ul class="r-list">'; bulletOpen = true; }
    };
    const closeBullet = () => {
      if (bulletOpen) { out += "</ul>"; bulletOpen = false; }
    };

    while (i < tokens.length) {
      const t = tokens[i];

      if (t.type === "begin" && t.env === "center") {
        const inner = [];
        i++;
        while (i < tokens.length && !(tokens[i].type === "end" && tokens[i].env === "center")) {
          inner.push(tokens[i]);
          i++;
        }
        if (i < tokens.length) i++;
        closeBullet();
        out += renderHeader(inner);
        continue;
      }

      if (t.type === "begin" && t.env === "itemize") {
        const inner = [];
        i++;
        let depth = 1;
        while (i < tokens.length && depth > 0) {
          const tok = tokens[i];
          if (tok.type === "begin" && tok.env === "itemize") depth++;
          else if (tok.type === "end" && tok.env === "itemize") {
            depth--;
            if (depth === 0) { i++; break; }
          }
          inner.push(tok);
          i++;
        }
        closeBullet();
        out += renderItemize(inner);
        continue;
      }

      if (t.type === "begin" || t.type === "end") { i++; continue; }
      if (t.type === "text" || t.type === "break" || t.type === "sep" || t.type === "math") {
        i++;
        continue;
      }

      if (t.type === "cmd") {
        const { name, args } = t;

        if (name === "resumeSubHeadingListStart" ||
            name === "resumeSubHeadingListEnd" ||
            name === "resumeItemListEnd") {
          closeBullet();
          i++;
          continue;
        }
        if (name === "resumeItemListStart") {
          openBullet();
          i++;
          continue;
        }
        if (name !== "resumeItem" && name !== "resumeSubItem") closeBullet();

        switch (name) {
          case "section":
            out += `<h2 class="r-section">${processInline(args[0] || "")}</h2>`;
            break;
          case "resumeSubheading": {
            const [title = "", meta = "", sub = "", dates = ""] = args;
            out += `<div class="r-entry"><div class="r-entry-head">` +
              `<div class="r-entry-left">` +
                `<div class="r-entry-title">${processInline(title)}</div>` +
                `<div class="r-entry-sub">${processInline(sub)}</div>` +
              `</div>` +
              `<div class="r-entry-aside">` +
                `<div class="r-entry-meta">${processInline(meta)}</div>` +
                `<div class="r-entry-dates">${processInline(dates)}</div>` +
              `</div>` +
              `</div></div>`;
            break;
          }
          case "resumeProjectHeading": {
            const [heading = "", dates = ""] = args;
            out += `<div class="r-entry"><div class="r-entry-head">` +
              `<div class="r-entry-left">` +
                `<div class="r-entry-title">${processInline(heading)}</div>` +
              `</div>` +
              `<div class="r-entry-aside">` +
                `<div class="r-entry-dates">${processInline(dates)}</div>` +
              `</div>` +
              `</div></div>`;
            break;
          }
          case "resumeSubSubheading": {
            const [sub = "", dates = ""] = args;
            out += `<div class="r-entry"><div class="r-entry-head">` +
              `<div class="r-entry-left">` +
                `<div class="r-entry-sub"><em>${processInline(sub)}</em></div>` +
              `</div>` +
              `<div class="r-entry-aside">` +
                `<div class="r-entry-dates">${processInline(dates)}</div>` +
              `</div>` +
              `</div></div>`;
            break;
          }
          case "resumeItem":
          case "resumeSubItem":
            openBullet();
            out += `<li>${processInline(args[0] || "")}</li>`;
            break;
          default:
            break;
        }
        i++;
        continue;
      }
      i++;
    }

    closeBullet();
    return out;
  }

  // ------------------------------------------------------------------------
  // Header: \begin{center} ... \end{center}
  // ------------------------------------------------------------------------

  function renderHeader(tokens) {
    let nameHtml = "";
    const rest = [];
    let foundName = false;

    for (const t of tokens) {
      if (!foundName && t.type === "cmd" && t.name === "textbf" &&
          t.args[0] && /\\Huge|\\huge|\\Large|\\large/.test(t.args[0])) {
        nameHtml = processInline(t.args[0]);
        foundName = true;
        continue;
      }
      rest.push(t);
    }
    if (!foundName) {
      for (let j = 0; j < rest.length; j++) {
        const t = rest[j];
        if (t.type === "cmd" && t.name === "textbf" && t.args[0]) {
          nameHtml = processInline(t.args[0]);
          rest.splice(j, 1);
          foundName = true;
          break;
        }
      }
    }

    const pieces = [];
    let cur = "";
    const flush = () => {
      const s = cur.replace(/\s+/g, " ").trim();
      if (s) pieces.push(s);
      cur = "";
    };
    for (const t of rest) {
      if (t.type === "sep" || t.type === "break") { flush(); continue; }
      if (t.type === "text") { cur += renderText(t.content); continue; }
      if (t.type === "math") { cur += processMath(t.content); continue; }
      if (t.type === "cmd") { cur += renderCmdInline(t); continue; }
    }
    flush();

    const contact = pieces.length ? renderContactPieces(pieces) : "";
    return (nameHtml ? `<h1 class="r-name">${nameHtml}</h1>` : "") + contact;
  }

  function renderContactPieces(pieces) {
    const items = pieces.map((html) => {
      const plain = stripTags(html).replace(/\s+/g, " ").trim();
      let href = null;
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(plain)) href = "mailto:" + plain;
      else if (/^https?:\/\//i.test(plain)) href = plain;
      else if (/^(www\.|github\.com|linkedin\.com|twitter\.com|x\.com|dev\.to)/i.test(plain)) href = "https://" + plain;

      if (/<a\s/i.test(html)) {
        return `<span class="r-copy">${html}</span>`;
      }
      if (href) {
        return `<a class="r-copy" data-copy="${escapeAttr(plain)}" href="${escapeAttr(href)}" target="_blank" rel="noopener">${html}</a>`;
      }
      return `<span class="r-copy" data-copy="${escapeAttr(plain)}">${html}</span>`;
    });
    return `<p class="r-contact">${items.join('<span class="r-sep">·</span>')}</p>`;
  }

  // ------------------------------------------------------------------------
  // Itemize: render generic \begin{itemize}…\end{itemize}. In Jake's template
  // this is the Skills block, typically structured as:
  //   \small{\item{ \textbf{Cat}{: a, b, c} \\ \textbf{Cat2}{: ...} }}
  // ------------------------------------------------------------------------

  function renderItemize(tokens) {
    const expanded = expandWrappers(tokens);
    const items = [];
    for (const t of expanded) {
      if (t.type === "cmd" && t.name === "item") {
        const arg = t.args[0] || "";
        const inner = expandWrappers(tokenize(arg));
        let line = [];
        const lines = [line];
        for (const x of inner) {
          if (x.type === "break") { line = []; lines.push(line); }
          else line.push(x);
        }
        for (const l of lines) {
          const html = renderInline(l).trim();
          if (html) items.push(html);
        }
      }
    }
    if (!items.length) return "";

    const rows = items.map((html) => {
      const m = html.match(/^<strong>([\s\S]+?)<\/strong>\s*:?\s*([\s\S]+)$/i);
      if (m) {
        const cat = stripTags(m[1]).replace(/:\s*$/, "").trim();
        const rest = m[2].replace(/^\s*:\s*/, "").trim();
        const chips = rest
          .split(/,\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => `<span class="r-tag">${s}</span>`)
          .join("");
        return `<div class="r-skill"><div class="r-skill-cat">${cat}</div><div class="r-tags">${chips}</div></div>`;
      }
      return `<p class="r-p">${html}</p>`;
    });
    return rows.join("");
  }

  // Expand size/group wrappers that carry a braced argument, e.g. \small{...}
  function expandWrappers(tokens) {
    const out = [];
    const wrappers = /^(small|Small|large|Large|huge|Huge|normalsize|footnotesize|scriptsize|tiny|textnormal|textrm)$/;
    for (const t of tokens) {
      if (t.type === "cmd" && wrappers.test(t.name) && t.args[0]) {
        out.push(...expandWrappers(tokenize(t.args[0])));
      } else {
        out.push(t);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------------
  // Inline rendering
  // ------------------------------------------------------------------------

  function renderInline(tokens) {
    let out = "";
    for (const t of tokens) {
      if (t.type === "text") out += renderText(t.content);
      else if (t.type === "cmd") out += renderCmdInline(t);
      else if (t.type === "break") out += "<br>";
      else if (t.type === "sep") out += '<span class="r-sep">·</span>';
      else if (t.type === "math") out += processMath(t.content);
    }
    return out;
  }

  function processInline(s) {
    return renderInline(tokenize(s));
  }

  function renderCmdInline(t) {
    const { name, args } = t;
    const trailing = (a) => a.slice(1).map((x) => processInline(x)).join("");
    if (name === "textbf") return `<strong>${processInline(args[0] || "")}</strong>${trailing(args)}`;
    if (name === "textit" || name === "emph") return `<em>${processInline(args[0] || "")}</em>${trailing(args)}`;
    if (name === "underline") return `${processInline(args[0] || "")}${trailing(args)}`;
    if (name === "href") {
      const raw = args[0] || "";
      const text = processInline(args[1] || raw);
      const full = /^https?:\/\/|^mailto:/i.test(raw) ? raw : "https://" + raw;
      return `<a href="${escapeAttr(full)}" target="_blank" rel="noopener">${text}</a>`;
    }
    if (name === "url") {
      const raw = args[0] || "";
      const full = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
      return `<a href="${escapeAttr(full)}" target="_blank" rel="noopener">${escapeHtml(raw)}</a>`;
    }
    if (/^(small|Small|large|Large|huge|Huge|normalsize|footnotesize|scriptsize|tiny|textnormal|textrm)$/.test(name)) {
      return args[0] ? processInline(args[0]) : "";
    }
    if (name === "vspace" || name === "hspace" || name === "vskip" || name === "hskip" ||
        name === "noindent" || name === "par" || name === "relax" ||
        name === "raggedright" || name === "raggedleft") {
      return "";
    }
    if (name === "item") return args[0] ? processInline(args[0]) : "";
    // Unknown command: render any first-argument content transparently
    return args[0] ? processInline(args[0]) : "";
  }

  function renderText(s) {
    return escapeHtml(
      s.replace(/[{}]/g, "")
       .replace(/~/g, " ")
       .replace(/---/g, "—")
       .replace(/--/g, "–")
    );
  }

  function processMath(s) {
    const t = s.trim();
    if (t === "|") return '<span class="r-sep">·</span>';
    const r = t
      .replace(/\\sim/g, "~")
      .replace(/\\%/g, "%")
      .replace(/\\\$/g, "$")
      .replace(/\\&/g, "&")
      .replace(/\\ldots|\\dots/g, "…");
    return escapeHtml(r);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function stripTags(s) {
    return String(s).replace(/<[^>]*>/g, "");
  }
})();
