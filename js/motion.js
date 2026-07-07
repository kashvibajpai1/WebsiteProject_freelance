/* ============================================================
   TREASURE TROVE — MOTION LAYER
   Life-like interaction design: split-text reveals, zari-dust
   particles, parallax, magnetic buttons, 3D tilt cards, a
   trailing cursor glow and a scroll-progress thread.

   Everything here is decorative: the site works fully without
   it. Skipped entirely for prefers-reduced-motion users, and
   pointer effects only run on devices with a fine pointer.
   ============================================================ */

(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const FINE = window.matchMedia("(pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  document.addEventListener("DOMContentLoaded", () => {
    initProgressThread();
    initSplitHero();
    initZariDust();
    initParallax();
    initCounters();
    if (FINE) {
      initCursorGlow();
      initMagneticButtons();
      initTiltCards();
    }
  });

  /* ---------------------------------------------------------
     1 · Scroll-progress thread — a fine gold line along the top
     --------------------------------------------------------- */
  function initProgressThread() {
    const bar = document.createElement("div");
    bar.className = "scroll-thread";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ---------------------------------------------------------
     2 · Split-text hero — the headline rises word by word
     --------------------------------------------------------- */
  function initSplitHero() {
    const h1 = document.querySelector(".hero h1");
    if (!h1) return;
    const hindi = h1.querySelector(".hindi-accent");
    if (hindi) hindi.remove();

    let wordIndex = 0;
    const splitNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
          const w = document.createElement("span");
          w.className = "w";
          const wi = document.createElement("span");
          wi.className = "wi";
          wi.style.animationDelay = (0.12 + wordIndex * 0.09) + "s";
          wi.textContent = part;
          w.appendChild(wi);
          frag.appendChild(w);
          wordIndex++;
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(splitNode);
      }
    };
    Array.from(h1.childNodes).forEach(splitNode);

    if (hindi) {
      hindi.classList.add("hindi-in");
      hindi.style.animationDelay = (0.35 + wordIndex * 0.09) + "s";
      h1.appendChild(hindi);
    }
    h1.classList.add("split-done");
  }

  /* ---------------------------------------------------------
     3 · Zari dust — drifting gold specks in the hero that
         shy away from the cursor, like dust in loom-light
     --------------------------------------------------------- */
  function initZariDust() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const canvas = document.createElement("canvas");
    canvas.className = "zari-dust";
    canvas.setAttribute("aria-hidden", "true");
    hero.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let W, H, running = false, raf = 0;
    const mouse = { x: -9999, y: -9999 };
    const COUNT = Math.min(70, Math.floor(window.innerWidth / 22));
    const dust = [];

    function size() {
      const r = hero.getBoundingClientRect();
      W = canvas.width = Math.floor(r.width);
      H = canvas.height = Math.floor(r.height);
    }
    function spawn(randomY) {
      return {
        x: Math.random() * W,
        y: randomY ? Math.random() * H : H + 8,
        r: 0.6 + Math.random() * 1.8,
        vy: 0.12 + Math.random() * 0.3,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.004 + Math.random() * 0.008,
        tw: Math.random() * Math.PI * 2
      };
    }
    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (const d of dust) {
        d.sway += d.swaySpeed;
        d.tw += 0.03;
        d.y -= d.vy;
        d.x += Math.sin(d.sway) * 0.35;
        // drift gently away from the cursor
        const dx = d.x - mouse.x, dy = d.y - mouse.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < 10000) {
          const f = (10000 - dist2) / 10000;
          d.x += (dx / Math.sqrt(dist2 + 1)) * f * 1.6;
          d.y += (dy / Math.sqrt(dist2 + 1)) * f * 1.6;
        }
        if (d.y < -10) Object.assign(d, spawn(false));
        const alpha = 0.25 + Math.sin(d.tw) * 0.2;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(202, 158, 74," + Math.max(0.05, alpha) + ")";
        ctx.fill();
      }
      if (running) raf = requestAnimationFrame(tick);
    }

    size();
    for (let i = 0; i < COUNT; i++) dust.push(spawn(true));
    window.addEventListener("resize", size, { passive: true });
    if (FINE) hero.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    }, { passive: true });

    // only animate while the hero is on screen
    new IntersectionObserver((entries) => {
      const vis = entries[0].isIntersecting;
      if (vis && !running) { running = true; raf = requestAnimationFrame(tick); }
      if (!vis && running) { running = false; cancelAnimationFrame(raf); }
    }).observe(hero);
  }

  /* ---------------------------------------------------------
     4 · Parallax — hero drifts up as you scroll away; framed
         visuals move at their own quiet pace
     --------------------------------------------------------- */
  function initParallax() {
    const heroInner = document.querySelector(".hero-inner");
    const layers = [];
    const frame = document.querySelector(".story-frame");
    if (frame) layers.push({ el: frame, speed: 0.05 });
    const motif = document.querySelector(".vault-motif");
    if (motif) layers.push({ el: motif, speed: 0.06 });
    if (!heroInner && !layers.length) return;

    let ticking = false;
    function apply() {
      ticking = false;
      const y = window.scrollY;
      if (heroInner) {
        const vh = window.innerHeight;
        if (y < vh) {
          heroInner.style.transform = "translateY(" + y * 0.22 + "px)";
          heroInner.style.opacity = String(Math.max(0, 1 - y / (vh * 0.85)));
        }
      }
      for (const l of layers) {
        const r = l.el.getBoundingClientRect();
        const mid = r.top + r.height / 2 - window.innerHeight / 2;
        l.el.style.transform = "translateY(" + (-mid * l.speed).toFixed(1) + "px)";
      }
    }
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  }

  /* ---------------------------------------------------------
     5 · Count-up numbers (e.g. the "40+" heritage stat)
     --------------------------------------------------------- */
  function initCounters() {
    document.querySelectorAll(".story-stat b").forEach((el) => {
      const m = el.textContent.trim().match(/^(\d+)(.*)$/);
      if (!m) return;
      const target = parseInt(m[1], 10), suffix = m[2] || "";
      el.textContent = "0" + suffix;
      new IntersectionObserver((entries, io) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now(), dur = 1500;
        (function step(t) {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      }, { threshold: 0.5 }).observe(el);
    });
  }

  /* ---------------------------------------------------------
     6 · Cursor glow — a warm pool of light that trails the
         pointer and swells over anything clickable
     --------------------------------------------------------- */
  function initCursorGlow() {
    const glow = document.createElement("div");
    glow.className = "cursor-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);

    let tx = -500, ty = -500, x = tx, y = ty, scale = 1, tScale = 1, live = false;
    document.addEventListener("pointermove", (e) => {
      tx = e.clientX; ty = e.clientY;
      const hot = e.target.closest("a, button, .product-media, .chip");
      tScale = hot ? 1.9 : 1;
      if (!live) { live = true; x = tx; y = ty; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener("pointerleave", () => { tScale = 0; });

    function loop() {
      x = lerp(x, tx, 0.12);
      y = lerp(y, ty, 0.12);
      scale = lerp(scale, tScale, 0.1);
      glow.style.transform =
        "translate(" + (x - 170) + "px," + (y - 170) + "px) scale(" + scale.toFixed(3) + ")";
      requestAnimationFrame(loop);
    }
  }

  /* ---------------------------------------------------------
     7 · Magnetic buttons — CTAs lean gently toward the cursor
     --------------------------------------------------------- */
  function initMagneticButtons() {
    const strength = 0.28, maxPull = 10;
    document.querySelectorAll(".btn, .btn-auth, .wa-float").forEach((btn) => {
      let raf = 0, px = 0, py = 0, gx = 0, gy = 0, active = false;
      function loop() {
        px = lerp(px, gx, 0.18);
        py = lerp(py, gy, 0.18);
        btn.style.translate = px.toFixed(2) + "px " + py.toFixed(2) + "px";
        if (active || Math.abs(px) > 0.15 || Math.abs(py) > 0.15) {
          raf = requestAnimationFrame(loop);
        } else {
          btn.style.translate = "";
          raf = 0;
        }
      }
      btn.addEventListener("pointerenter", () => { active = true; if (!raf) raf = requestAnimationFrame(loop); });
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        gx = Math.max(-maxPull, Math.min(maxPull, (e.clientX - r.left - r.width / 2) * strength));
        gy = Math.max(-maxPull, Math.min(maxPull, (e.clientY - r.top - r.height / 2) * strength));
      }, { passive: true });
      btn.addEventListener("pointerleave", () => { active = false; gx = 0; gy = 0; });
    });
  }

  /* ---------------------------------------------------------
     8 · 3D tilt + shine on product cards (delegated, so it
         works on cards rendered after page load too)
     --------------------------------------------------------- */
  function initTiltCards() {
    const MAX = 5; // degrees
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".product-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", (nx * MAX * 2).toFixed(2) + "deg");
      card.style.setProperty("--rx", (-ny * MAX * 2).toFixed(2) + "deg");
      card.style.setProperty("--mx", ((nx + 0.5) * 100).toFixed(1) + "%");
      card.style.setProperty("--my", ((ny + 0.5) * 100).toFixed(1) + "%");
    }, { passive: true });
    document.addEventListener("pointerout", (e) => {
      const card = e.target.closest(".product-card");
      if (!card || card.contains(e.relatedTarget)) return;
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    }, { passive: true });
  }
})();
