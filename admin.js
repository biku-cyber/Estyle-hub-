/**
 * Style Hub — Admin panel logic.
 * Simple gated dashboard with CRUD tables for haircuts, services, bookings,
 * plus customer/review/favorites/settings management.
 *
 * Auth: demo mode allows any credentials; live mode uses Firebase Auth.
 */
(function () {
  const ADMIN_KEY = "sh_admin_session";

  const svg = {
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>`,
    del: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
  };

  /* ---------------------- Auth ---------------------- */
  function isAuthed() {
    return sessionStorage.getItem(ADMIN_KEY) === "1";
  }
  function requireAuth() {
    if (!isAuthed()) {
      location.replace("/admin/login.html");
      return false;
    }
    return true;
  }
  function logout() {
    sessionStorage.removeItem(ADMIN_KEY);
    location.replace("/admin/login.html");
  }
  window.AdminAuth = { isAuthed, requireAuth, logout };

  /* --------------------- Login ---------------------- */
  function initLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    if (isAuthed()) { location.replace("/admin/index.html"); return; }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      const pass = form.elements.password.value;
      if (!email || !pass) { window.toast("Enter your credentials", "error"); return; }
      await window.StyleHub.init();
      if (window.StyleHub.live) {
        try {
          await window.StyleHub.auth.signInWithEmailAndPassword(email, pass);
          sessionStorage.setItem(ADMIN_KEY, "1");
          location.replace("/admin/index.html");
        } catch (err) {
          window.toast(err.message || "Sign-in failed", "error");
        }
      } else {
        // Demo mode — allow any credentials
        sessionStorage.setItem(ADMIN_KEY, "1");
        window.toast("Signed in (demo mode)", "success", 1500);
        setTimeout(() => location.replace("/admin/index.html"), 400);
      }
    });
  }

  /* ------------------ Dashboard --------------------- */
  async function initDashboard() {
    if (!requireAuth()) return;
    const tabsEl = document.querySelector(".admin-tabs");
    if (!tabsEl) return;

    await window.StyleHub.init();

    tabsEl.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tab]");
      if (!t) return;
      document.querySelectorAll("[data-tab]").forEach((el) => el.classList.remove("active"));
      t.classList.add("active");
      document.querySelectorAll(".admin-panel").forEach((el) => el.classList.add("hidden"));
      document.getElementById("panel-" + t.dataset.tab).classList.remove("hidden");
    });

    document.getElementById("logoutBtn")?.addEventListener("click", logout);

    await renderStats();
    await renderTable("haircuts", ["name", "category", "price", "time"]);
    await renderTable("services", ["name", "price", "duration"]);
    await renderTable("bookings", ["name", "phone", "style", "barber", "date", "time", "status"]);
    await renderTable("reviews", ["author", "rating", "text"]);
    await renderTable("barbers", ["name", "role", "years"]);
    await renderTable("offers", ["title", "code", "description"]);
    await renderSettings();
  }

  async function renderStats() {
    const bookings = await window.StyleHub.list("bookings");
    const today = new Date().toISOString().split("T")[0];
    const todays = bookings.filter((b) => b.date === today);
    const pending = bookings.filter((b) => b.status === "pending").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + (Number(b.price) || 0), 0);

    const stats = [
      { label: "Today's Bookings", value: todays.length, accent: true },
      { label: "Pending", value: pending },
      { label: "Completed", value: completed },
      { label: "Revenue (est.)", value: `$${revenue}` },
    ];
    document.getElementById("statsGrid").innerHTML = stats.map((s) => `
      <div class="card" style="padding:1.5rem;">
        <p class="text-muted" style="font-size:.8rem; letter-spacing:.15em; text-transform:uppercase;">${s.label}</p>
        <div style="font-size:2rem; font-weight:700; margin-top:.5rem; ${s.accent ? "color: var(--accent);" : ""}">${s.value}</div>
      </div>`).join("");
  }

  async function renderTable(name, columns) {
    const wrap = document.getElementById("table-" + name);
    if (!wrap) return;
    const rows = await window.StyleHub.list(name);
    wrap.innerHTML = `
      <div class="flex-between mb-4">
        <h3>${name[0].toUpperCase() + name.slice(1)} <span class="text-muted" style="font-size:.85rem;">(${rows.length})</span></h3>
        <button class="btn btn-primary btn-sm" data-add="${name}">+ Add</button>
      </div>
      <div style="overflow-x:auto; border:1px solid var(--border); border-radius: var(--radius);">
        <table style="width:100%; border-collapse: collapse; font-size:.9rem;">
          <thead>
            <tr style="background: var(--bg-elev);">
              ${columns.map((c) => `<th style="text-align:left; padding: .85rem 1rem;">${c}</th>`).join("")}
              <th style="width:100px; padding: .85rem 1rem;"></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((r) => `
              <tr style="border-top:1px solid var(--border);">
                ${columns.map((c) => `<td style="padding: .85rem 1rem;">${r[c] ?? "—"}</td>`).join("")}
                <td style="padding:.5rem 1rem; text-align:right;">
                  <button class="icon-btn" data-edit="${name}" data-id="${r.id}" aria-label="Edit">${svg.edit}</button>
                  <button class="icon-btn" data-del="${name}" data-id="${r.id}" aria-label="Delete">${svg.del}</button>
                </td>
              </tr>`).join("")
              : `<tr><td colspan="${columns.length + 1}" style="padding: 2rem; text-align:center; color: var(--text-muted);">No records yet.</td></tr>`}
          </tbody>
        </table>
      </div>`;

    wrap.addEventListener("click", async (e) => {
      const add = e.target.closest("[data-add]");
      if (add) {
        const data = promptForm(columns, {});
        if (data) { await window.StyleHub.add(name, data); await renderTable(name, columns); window.toast("Added", "success"); }
      }
      const del = e.target.closest("[data-del]");
      if (del) {
        if (confirm("Delete this record?")) {
          await window.StyleHub.remove(name, del.dataset.id);
          await renderTable(name, columns);
          window.toast("Deleted", "success");
        }
      }
      const edit = e.target.closest("[data-edit]");
      if (edit) {
        const row = rows.find((r) => r.id === edit.dataset.id);
        const data = promptForm(columns, row);
        if (data) { await window.StyleHub.update(name, edit.dataset.id, data); await renderTable(name, columns); window.toast("Updated", "success"); }
      }
    }, { once: true });
  }

  function promptForm(columns, existing) {
    const out = {};
    for (const c of columns) {
      const v = prompt(`${c}`, existing[c] ?? "");
      if (v === null) return null;
      out[c] = isNaN(v) || v === "" ? v : Number(v);
    }
    return out;
  }

  async function renderSettings() {
    const wrap = document.getElementById("panel-settings");
    if (!wrap) return;
    const [s] = await window.StyleHub.list("settings");
    if (!s) return;
    wrap.innerHTML = `
      <h3>Site Settings</h3>
      <div class="form mt-4" style="max-width: 640px;">
        ${["name", "tagline", "phone", "whatsapp", "email", "address"].map((k) => `
          <div class="field">
            <label>${k}</label>
            <input data-set="${k}" value="${s[k] || ""}" />
          </div>`).join("")}
        <button class="btn btn-primary" id="saveSettings">Save changes</button>
      </div>`;
    document.getElementById("saveSettings").addEventListener("click", async () => {
      const patch = {};
      wrap.querySelectorAll("[data-set]").forEach((el) => patch[el.dataset.set] = el.value);
      await window.StyleHub.update("settings", s.id, patch);
      window.toast("Settings saved", "success");
    });
  }

  /* -------------------- Boot ------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initLogin();
    initDashboard();
  });
})();
