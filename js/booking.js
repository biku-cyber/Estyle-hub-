/**
 * Style Hub — Booking form logic.
 * Validates, generates time slots, submits to Firestore (or logs in demo).
 */
(function () {
  const SLOTS = [
    "09:00", "09:45", "10:30", "11:15", "12:00", "13:00",
    "13:45", "14:30", "15:15", "16:00", "16:45", "17:30", "18:15", "19:00",
  ];

  const state = { haircuts: [], barbers: [], selectedSlot: null };

  function fillSelects() {
    const style = document.getElementById("styleSelect");
    const barber = document.getElementById("barberSelect");
    if (style) {
      const preset = new URLSearchParams(location.search).get("style");
      style.innerHTML = `<option value="">Choose a style…</option>` +
        state.haircuts.map((h) => `<option ${preset === h.name ? "selected" : ""} value="${h.name}">${h.name} — $${h.price}</option>`).join("");
    }
    if (barber) {
      barber.innerHTML = `<option value="">Any available barber</option>` +
        state.barbers.map((b) => `<option value="${b.name}">${b.name} · ${b.role}</option>`).join("");
    }
  }

  function renderSlots() {
    const wrap = document.getElementById("slots");
    if (!wrap) return;
    // Randomly disable a few to simulate booked slots.
    const seed = new Date().getDate();
    wrap.innerHTML = SLOTS.map((t, i) => {
      const disabled = ((i + seed) % 5) === 0;
      return `<button type="button" class="time-slot" data-slot="${t}" ${disabled ? "disabled" : ""}>${t}</button>`;
    }).join("");
  }

  function validate(form) {
    let ok = true;
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("invalid"));
    const req = ["name", "phone", "style", "date"];
    req.forEach((n) => {
      const el = form.elements[n];
      if (!el.value.trim()) { el.closest(".field").classList.add("invalid"); ok = false; }
    });
    if (form.elements.phone.value && !/^[\d+\-()\s]{7,}$/.test(form.elements.phone.value)) {
      form.elements.phone.closest(".field").classList.add("invalid"); ok = false;
    }
    if (!state.selectedSlot) {
      document.getElementById("slotsField").classList.add("invalid");
      ok = false;
    }
    return ok;
  }

  function showSuccess(data) {
    document.getElementById("bookingForm").classList.add("hidden");
    const s = document.getElementById("success");
    s.classList.remove("hidden");
    document.getElementById("summary").innerHTML = `
      <li><span>Name</span><strong>${data.name}</strong></li>
      <li><span>Style</span><strong>${data.style}</strong></li>
      <li><span>Barber</span><strong>${data.barber || "Any available"}</strong></li>
      <li><span>Date</span><strong>${data.date} · ${data.time}</strong></li>`;
  }

  function bind() {
    document.addEventListener("click", (e) => {
      const slot = e.target.closest(".time-slot");
      if (slot && !slot.disabled) {
        document.querySelectorAll(".time-slot").forEach((s) => s.classList.remove("selected"));
        slot.classList.add("selected");
        state.selectedSlot = slot.dataset.slot;
        document.getElementById("slotsField").classList.remove("invalid");
      }
    });

    const form = document.getElementById("bookingForm");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validate(form)) { window.toast("Please fix the highlighted fields", "error"); return; }

      // Gate: require phone-verified sign-in before creating the booking.
      const user = await window.Auth.requireLogin(
        "Verify your number to confirm this booking. We'll text updates about your appointment."
      );
      if (!user) { window.toast("Sign in to complete your booking.", "info"); return; }

      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Booking…`;
      const profile = window.Auth.currentProfile() || {};
      const data = {
        userId: user.uid,
        name: form.elements.name.value.trim() || profile.name || "",
        phone: form.elements.phone.value.trim() || profile.phone || user.phoneNumber || "",
        style: form.elements.style.value,
        barber: form.elements.barber.value,
        date: form.elements.date.value,
        time: state.selectedSlot,
        notes: form.elements.notes.value.trim(),
        status: "pending",
      };
      try {
        await window.StyleHub.add("bookings", data);
        window.toast("Booking received!", "success");
        showSuccess(data);
      } catch (err) {
        console.error(err);
        window.toast("Something went wrong. Try again.", "error");
        btn.disabled = false;
        btn.textContent = "Confirm Booking";
      }
    });


    // Min date = today
    const date = document.getElementById("dateInput");
    if (date) date.min = new Date().toISOString().split("T")[0];
  }

  async function init() {
    if (!document.getElementById("bookingForm")) return;
    renderSlots();
    bind();
    await window.StyleHub.init();
    [state.haircuts, state.barbers] = await Promise.all([
      window.StyleHub.list("haircuts"),
      window.StyleHub.list("barbers"),
    ]);
    fillSelects();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
