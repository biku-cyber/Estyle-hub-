/**
 * Style Hub — Firebase Phone Auth (India +91 default).
 *
 * Public API:
 *   Auth.currentUser()           → user object or null
 *   Auth.requireLogin(reason?)   → Promise<user> ; opens modal if needed
 *   Auth.logout()                → sign out & clear caches
 *   Auth.onChange(cb)            → subscribe to auth state changes
 *
 * The auth flow triggers automatically the first time a visitor books an
 * appointment or saves a favorite (callers wrap those actions with
 * Auth.requireLogin). Once verified, the session is remembered until the
 * user explicitly logs out, so we never ask for OTP again.
 */
(function () {
  const DEFAULT_CC = "+91";
  const USER_KEY = "sh_demo_user";
  const PROFILE_KEY = "sh_profile_cache";

  const listeners = new Set();
  let ready = false;
  let currentUser = null;
  let currentProfile = null;

  /* -------------------- Small helpers -------------------- */
  function saveProfileCache(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p || null)); } catch (_) {}
  }
  function loadProfileCache() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); }
    catch (_) { return null; }
  }
  function notify() {
    listeners.forEach((fn) => { try { fn(currentUser, currentProfile); } catch (_) {} });
  }
  function normalizePhone(raw) {
    // Strip spaces / dashes / brackets. Ensure it begins with country code.
    const digits = String(raw || "").replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) return digits;
    if (digits.length === 10) return DEFAULT_CC + digits;
    return DEFAULT_CC + digits;
  }
  function validIndian10(num) { return /^\d{10}$/.test(num); }

  /* --------------------- Modal UI ------------------------ */
  const MODAL_HTML = `
  <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
    <div class="auth-card">
      <button class="auth-close icon-btn" aria-label="Close" data-auth-close>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="auth-body">
        <div class="auth-logo"><img src="/assets/logo.svg" alt="" /></div>
        <h2 id="authTitle">Sign in to continue</h2>
        <p class="text-muted auth-reason">Quick verification with your mobile number — takes 30 seconds.</p>

        <!-- Step 1: name + phone -->
        <div data-auth-step="phone" class="auth-step">
          <div class="field">
            <label for="authName">Your name</label>
            <input id="authName" type="text" autocomplete="name" placeholder="e.g. Rohan Sharma" />
            <div class="error">Please enter your name.</div>
          </div>
          <div class="field">
            <label for="authPhone">Mobile number</label>
            <div class="phone-input">
              <span class="cc">+91</span>
              <input id="authPhone" type="tel" inputmode="numeric" maxlength="10"
                     autocomplete="tel-national" placeholder="10-digit mobile" />
            </div>
            <div class="error">Enter a valid 10-digit Indian mobile number.</div>
          </div>
          <div id="authRecaptcha" style="margin: .25rem 0;"></div>
          <button type="button" class="btn btn-primary btn-block" data-auth-send>
            Send OTP
          </button>
          <p class="text-muted center" style="font-size:.78rem; margin-top:.75rem;">
            By continuing you agree to receive an SMS with a one-time code.
          </p>
        </div>

        <!-- Step 2: OTP -->
        <div data-auth-step="otp" class="auth-step hidden">
          <p class="text-muted">We sent a 6-digit code to <strong data-auth-phone>—</strong>.
            <button type="button" class="linkish" data-auth-back>Change</button>
          </p>
          <div class="otp-inputs" role="group" aria-label="One-time code">
            <input inputmode="numeric" maxlength="1" data-otp="0" />
            <input inputmode="numeric" maxlength="1" data-otp="1" />
            <input inputmode="numeric" maxlength="1" data-otp="2" />
            <input inputmode="numeric" maxlength="1" data-otp="3" />
            <input inputmode="numeric" maxlength="1" data-otp="4" />
            <input inputmode="numeric" maxlength="1" data-otp="5" />
          </div>
          <div class="error otp-error hidden">Invalid or expired code. Try again.</div>
          <button type="button" class="btn btn-primary btn-block" data-auth-verify>
            Verify &amp; Continue
          </button>
          <div class="center" style="margin-top:.75rem;">
            <button type="button" class="linkish" data-auth-resend disabled>
              Resend code in <span data-auth-timer>30</span>s
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  function ensureModal() {
    let m = document.querySelector(".auth-modal");
    if (m) return m;
    const wrap = document.createElement("div");
    wrap.innerHTML = MODAL_HTML.trim();
    m = wrap.firstElementChild;
    document.body.appendChild(m);
    return m;
  }

  function openModal(reason) {
    const m = ensureModal();
    if (reason) m.querySelector(".auth-reason").textContent = reason;
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => m.querySelector("#authName")?.focus(), 50);
    return m;
  }

  function closeModal() {
    const m = document.querySelector(".auth-modal");
    if (!m) return;
    m.classList.remove("open");
    document.body.style.overflow = "";
    // Reset steps for next time
    m.querySelector('[data-auth-step="phone"]').classList.remove("hidden");
    m.querySelector('[data-auth-step="otp"]').classList.add("hidden");
    m.querySelectorAll(".field").forEach((f) => f.classList.remove("invalid"));
    m.querySelector(".otp-error")?.classList.add("hidden");
  }

  /* --------------- Profile in Firestore ------------------ */
  async function loadProfile(uid) {
    if (!window.StyleHub?.live || !uid) return loadProfileCache();
    try {
      const doc = await window.StyleHub.db.collection("users").doc(uid).get();
      if (doc.exists) {
        const p = { id: uid, ...doc.data() };
        saveProfileCache(p);
        return p;
      }
    } catch (_) { /* ignore */ }
    return loadProfileCache();
  }

  async function upsertProfile(uid, patch) {
    const base = {
      updatedAt: window.StyleHub?.live ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
    };
    const data = { ...patch, ...base };
    if (window.StyleHub?.live) {
      await window.StyleHub.db.collection("users").doc(uid).set({
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...data,
      }, { merge: true });
    }
    const merged = { id: uid, ...(currentProfile || {}), ...patch };
    currentProfile = merged;
    saveProfileCache(merged);
    return merged;
  }

  /* ----------------- Auth flow (live) -------------------- */
  let confirmationResult = null;
  let recaptchaVerifier = null;
  let resendTimer = null;

  function setupRecaptcha() {
    if (!window.StyleHub?.live) return null;
    if (recaptchaVerifier) return recaptchaVerifier;
    try {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier("authRecaptcha", {
        size: "invisible",
      });
    } catch (e) {
      console.warn("reCAPTCHA setup failed", e);
    }
    return recaptchaVerifier;
  }

  function startResendTimer(modal) {
    let s = 30;
    const btn = modal.querySelector("[data-auth-resend]");
    const label = modal.querySelector("[data-auth-timer]");
    btn.disabled = true;
    btn.innerHTML = `Resend code in <span data-auth-timer>${s}</span>s`;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      s -= 1;
      if (s <= 0) {
        clearInterval(resendTimer);
        btn.disabled = false;
        btn.textContent = "Resend code";
        return;
      }
      const t = modal.querySelector("[data-auth-timer]");
      if (t) t.textContent = s;
    }, 1000);
  }

  async function sendOtp(modal) {
    const name = modal.querySelector("#authName").value.trim();
    const raw = modal.querySelector("#authPhone").value.trim().replace(/\D/g, "");
    const nameField = modal.querySelector("#authName").closest(".field");
    const phoneField = modal.querySelector("#authPhone").closest(".field");
    nameField.classList.toggle("invalid", !name);
    phoneField.classList.toggle("invalid", !validIndian10(raw));
    if (!name || !validIndian10(raw)) return;

    const phone = DEFAULT_CC + raw;
    const btn = modal.querySelector("[data-auth-send]");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Sending…`;

    // Cache pending profile fields so we can write them post-verify.
    modal.dataset.pendingName = name;
    modal.dataset.pendingPhone = phone;
    modal.querySelector("[data-auth-phone]").textContent = phone;

    try {
      if (window.StyleHub?.live) {
        const verifier = setupRecaptcha();
        confirmationResult = await window.StyleHub.auth.signInWithPhoneNumber(phone, verifier);
      } else {
        // Demo mode — any 6 digits accepted.
        confirmationResult = { demo: true };
        window.toast("Demo mode: use any 6-digit code (e.g. 123456).", "info", 3000);
      }
      modal.querySelector('[data-auth-step="phone"]').classList.add("hidden");
      modal.querySelector('[data-auth-step="otp"]').classList.remove("hidden");
      startResendTimer(modal);
      setTimeout(() => modal.querySelector('[data-otp="0"]').focus(), 60);
    } catch (err) {
      console.error(err);
      const msg = err?.code === "auth/too-many-requests"
        ? "Too many attempts. Please try again later."
        : "Couldn't send the code. Check your number and try again.";
      window.toast(msg, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Send OTP";
    }
  }

  async function verifyOtp(modal, resolver) {
    const inputs = modal.querySelectorAll("[data-otp]");
    const code = Array.from(inputs).map((i) => i.value).join("");
    const errEl = modal.querySelector(".otp-error");
    errEl.classList.add("hidden");
    if (!/^\d{6}$/.test(code)) {
      errEl.textContent = "Please enter the 6-digit code.";
      errEl.classList.remove("hidden");
      return;
    }
    const btn = modal.querySelector("[data-auth-verify]");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Verifying…`;

    try {
      let uid, phone = modal.dataset.pendingPhone;
      const name = modal.dataset.pendingName;
      if (window.StyleHub?.live && confirmationResult?.confirm) {
        const cred = await confirmationResult.confirm(code);
        uid = cred.user.uid;
        phone = cred.user.phoneNumber || phone;
        currentUser = cred.user;
      } else {
        // Demo mode — accept anything, mint local user.
        uid = "demo-" + phone.replace(/\D/g, "");
        const demoUser = { uid, phoneNumber: phone, isAnonymous: false, demo: true };
        localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
        currentUser = demoUser;
      }

      currentProfile = await upsertProfile(uid, { name, phone });
      window.toast(`Welcome, ${name.split(" ")[0]}!`, "success");
      closeModal();
      notify();
      resolver(currentUser);
      // Auto-redirect to dashboard only if user landed here through login link.
      if (modal.dataset.redirectAfter === "dashboard") {
        setTimeout(() => (location.href = "/dashboard.html"), 300);
      }
    } catch (err) {
      console.error(err);
      errEl.textContent = "Invalid or expired code. Try again.";
      errEl.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Verify & Continue";
    }
  }

  function bindModal(modal, resolver) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) { closeModal(); resolver(null); }
      if (e.target.closest("[data-auth-close]")) { closeModal(); resolver(null); }
      if (e.target.closest("[data-auth-send]")) sendOtp(modal);
      if (e.target.closest("[data-auth-verify]")) verifyOtp(modal, resolver);
      if (e.target.closest("[data-auth-back]")) {
        modal.querySelector('[data-auth-step="otp"]').classList.add("hidden");
        modal.querySelector('[data-auth-step="phone"]').classList.remove("hidden");
      }
      if (e.target.closest("[data-auth-resend]") && !e.target.closest("[data-auth-resend]").disabled) {
        sendOtp(modal);
      }
    });
    // Phone: digits only
    const phoneInput = modal.querySelector("#authPhone");
    phoneInput?.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });
    // OTP auto-advance
    const otpInputs = modal.querySelectorAll("[data-otp]");
    otpInputs.forEach((el, i) => {
      el.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 1);
        if (e.target.value && otpInputs[i + 1]) otpInputs[i + 1].focus();
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !e.target.value && otpInputs[i - 1]) otpInputs[i - 1].focus();
      });
      el.addEventListener("paste", (e) => {
        const t = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (!t) return;
        e.preventDefault();
        otpInputs.forEach((inp, idx) => { inp.value = t[idx] || ""; });
        otpInputs[Math.min(t.length, otpInputs.length - 1)].focus();
      });
    });
  }

  /* -------------------- Public API ----------------------- */
  const Auth = {
    currentUser() { return currentUser; },
    currentProfile() { return currentProfile || loadProfileCache(); },
    isReady() { return ready; },

    onChange(cb) {
      listeners.add(cb);
      cb(currentUser, currentProfile);
      return () => listeners.delete(cb);
    },

    /**
     * Ensure the visitor is signed in before continuing.
     * Resolves with the user, or null if they close the modal.
     */
    async requireLogin(reason, opts = {}) {
      await window.StyleHub?.init?.();
      if (currentUser) return currentUser;
      return new Promise((resolve) => {
        const modal = openModal(reason);
        if (opts.redirectAfter) modal.dataset.redirectAfter = opts.redirectAfter;
        if (!modal.dataset.bound) {
          bindModal(modal, resolve);
          modal.dataset.bound = "1";
        } else {
          // Rebind resolver by cloning listener — simplest is to re-bind
          modal.replaceWith(modal.cloneNode(true));
          const fresh = document.querySelector(".auth-modal");
          bindModal(fresh, resolve);
          fresh.dataset.bound = "1";
          fresh.classList.add("open");
        }
      });
    },

    async logout() {
      try { if (window.StyleHub?.live) await window.StyleHub.auth.signOut(); } catch (_) {}
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(PROFILE_KEY);
      currentUser = null;
      currentProfile = null;
      notify();
      window.toast("Signed out", "info", 1500);
      setTimeout(() => (location.href = "/home.html"), 400);
    },
  };

  window.Auth = Auth;

  /* -------------------- Nav slot ------------------------- */
  function renderAuthSlot(user, profile) {
    document.querySelectorAll("[data-auth-slot]").forEach((slot) => {
      if (user) {
        const initial = ((profile?.name || user.phoneNumber || "U").trim()[0] || "U").toUpperCase();
        slot.innerHTML = `
          <a href="/dashboard.html" class="account-chip" title="My dashboard">
            <span class="avatar">${initial}</span>
            <span class="account-name">${(profile?.name || "Account").split(" ")[0]}</span>
          </a>`;
      } else {
        slot.innerHTML = `<button type="button" class="btn btn-ghost btn-sm" data-auth-login>Sign in</button>`;
      }
    });
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-auth-login]")) {
      Auth.requireLogin("Sign in to view your bookings, favorites, and offers.",
        { redirectAfter: "dashboard" });
    }
  });
  listeners.add(renderAuthSlot);

  /* -------------------- Bootstrap ------------------------ */
  document.addEventListener("DOMContentLoaded", async () => {
    renderAuthSlot(currentUser, currentProfile);
    await window.StyleHub?.init?.();
    if (window.StyleHub?.live) {
      window.StyleHub.auth.onAuthStateChanged(async (u) => {
        currentUser = u;
        if (u) currentProfile = await loadProfile(u.uid);
        else currentProfile = null;
        ready = true;
        notify();
      });
    } else {
      currentUser = window.StyleHub?.currentUser?.() || null;
      currentProfile = loadProfileCache();
      ready = true;
      notify();
    }
  });
})();

