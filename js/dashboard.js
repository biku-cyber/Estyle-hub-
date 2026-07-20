/**
 * Style Hub — User Dashboard.
 * Requires an authenticated user (redirects to home + opens login if not).
 * Reads profile, bookings, favorites, notifications, offers, and reviews
 * from Firestore (falls back to demo data via StyleHub helper).
 */
(function () {
  const state = { user: null, profile: null, bookings: [], haircuts: [] };

  function fmtDate(d, t) {
    if (!d) return "—";
    const dt = new Date(`${d}T${t || "00:00"}`);
    return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: t ? "short" : undefined });
  }

  function isFuture(b) {
    const dt = new Date(`${b.date}T${b.time || "00:00"}`);
    return dt.getTime() > Date.now() - 60 * 60 * 1000;
  }

  function svgHeart() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }

  function bookingRow(b) {
    return `
      <div class="dash-item">
        <div>
          <strong>${b.style || "Appointment"}</strong>
          <div class="text-muted" style="font-size:.85rem;">
            ${fmtDate(b.date, b.time)} · ${b.barber || "Any barber"}
          </div>
        </div>
        <span class="chip chip-${(b.status || "pending").toLowerCase()}">${b.status || "pending"}</span>
      </div>`;
  }

  function favoriteCard(h) {
    return `
      <article class="card">
        <div class="card-media" style="background-image: linear-gradient(135deg, rgba(245,179,1,0.15), transparent), linear-gradient(45deg, #1a1a1a, #0a0a0a);">
          <button class="fav-btn active" data-remove-fav="${h.id}" aria-label="Remove favorite">${svgHeart()}</button>
        </div>
        <div class="card-body">
          <span class="chip">${h.category}</span>
          <h3 class="card-title" style="margin-top:.6rem">${h.name}</h3>
          <div class="card-meta"><span>${h.time} min</span><span class="card-price">$${h.price}</span></div>
          <a href="/booking.html?style=${encodeURIComponent(h.name)}" class="btn btn-primary btn-sm btn-block">Book</a>
        </div>
      </article>`;
  }

  function offerCard(o) {
    return `
      <div class="card" style="padding:1.25rem;">
        <span class="chip">Offer</span>
        <h3 style="margin:.5rem 0 .35rem;">${o.title}</h3>
        <p class="text-muted" style="font-size:.9rem;">${o.description}</p>
        <div class="flex-between mt-2">
          <code class="coupon">${o.code}</code>
          <button class="btn btn-secondary btn-sm" data-copy="${o.code}">Copy</button>
        </div>
      </div>`;
  }

  function emptyState(msg, cta) {
    return `<div class="dash-empty">
      <div class="animate-float" style="font-size:2rem;">✨</div>
      <p class="text-muted">${msg}</p>
      ${cta ? `<a href="${cta.href}" class="btn btn-primary btn-sm mt-2">${cta.label}</a>` : ""}
    </div>`;
  }

  async function loadEverything() {
    const user = state.user;
    // Bookings — filter by userId when live, else use all demo bookings.
    let bookings = [];
    if (window.StyleHub.live && user?.uid) {
      try {
        const snap = await window.StyleHub.db.collection("bookings")
          .where("userId", "==", user.uid).get();
        bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn(e);
      }
    } else {
      bookings = (await window.StyleHub.list("bookings"))
        .filter((b) => !b.userId || b.userId === user?.uid);
    }
    state.bookings = bookings;
    state.haircuts = await window.StyleHub.list("haircuts");
    return bookings;
  }

  function renderProfile() {
    const p = state.profile || {};
    const u = state.user || {};
    const initial = ((p.name || u.phoneNumber || "U").trim()[0] || "U").toUpperCase();
    document.querySelector("[data-dash-avatar]").textContent = initial;
    document.querySelector("[data-dash-name]").textContent = p.name || "Style Hub member";
    document.querySelector("[data-dash-phone]").textContent = p.phone || u.phoneNumber || "";
    document.getElementById("pfName").value = p.name || "";
    document.getElementById("pfPhone").value = p.phone || u.phoneNumber || "";
    document.getElementById("pfEmail").value = p.email || "";
    document.querySelector("[data-dash-greeting]").textContent =
      `Welcome back, ${(p.name || "friend").split(" ")[0]}.`;
  }

  function renderStats() {
    const upcoming = state.bookings.filter(isFuture).length;
    const total = state.bookings.length;
    const favs = window.Favorites.list().length;
    document.querySelector('[data-stat="upcoming"]').textContent = upcoming;
    document.querySelector('[data-stat="total"]').textContent = total;
    document.querySelector('[data-stat="favs"]').textContent = favs;
  }

  function renderLists() {
    const up = state.bookings.filter(isFuture)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const hist = state.bookings.filter((b) => !isFuture(b))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const upEl = document.querySelector('[data-list="upcoming"]');
    const histEl = document.querySelector('[data-list="history"]');
    upEl.innerHTML = up.length ? up.map(bookingRow).join("")
      : emptyState("No upcoming bookings yet.", { href: "/booking.html", label: "Book a chair" });
    histEl.innerHTML = hist.length ? hist.map(bookingRow).join("")
      : emptyState("Your appointment history will appear here.");

    // Favorites
    const favIds = window.Favorites.list();
    const favList = state.haircuts.filter((h) => favIds.includes(h.id));
    document.querySelector('[data-list="favorites"]').innerHTML = favList.length
      ? favList.map(favoriteCard).join("")
      : emptyState("Save styles from the Haircuts page and they'll show up here.",
                   { href: "/gallery.html", label: "Browse haircuts" });
  }

  async function renderNotifications() {
    const el = document.querySelector('[data-list="notifications"]');
    let items = [];
    if (window.StyleHub.live && state.user?.uid) {
      try {
        const snap = await window.StyleHub.db.collection("notifications")
          .where("userId", "==", state.user.uid).get();
        items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (_) {}
    }
    if (!items.length) {
      items = state.bookings.filter(isFuture).map((b) => ({
        title: `Appointment reminder`,
        body: `Your ${b.style || "appointment"} is on ${fmtDate(b.date, b.time)}.`,
        time: b.date,
      }));
    }
    el.innerHTML = items.length ? items.map((n) => `
      <div class="dash-item">
        <div><strong>${n.title}</strong>
          <div class="text-muted" style="font-size:.85rem;">${n.body || ""}</div>
        </div>
        <span class="text-muted" style="font-size:.8rem;">${n.time || ""}</span>
      </div>`).join("") : emptyState("You're all caught up.");
  }

  async function renderOffers() {
    const offers = await window.StyleHub.list("offers");
    document.querySelector('[data-list="offers"]').innerHTML = offers.length
      ? offers.map(offerCard).join("")
      : emptyState("No offers right now — check back soon!");
  }

  async function renderReviews() {
    const el = document.querySelector('[data-list="reviews"]');
    let mine = [];
    if (window.StyleHub.live && state.user?.uid) {
      try {
        const snap = await window.StyleHub.db.collection("reviews")
          .where("userId", "==", state.user.uid).get();
        mine = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (_) {}
    }
    el.innerHTML = mine.length ? mine.map((r) => `
      <div class="dash-item">
        <div>
          <strong>${"★".repeat(r.rating || 5)}</strong>
          <div class="text-muted" style="font-size:.9rem;">${r.text || ""}</div>
        </div>
      </div>`).join("")
      : emptyState("You haven't left any reviews yet.");
  }

  function bindTabs() {
    document.querySelectorAll(".dash-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".dash-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        document.querySelectorAll(".dash-panel").forEach((p) =>
          p.classList.toggle("hidden", p.dataset.panel !== tab));
      });
    });
  }

  function bindActions() {
    document.querySelector("[data-save-profile]")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const name = document.getElementById("pfName").value.trim();
      const email = document.getElementById("pfEmail").value.trim();
      if (!name) { window.toast("Please enter your name.", "error"); return; }
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Saving…`;
      try {
        if (window.StyleHub.live) {
          await window.StyleHub.db.collection("users").doc(state.user.uid)
            .set({ name, email }, { merge: true });
        }
        state.profile = { ...(state.profile || {}), name, email };
        localStorage.setItem("sh_profile_cache", JSON.stringify(state.profile));
        window.toast("Profile updated", "success");
        renderProfile();
      } catch (err) {
        console.error(err);
        window.toast("Couldn't save right now.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Save changes";
      }
    });

    document.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove-fav]");
      if (rm) {
        window.Favorites.toggle(rm.dataset.removeFav);
        window.toast("Removed from favorites", "info", 1500);
        renderLists(); renderStats();
      }
      const cp = e.target.closest("[data-copy]");
      if (cp) {
        navigator.clipboard?.writeText(cp.dataset.copy);
        window.toast(`Copied ${cp.dataset.copy}`, "success", 1500);
      }
      if (e.target.closest("[data-dash-logout]")) window.Auth.logout();
    });

    // Theme toggle in settings
    const themeSwitch = document.querySelector("[data-setting-theme]");
    if (themeSwitch) {
      themeSwitch.checked = document.documentElement.getAttribute("data-theme") !== "light";
      themeSwitch.addEventListener("change", () => {
        const next = themeSwitch.checked ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("sh_theme", next);
      });
    }
    // Settings persist to profile
    document.querySelectorAll("[data-setting]").forEach((el) => {
      const key = el.dataset.setting;
      el.checked = !!(state.profile?.settings?.[key]);
      el.addEventListener("change", async () => {
        const settings = { ...(state.profile?.settings || {}), [key]: el.checked };
        state.profile = { ...(state.profile || {}), settings };
        if (window.StyleHub.live) {
          await window.StyleHub.db.collection("users").doc(state.user.uid)
            .set({ settings }, { merge: true });
        }
        localStorage.setItem("sh_profile_cache", JSON.stringify(state.profile));
      });
    });
  }

  async function init() {
    await window.StyleHub.init();
    // Gate — require login. If they cancel, send home.
    const user = await window.Auth.requireLogin(
      "Sign in with your mobile number to view your dashboard."
    );
    if (!user) { location.href = "/home.html"; return; }
    state.user = user;
    state.profile = window.Auth.currentProfile() || {};
    bindTabs();
    renderProfile();
    await loadEverything();
    renderStats();
    renderLists();
    renderNotifications();
    renderOffers();
    renderReviews();
    bindActions();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
