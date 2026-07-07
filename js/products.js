/* ============================================================
   TREASURE TROVE — PRODUCT RENDERING
   Grids, category filters, woven placeholders, lightbox,
   WhatsApp enquiry buttons, and access gating.
   ============================================================ */

(function () {
  "use strict";

  const CFG = window.SITE_CONFIG || {};
  const ALL = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];

  /* ---------------- helpers ---------------- */

  const PALETTES = {
    maroon:     ["#4A0E18", "#8C2233", "#D9B45C"],
    gold:       ["#8A6420", "#D9B45C", "#F6F0E4"],
    indigo:     ["#1E2A44", "#3D5177", "#D9B45C"],
    terracotta: ["#7A3B22", "#B5643C", "#EFD9A0"],
    forest:     ["#1F3A2D", "#3F6B50", "#D9B45C"]
  };

  function formatPrice(p) {
    if (typeof p === "number") {
      return "₹ " + p.toLocaleString("en-IN");
    }
    return escapeHtml(p || "On Request");
  }

  function waEnquiryLink(prod) {
    return window.buildWhatsAppLink(
      "Hello " + (CFG.brandName || "Treasure Trove") +
      ", I'm interested in \"" + prod.name + "\" (Ref: " + prod.id + "). " +
      "Could you share more details, photos and the price?"
    );
  }

  const WA_ICON =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.16-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.12 15.08l-.3-.18-3.06.89.9-2.98-.2-.31A8.1 8.1 0 0 1 12.05 3.8Zm-3.3 3.9c-.18 0-.47.07-.72.34-.24.27-.94.92-.94 2.24 0 1.32.96 2.6 1.1 2.78.13.18 1.86 2.97 4.6 4.05 2.28.9 2.74.72 3.24.67.5-.04 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07a7.42 7.42 0 0 1-2.18-1.35 8.2 8.2 0 0 1-1.51-1.88c-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.6-1.46-.83-2-.2-.46-.4-.4-.55-.4h-.53Z"/></svg>';

  /* Woven-pattern SVG placeholder — used when a product has no photo
     yet, or when its photo fails to load. */
  function placeholderSVG(prod) {
    const pal = PALETTES[prod.palette] || PALETTES.maroon;
    const initials = escapeHtml(
      prod.name.split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase()
    );
    const pid = "p" + Math.random().toString(36).slice(2, 8);
    return (
      '<svg class="ph" viewBox="0 0 400 500" role="img" aria-label="' + escapeHtml(prod.name) + ' — photo coming soon" preserveAspectRatio="xMidYMid slice">' +
      "<defs>" +
      '<pattern id="' + pid + '" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="28" height="28" fill="' + pal[0] + '"/>' +
      '<rect y="12" width="28" height="3" fill="' + pal[1] + '" opacity=".65"/>' +
      '<rect x="12" width="3" height="28" fill="' + pal[1] + '" opacity=".4"/>' +
      '<circle cx="14" cy="14" r="1.6" fill="' + pal[2] + '" opacity=".8"/>' +
      "</pattern>" +
      "</defs>" +
      '<rect width="400" height="500" fill="url(#' + pid + ')"/>' +
      '<rect x="24" y="24" width="352" height="452" fill="none" stroke="' + pal[2] + '" stroke-width="1.5" opacity=".7"/>' +
      '<rect x="32" y="32" width="336" height="436" fill="none" stroke="' + pal[2] + '" stroke-width=".6" opacity=".5"/>' +
      '<text x="200" y="250" text-anchor="middle" font-family="Georgia,serif" font-size="86" font-style="italic" fill="' + pal[2] + '" opacity=".9">' + initials + "</text>" +
      '<text x="200" y="300" text-anchor="middle" font-family="Georgia,serif" font-size="15" letter-spacing="4" fill="' + pal[2] + '" opacity=".75">PHOTOGRAPH AWAITED</text>' +
      "</svg>"
    );
  }

  function mediaHTML(prod) {
    if (prod.image) {
      return '<img src="' + escapeHtml(prod.image) + '" alt="' + escapeHtml(prod.name) +
        '" loading="lazy" data-pid="' + escapeHtml(prod.id) + '">';
    }
    return placeholderSVG(prod);
  }

  function cardHTML(prod) {
    const badge = prod.exclusive
      ? '<span class="badge gold">Vault Exclusive</span>'
      : (prod.featured ? '<span class="badge">Signature</span>' : "");
    return (
      '<article class="product-card reveal" data-id="' + escapeHtml(prod.id) + '" data-category="' + escapeHtml(prod.category) + '">' +
      '<div class="product-media" role="button" tabindex="0" aria-label="View ' + escapeHtml(prod.name) + '">' + badge + mediaHTML(prod) + "</div>" +
      '<div class="product-body">' +
      '<span class="product-cat">' + escapeHtml(prod.category) + "</span>" +
      '<h3 class="product-name">' + escapeHtml(prod.name) + "</h3>" +
      (prod.size ? '<span class="product-size">' + escapeHtml(prod.size) + "</span>" : "") +
      '<p class="product-desc">' + escapeHtml(prod.description) + "</p>" +
      '<div class="product-foot">' +
      '<span class="product-price"><small>Price</small>' + formatPrice(prod.price) + "</span>" +
      '<a class="btn-whatsapp" href="' + waEnquiryLink(prod) + '" target="_blank" rel="noopener noreferrer" aria-label="Enquire about ' + escapeHtml(prod.name) + ' on WhatsApp">' +
      WA_ICON + "Enquire</a>" +
      "</div></div></article>"
    );
  }

  /* If a real photo 404s, swap in the woven placeholder. */
  function attachImageFallbacks(container) {
    container.querySelectorAll(".product-media img").forEach((img) => {
      img.addEventListener("error", () => {
        const prod = ALL.find((p) => p.id === img.dataset.pid);
        if (prod) img.outerHTML = placeholderSVG(prod);
      }, { once: true });
    });
  }

  /* ---------------- lightbox ---------------- */

  function ensureLightbox() {
    let lb = document.getElementById("lightbox");
    if (lb) return lb;
    lb = document.createElement("div");
    lb.id = "lightbox";
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.innerHTML = '<button class="lightbox-close" aria-label="Close">×</button><div class="lightbox-inner"></div>';
    document.body.appendChild(lb);

    const close = () => { lb.classList.remove("open"); document.body.style.overflow = ""; };
    lb.querySelector(".lightbox-close").addEventListener("click", close);
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    return lb;
  }

  function openLightbox(prod) {
    const lb = ensureLightbox();
    lb.querySelector(".lightbox-inner").innerHTML =
      '<div class="lightbox-media">' + mediaHTML(prod) + "</div>" +
      '<div class="lightbox-body">' +
      '<span class="ref">Ref · ' + escapeHtml(prod.id) + "</span>" +
      '<span class="product-cat">' + escapeHtml(prod.category) + "</span>" +
      "<h2>" + escapeHtml(prod.name) + "</h2>" +
      (prod.size ? '<span class="product-size">' + escapeHtml(prod.size) + "</span>" : "") +
      "<p>" + escapeHtml(prod.description) + "</p>" +
      '<p class="product-price" style="margin-top:auto"><small>Price</small>' + formatPrice(prod.price) + "</p>" +
      '<a class="btn-whatsapp" style="justify-content:center" href="' + waEnquiryLink(prod) +
      '" target="_blank" rel="noopener noreferrer">' + WA_ICON + "Enquire on WhatsApp</a>" +
      "</div>";
    attachImageFallbacks(lb);
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
    lb.querySelector(".lightbox-close").focus();
  }

  /* ---------------- grid rendering ---------------- */

  function renderGrid(container, products) {
    if (!products.length) {
      container.innerHTML = '<div class="grid-empty"><p>Nothing here yet — new pieces arrive from the looms regularly.<br>Reach out on WhatsApp and we\'ll show you what\'s coming.</p></div>';
      return;
    }
    container.innerHTML = products.map(cardHTML).join("");
    attachImageFallbacks(container);

    container.querySelectorAll(".product-media").forEach((m) => {
      const open = () => {
        const id = m.closest(".product-card").dataset.id;
        const prod = ALL.find((p) => p.id === id);
        if (prod) openLightbox(prod);
      };
      m.addEventListener("click", open);
      m.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });

    // reveal cards that are already in view
    requestAnimationFrame(() => {
      container.querySelectorAll(".reveal").forEach((el, i) => {
        setTimeout(() => el.classList.add("in"), 60 * (i % 8));
      });
    });
  }

  function renderFilters(bar, products, grid) {
    const cats = ["All", ...new Set(products.map((p) => p.category))];
    bar.innerHTML = cats.map((c, i) =>
      '<button class="chip' + (i === 0 ? " active" : "") + '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + "</button>"
    ).join("");
    bar.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      bar.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.cat;
      renderGrid(grid, cat === "All" ? products : products.filter((p) => p.category === cat));
    });
  }

  /* ---------------- page wiring + access gates ---------------- */

  document.addEventListener("DOMContentLoaded", () => {

    /* Home: featured (public pieces only) */
    const featured = document.getElementById("featured-grid");
    if (featured) {
      renderGrid(featured, ALL.filter((p) => p.featured && !p.exclusive).slice(0, 4));
    }

    /* Collections page: public products, login-gated if configured */
    const collectionGrid = document.getElementById("collection-grid");
    if (collectionGrid && window.TTAuth) {
      window.TTAuth.ready.then(() => {
        window.TTAuth.onChange((user) => {
          const gate = document.getElementById("login-gate");
          const content = document.getElementById("collection-content");
          if (CFG.requireLoginForCollections && !user) {
            if (gate) gate.hidden = false;
            if (content) content.hidden = true;
          } else {
            if (gate) gate.hidden = true;
            if (content) content.hidden = false;
            const pub = ALL.filter((p) => !p.exclusive);
            renderFilters(document.getElementById("filter-bar"), pub, collectionGrid);
            renderGrid(collectionGrid, pub);
          }
        });
      });
    }

    /* Vault page: exclusive products, needs login + owner approval */
    const vaultGrid = document.getElementById("vault-grid");
    if (vaultGrid && window.TTAuth) {
      window.TTAuth.ready.then(() => {
        window.TTAuth.onChange((user) => {
          const gateLogin = document.getElementById("vault-gate-login");
          const gatePending = document.getElementById("vault-gate-pending");
          const content = document.getElementById("vault-content");
          [gateLogin, gatePending, content].forEach((el) => { if (el) el.hidden = true; });

          if (!user) {
            if (gateLogin) gateLogin.hidden = false;
          } else if (!user.approved) {
            if (gatePending) {
              gatePending.hidden = false;
              const wa = gatePending.querySelector(".btn-whatsapp");
              if (wa) wa.href = window.buildWhatsAppLink(
                "Hello, I'd like to request access to the Treasure Trove Vault. " +
                "My registered email is " + user.email +
                (user.phone ? " and my phone is " + user.phone : "") + ". Thank you!"
              );
            }
          } else {
            if (content) content.hidden = false;
            const excl = ALL.filter((p) => p.exclusive);
            renderFilters(document.getElementById("vault-filter-bar"), excl, vaultGrid);
            renderGrid(vaultGrid, excl);
          }
        });
      });
    }
  });
})();
