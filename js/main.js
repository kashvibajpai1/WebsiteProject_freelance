/* ============================================================
   TREASURE TROVE — SHARED UI
   Header, nav, auth chip, scroll reveals, contact injection.
   ============================================================ */

(function () {
  "use strict";

  const CFG = window.SITE_CONFIG || {};

  /* ---------- WhatsApp link builder (shared) ---------- */
  window.buildWhatsAppLink = function (message) {
    const text = encodeURIComponent(message ||
      "Hello " + (CFG.brandName || "Treasure Trove") + ", I found you through your website and would love to know more.");
    return "https://wa.me/" + CFG.whatsappNumber + "?text=" + text;
  };

  document.addEventListener("DOMContentLoaded", () => {

    /* ---------- inject config-driven text/links ----------
       Any element with data-cfg="key" gets its text from SITE_CONFIG,
       data-cfg-href="key" gets its href. One place to update details. */
    document.querySelectorAll("[data-cfg]").forEach((el) => {
      const v = CFG[el.dataset.cfg];
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-cfg-href]").forEach((el) => {
      const key = el.dataset.cfgHref;
      if (key === "whatsapp") el.href = window.buildWhatsAppLink(el.dataset.waMessage);
      else if (key === "tel") el.href = "tel:+" + CFG.whatsappNumber;
      else if (key === "mailto") el.href = "mailto:" + CFG.email;
      else if (CFG[key]) el.href = CFG[key];
    });

    /* ---------- demo-mode banner ---------- */
    if (window.TTAuth && window.TTAuth.isDemo) {
      const b = document.createElement("div");
      b.className = "demo-banner";
      b.innerHTML = "Preview mode — accounts are stored only in this browser. " +
        "Connect Firebase (see README) to enable real logins.";
      document.body.prepend(b);
    }

    /* ---------- header scroll shadow ---------- */
    const header = document.querySelector(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    /* ---------- mobile nav ---------- */
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
        document.body.style.overflow = open ? "hidden" : "";
      });
      nav.querySelectorAll("a").forEach((a) =>
        a.addEventListener("click", () => {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
        })
      );
    }

    /* ---------- mark current page in nav ---------- */
    const page = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".main-nav a.nav-link").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (href === page || (page === "index.html" && href.startsWith("index.html") && !href.includes("#"))) {
        a.setAttribute("aria-current", "page");
      }
    });

    /* ---------- auth area in header ---------- */
    const authArea = document.getElementById("auth-area");
    if (authArea && window.TTAuth) {
      window.TTAuth.onChange((user) => {
        if (user) {
          const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
          authArea.innerHTML =
            '<span class="user-chip"><span class="avatar">' + initial + "</span>" +
            "<span>" + escapeHtml(firstName(user.name) || user.email) + "</span>" +
            '<button type="button" id="logout-btn">Logout</button></span>';
          authArea.querySelector("#logout-btn").addEventListener("click", () => window.TTAuth.signOut());
        } else {
          authArea.innerHTML = '<button type="button" class="btn-auth" id="login-btn">Login</button>';
          authArea.querySelector("#login-btn").addEventListener("click", () => window.TTAuth.goToLogin());
        }
      });
    }

    /* ---------- scroll reveal ---------- */
    const revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && revealEls.length) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        }),
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("in"));
    }

    /* ---------- marquee: duplicate track for seamless loop ---------- */
    const track = document.querySelector(".marquee-track");
    if (track) track.innerHTML += track.innerHTML;

    /* ---------- footer year ---------- */
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });

  function firstName(full) { return String(full || "").trim().split(/\s+/)[0]; }

  window.escapeHtml = function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
})();
