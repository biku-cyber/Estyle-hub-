# Style Hub — Premium Men's Salon

Production-ready static site (pure HTML/CSS/JS) for a men's salon and barbershop, with dynamic content loaded from Firebase Firestore, an admin panel, favorites, booking, PWA, dark/light theme, and premium animations.

## Structure

```
public/
├── home.html            # Homepage (hero, trending, popular, reviews)
├── gallery.html         # Haircuts gallery with filters & search
├── services.html        # Services + pricing + barbers
├── booking.html         # Appointment booking with validation
├── favorites.html       # Saved styles (localStorage + Firestore mirror)
├── contact.html         # Phone, WhatsApp, hours, map placeholder
├── about.html           # Story, mission, vision
├── 404.html             # Not-found page
├── admin/
│   ├── login.html
│   └── index.html       # Dashboard w/ CRUD for every collection
├── css/
│   ├── style.css
│   ├── animations.css
│   └── responsive.css
├── js/
│   ├── firebase.js      # Firebase bridge + demo fallback
│   ├── main.js          # Nav, theme, toasts, favorites, reveal
│   ├── layout.js        # Shared nav/footer injection
│   ├── gallery.js
│   ├── booking.js
│   ├── favorites.js
│   └── admin.js
├── firebase-config.example.js
├── manifest.json
├── sw.js                # Offline service worker (PWA)
└── assets/
    └── logo.svg
```

## Setup

1. Copy `firebase-config.example.js` to `firebase-config.js` and replace with your real Firebase project values.
2. Enable Firestore + Auth (email/password) in your Firebase console.
3. Create the following collections (they will be created on first write, but you can seed them from the admin panel): `users`, `haircuts`, `services`, `bookings`, `favorites`, `reviews`, `barbers`, `settings`, `offers`.
4. Visit `/admin/login.html` to manage content.

Until you add a real Firebase config, the site runs on built-in demo data so you can preview and demo it immediately.

## Notes

- The TanStack `/` route redirects to `/home.html` (the project scaffold owns SSR at `/`; the static site lives under `/public`).
- Icons are SVG-only; no image URLs are embedded.
- All editable content (haircuts, services, hours, contact info, reviews, offers) is loaded from Firestore and edited via the admin panel.
