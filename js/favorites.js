/**
 * Style Hub — Favorites page.
 * Reads liked haircut IDs from localStorage and renders full cards.
 */
(function () {
  function svgHeart() {
    return `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }
  async function init() {
    const grid = document.getElementById("favGrid");
    if (!grid) return;
    grid.innerHTML = `<div class="skeleton skel-card"></div>`.repeat(4);
    await window.StyleHub.init();
    const all = await window.StyleHub.list("haircuts");
    const ids = window.Favorites.list();
    const list = all.filter((h) => ids.includes(h.id));
    if (!list.length) {
      grid.innerHTML = `
        <div class="center" style="grid-column: 1/-1; padding: 4rem 1rem;">
          <div class="animate-float" style="font-size: 3rem; margin-bottom: 1rem;">💛</div>
          <h3>No favorites yet</h3>
          <p class="text-muted mt-2">Tap the heart on any haircut to save it here.</p>
          <a href="/gallery.html" class="btn btn-primary mt-4">Explore haircuts</a>
        </div>`;
      return;
    }
    grid.innerHTML = list.map((h) => `
      <article class="card reveal" data-id="${h.id}">
        <div class="card-media" style="background-image: linear-gradient(135deg, rgba(245,179,1,0.15), transparent), linear-gradient(45deg, #1a1a1a, #0a0a0a);">
          <button class="fav-btn active" data-fav="${h.id}" aria-label="Remove from favorites">${svgHeart()}</button>
        </div>
        <div class="card-body">
          <span class="chip">${h.category}</span>
          <h3 class="card-title" style="margin-top:.6rem">${h.name}</h3>
          <div class="card-meta"><span>${h.time} min</span><span class="card-price">$${h.price}</span></div>
          <a href="/booking.html?style=${encodeURIComponent(h.name)}" class="btn btn-primary btn-sm btn-block">Book This Style</a>
        </div>
      </article>`).join("");
    requestAnimationFrame(() => grid.querySelectorAll(".reveal").forEach((e) => e.classList.add("in")));

    grid.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (!fav) return;
      window.Favorites.toggle(fav.dataset.fav);
      window.toast("Removed from favorites", "info", 1500);
      init();
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
