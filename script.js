// ==========================================================================
// Portfolio interactivity — B&W, motion-heavy. GSAP for reveals, vanilla JS
// for particles, custom cursor, tilt, typewriter, modal.
// ==========================================================================

document.getElementById("year").textContent = new Date().getFullYear();

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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
      ctx.fillStyle = "rgba(245, 245, 245, 0.55)";
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
          ctx.strokeStyle = `rgba(245, 245, 245, ${alpha})`;
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

  function animate() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
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
// Smooth anchor scroll
// --------------------------------------------------------------------------
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// Resume modal is wired up in resume.js.
