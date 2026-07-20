/**
 * Style Hub — Main site behavior.
 * Handles nav, theme toggle, scroll effects, toasts, reveal animations,
 * back-to-top, and shared page bootstrapping.
 */
(function () {
  const KEY_THEME = "sh_theme";
  const KEY_FAVS = "sh_favs";

  /* ------------------------ Theme ------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) btn.setAttribute("aria-pressed", theme === "light");
  }
  function initTheme() {
    const saved = localStorage.getItem(KEY_THEME) ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    applyTheme(saved);
    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        localStorage.setItem(KEY_THEME, next);
        applyTheme(next);
      });
    }
  }

  /* ------------------------ Nav -------------------------- */
  function initNav() {
    const nav = document.querySelector(".navbar");
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (nav) {
      const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    if (toggle && links) {
      toggle.addEventListener("click", () => {
        const open = links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open);
      });
      links.querySelectorAll("a").forEach((a) =>
        a.addEventListener("click", () => links.classList.remove("open"))
      );
    }
    // active link
    const path = location.pathname.replace(/\/$/, "").split("/").pop() || "home.html";
    document.querySelectorAll(".nav-links a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.endsWith(path)) a.classList.add("active");
    });
  }

  /* ---------------------- Back to top -------------------- */
  function initBackTop() {
    const btn = document.querySelector(".back-top");
    if (!btn) return;
    window.addEventListener("scroll", () => {
      btn.classList.toggle("show", window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* -------------------- Reveal on scroll ----------------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------------------- Ripple ------------------------- */
  function initRipple() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const r = document.createElement("span");
      r.className = "ripple";
      const size = Math.max(rect.width, rect.height);
      r.style.width = r.style.height = size + "px";
      r.style.left = (e.clientX - rect.left - size / 2) + "px";
      r.style.top = (e.clientY - rect.top - size / 2) + "px";
      btn.appendChild(r);
      setTimeout(() => r.remove(), 600);
    });
  }

  /* ---------------------- Toasts ------------------------- */
  function ensureToastWrap() {
    let w = document.querySelector(".toast-wrap");
    if (!w) {
      w = document.createElement("div");
      w.className = "toast-wrap";
      w.setAttribute("aria-live", "polite");
      document.body.appendChild(w);
    }
    return w;
  }
  window.toast = function (msg, type = "info", ms = 3500) {
    const w = ensureToastWrap();
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    w.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateX(20px)";
      setTimeout(() => t.remove(), 300);
    }, ms);
  };

  /* --------------------- Favorites ----------------------- */
  window.Favorites = {
    list() {
      try { return JSON.parse(localStorage.getItem(KEY_FAVS) || "[]"); }
      catch (_) { return []; }
    },
    has(id) { return this.list().includes(id); },
    toggle(id) {
      const arr = this.list();
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      localStorage.setItem(KEY_FAVS, JSON.stringify(arr));
      // Fire-and-forget Firestore mirror when live
      if (window.StyleHub && window.StyleHub.live) {
        const uid = (window.StyleHub.auth?.currentUser?.uid) || "anon";
        window.StyleHub.db.collection("favorites").doc(uid)
          .set({ items: arr }, { merge: true }).catch(() => {});
      }
      return arr.includes(id);
    },
  };

  /* ------------------- Footer / settings ----------------- */
  async function fillSettings() {
    if (!window.StyleHub) return;
    await window.StyleHub.init();
    const [s] = await window.StyleHub.list("settings");
    if (!s) return;
    document.querySelectorAll("[data-site-name]").forEach((el) => el.textContent = s.name);
    document.querySelectorAll("[data-site-tagline]").forEach((el) => el.textContent = s.tagline);
    document.querySelectorAll("[data-site-phone]").forEach((el) => {
      el.textContent = s.phone;
      if (el.tagName === "A") el.href = `tel:${s.phone.replace(/[^\d+]/g, "")}`;
    });
    document.querySelectorAll("[data-site-whatsapp]").forEach((el) => {
      el.textContent = s.phone;
      if (el.tagName === "A") el.href = `https://wa.me/${s.whatsapp.replace(/\D/g, "")}`;
    });
    document.querySelectorAll("[data-site-email]").forEach((el) => {
      el.textContent = s.email;
      if (el.tagName === "A") el.href = `mailto:${s.email}`;
    });
    document.querySelectorAll("[data-site-address]").forEach((el) => el.textContent = s.address);
    document.querySelectorAll("[data-site-hours]").forEach((el) => {
      el.innerHTML = s.hours.map((h) => `<li><span>${h.day}</span><strong>${h.open}</strong></li>`).join("");
    });
  }

  /* ------------------ Register SW (PWA) ------------------ */
  function initSW() {
    if (!("serviceWorker" in navigator)) return;
    if (location.hostname === "localhost" || location.hostname.endsWith(".lovable.app") || location.hostname.endsWith(".lovableproject.com")) return;
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  /* -------------------- Bootstrap ------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initBackTop();
    initReveal();
    initRipple();
    fillSettings();
    initSW();
    // Set current year in footer
    document.querySelectorAll("[data-year]").forEach((el) => el.textContent = new Date().getFullYear());
  });
})();
