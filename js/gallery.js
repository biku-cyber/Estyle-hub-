/**
 * Style Hub — Gallery / Haircuts page logic.
 * Renders cards, handles category pills, search, sort, price/time filters,
 * and favorite toggling.
 */
(function () {
  const state = {
    all: [],
    filtered: [],
    category: "All",
    search: "",
    sort: "featured",
    maxPrice: 100,
    maxTime: 120,
  };

  const CATEGORIES = [
    "All", "Low Fade", "Mid Fade", "High Fade", "Skin Fade", "Taper Fade",
    "Crew Cut", "Buzz Cut", "French Crop", "Pompadour", "Quiff",
    "Undercut", "Side Part", "Textured Crop", "Curly Hair", "Beard Styles",
  ];

  function svgHeart(filled) {
    return `<svg viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }

  function cardFor(h) {
    const fav = window.Favorites.has(h.id);
    return `
      <article class="card reveal" data-id="${h.id}">
        <div class="card-media" style="background-image: linear-gradient(135deg, rgba(245,179,1,0.15), transparent), linear-gradient(45deg, #1a1a1a, #0a0a0a);">
          <button class="fav-btn ${fav ? "active" : ""}" data-fav="${h.id}" aria-label="Save to favorites">
            ${svgHeart(fav)}
          </button>
        </div>
        <div class="card-body">
          <span class="chip">${h.category}</span>
          <h3 class="card-title" style="margin-top:.6rem">${h.name}</h3>
          <div class="card-meta">
            <span>${h.time} min</span>
            <span class="card-price">$${h.price}</span>
          </div>
          <div class="card-actions">
            <a href="/booking.html?style=${encodeURIComponent(h.name)}" class="btn btn-primary btn-sm btn-block">Book This Style</a>
          </div>
        </div>
      </article>`;
  }

  function skeletonGrid(n = 8) {
    return Array.from({ length: n }).map(() => `<div class="skeleton skel-card"></div>`).join("");
  }

  function render() {
    const grid = document.getElementById("cutsGrid");
    if (!grid) return;
    let list = state.all.slice();
    if (state.category !== "All") list = list.filter((h) => h.category === state.category);
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q) || h.category.toLowerCase().includes(q));
    }
    list = list.filter((h) => h.price <= state.maxPrice && h.time <= state.maxTime);
    switch (state.sort) {
      case "price-asc": list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "time-asc": list.sort((a, b) => a.time - b.time); break;
      case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    state.filtered = list;
    grid.innerHTML = list.length
      ? list.map(cardFor).join("")
      : `<p class="text-muted center" style="grid-column: 1/-1; padding: 3rem;">No haircuts match your filters.</p>`;
    // trigger reveal
    requestAnimationFrame(() => grid.querySelectorAll(".reveal").forEach((e) => e.classList.add("in")));
    const count = document.getElementById("resultCount");
    if (count) count.textContent = `${list.length} style${list.length === 1 ? "" : "s"}`;
  }

  function renderCategories() {
    const wrap = document.getElementById("catPills");
    if (!wrap) return;
    wrap.innerHTML = CATEGORIES.map((c) =>
      `<button class="pill ${c === state.category ? "active" : ""}" data-cat="${c}">${c}</button>`
    ).join("");
  }

  function bind() {
    document.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-cat]");
      if (pill) {
        state.category = pill.dataset.cat;
        renderCategories();
        render();
      }
      const fav = e.target.closest("[data-fav]");
      if (fav) {
        (async () => {
          const user = await window.Auth.requireLogin(
            "Sign in to save your favorite styles — they'll follow you across devices."
          );
          if (!user) return;
          const active = window.Favorites.toggle(fav.dataset.fav);
          fav.classList.toggle("active", active);
          fav.innerHTML = svgHeart(active);
          window.toast(active ? "Added to favorites" : "Removed from favorites", "success", 1800);
        })();
      }

    });

    const search = document.getElementById("searchInput");
    if (search) search.addEventListener("input", (e) => { state.search = e.target.value; render(); });

    const sort = document.getElementById("sortSelect");
    if (sort) sort.addEventListener("change", (e) => { state.sort = e.target.value; render(); });

    const price = document.getElementById("priceFilter");
    if (price) price.addEventListener("change", (e) => { state.maxPrice = +e.target.value || 100; render(); });

    const time = document.getElementById("timeFilter");
    if (time) time.addEventListener("change", (e) => { state.maxTime = +e.target.value || 120; render(); });
  }

  async function init() {
    const grid = document.getElementById("cutsGrid");
    if (!grid) return;
    grid.innerHTML = skeletonGrid(8);
    renderCategories();
    bind();
    await window.StyleHub.init();
    state.all = await window.StyleHub.list("haircuts");
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.__GalleryCard = cardFor;
})();
