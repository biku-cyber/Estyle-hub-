/**
 * Style Hub — Firebase bridge with graceful demo-data fallback.
 * Loads Firebase v10 compat SDK from CDN. If firebase-config.js is missing
 * or contains placeholder keys, we fall back to local demo data.
 */
(function () {
  const CDN = "https://www.gstatic.com/firebasejs/10.12.0";
  const SDKS = [
    `${CDN}/firebase-app-compat.js`,
    `${CDN}/firebase-firestore-compat.js`,
    `${CDN}/firebase-auth-compat.js`,
    `${CDN}/firebase-storage-compat.js`,
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function tryLoadConfig() {
    // Prefer live config, fall back to the example (won't connect).
    for (const path of ["/firebase-config.js", "/firebase-config.example.js"]) {
      try {
        await loadScript(path);
        if (window.firebaseConfig) return true;
      } catch (_) {
        /* ignore */
      }
    }
    return false;
  }

  const StyleHub = {
    ready: false,
    live: false, // true only when a real Firebase project is reachable
    db: null,
    auth: null,
    storage: null,

    async init() {
      const hasConfig = await tryLoadConfig();
      const cfg = window.firebaseConfig || {};
      const isPlaceholder = !cfg.apiKey || cfg.apiKey.startsWith("YOUR_");

      if (!hasConfig || isPlaceholder) {
        console.info("[StyleHub] Using demo data — replace firebase-config.example.js with your real config to go live.");
        this.ready = true;
        return;
      }

      try {
        for (const s of SDKS) await loadScript(s);
        firebase.initializeApp(cfg);
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.storage = firebase.storage();
        // Keep the user signed in across sessions.
        try {
          await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (_) { /* ignore */ }
        this.live = true;
        this.ready = true;
      } catch (err) {
        console.warn("[StyleHub] Firebase failed to init; falling back to demo data.", err);
        this.ready = true;
      }
    },

    /** Current signed-in user (or a locally-cached demo user). */
    currentUser() {
      if (this.live && this.auth) return this.auth.currentUser;
      try { return JSON.parse(localStorage.getItem("sh_demo_user") || "null"); }
      catch (_) { return null; }
    },

    onAuth(cb) {
      if (this.live && this.auth) return this.auth.onAuthStateChanged(cb);
      // Demo mode — fire once
      cb(this.currentUser());
      return () => {};
    },


    /**
     * Read a collection. Falls back to demo data if offline.
     * @param {string} name
     */
    async list(name) {
      if (this.live && this.db) {
        try {
          const snap = await this.db.collection(name).get();
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn(`[StyleHub] list(${name}) failed, using demo`, e);
        }
      }
      return DEMO[name] || [];
    },

    async add(name, data) {
      if (this.live && this.db) {
        const ref = await this.db.collection(name).add({
          ...data,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return ref.id;
      }
      // Demo mode — just log
      console.info(`[demo] add ${name}`, data);
      return `demo-${Date.now()}`;
    },

    async update(name, id, data) {
      if (this.live && this.db) {
        await this.db.collection(name).doc(id).update(data);
        return;
      }
      console.info(`[demo] update ${name}/${id}`, data);
    },

    async remove(name, id) {
      if (this.live && this.db) {
        await this.db.collection(name).doc(id).delete();
        return;
      }
      console.info(`[demo] remove ${name}/${id}`);
    },
  };

  window.StyleHub = StyleHub;

  // Fallback demo data used until Firebase is configured.
  const DEMO = {
    settings: [{
      id: "site",
      name: "Style Hub",
      tagline: "Where Every Cut Feels Like a Ritual",
      phone: "+1 (555) 010-2040",
      whatsapp: "+15550102040",
      email: "hello@stylehub.co",
      address: "128 Kingsway Lane, Downtown District",
      hours: [
        { day: "Mon – Fri", open: "9:00 AM – 9:00 PM" },
        { day: "Saturday", open: "10:00 AM – 8:00 PM" },
        { day: "Sunday", open: "11:00 AM – 6:00 PM" },
      ],
      social: {
        instagram: "https://instagram.com",
        facebook: "https://facebook.com",
        tiktok: "https://tiktok.com",
      },
    }],
    haircuts: [
      { id: "h1", name: "Signature Skin Fade", category: "Skin Fade", price: 38, time: 45, trending: true, popular: true },
      { id: "h2", name: "Low Fade Classic", category: "Low Fade", price: 32, time: 40 },
      { id: "h3", name: "Mid Fade Sculpt", category: "Mid Fade", price: 34, time: 40, trending: true },
      { id: "h4", name: "High Fade Bold", category: "High Fade", price: 34, time: 40 },
      { id: "h5", name: "Taper Fade Sharp", category: "Taper Fade", price: 30, time: 35, popular: true },
      { id: "h6", name: "Executive Crew", category: "Crew Cut", price: 26, time: 30 },
      { id: "h7", name: "Precision Buzz", category: "Buzz Cut", price: 22, time: 25 },
      { id: "h8", name: "French Crop Modern", category: "French Crop", price: 30, time: 35, trending: true },
      { id: "h9", name: "Signature Pompadour", category: "Pompadour", price: 42, time: 55, popular: true },
      { id: "h10", name: "Textured Quiff", category: "Quiff", price: 38, time: 50 },
      { id: "h11", name: "Sharp Undercut", category: "Undercut", price: 36, time: 45 },
      { id: "h12", name: "Classic Side Part", category: "Side Part", price: 32, time: 40 },
      { id: "h13", name: "Textured Crop Fade", category: "Textured Crop", price: 36, time: 45, trending: true },
      { id: "h14", name: "Curly Sculpt", category: "Curly Hair", price: 40, time: 50 },
      { id: "h15", name: "Full Beard Sculpt", category: "Beard Styles", price: 25, time: 30, popular: true },
      { id: "h16", name: "Goatee Refresh", category: "Beard Styles", price: 20, time: 25 },
    ],
    services: [
      { id: "s1", name: "Haircut", price: 32, duration: 40, description: "Precision cut tailored to your face shape and style." },
      { id: "s2", name: "Hair + Beard Combo", price: 48, duration: 60, description: "Full haircut with a shaped beard trim and hot-towel finish." },
      { id: "s3", name: "Beard Trim", price: 20, duration: 25, description: "Line-up, shape, and condition your beard to perfection." },
      { id: "s4", name: "Hair Wash", price: 12, duration: 15, description: "Deep-cleansing wash with scalp massage and premium products." },
      { id: "s5", name: "Face Clean", price: 28, duration: 35, description: "Exfoliating facial that leaves your skin fresh and glowing." },
    ],
    barbers: [
      { id: "b1", name: "Marco Rivera", role: "Master Barber", years: 12, initial: "M" },
      { id: "b2", name: "Alex Chen", role: "Senior Stylist", years: 8, initial: "A" },
    ],
    reviews: [
      { id: "r1", author: "James P.", rating: 5, text: "Best skin fade I've ever had. Marco is a true artist — the shop feels premium end to end." },
      { id: "r2", author: "Daniel K.", rating: 5, text: "Booking was seamless and Alex nailed the crop. I'm never going anywhere else." },
      { id: "r3", author: "Ryan T.", rating: 5, text: "The hot-towel shave alone is worth it. Style Hub sets the bar for what a barbershop should be." },
    ],
    offers: [
      { id: "o1", title: "First-Cut 20% Off", description: "New clients get 20% off their first appointment.", code: "FIRSTCUT20" },
      { id: "o2", title: "Weekday Combo", description: "Hair + Beard combo, only on Tue–Thu.", code: "COMBO10" },
    ],
    bookings: [],
    favorites: [],
    users: [],
  };
})();
