# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this repository is

This is **not a software project** — it is the planning workspace for a family
holiday to **Lake Garda, Italy** (Del Garda Village & Camping, Peschiera del
Garda) in summer 2026.

**The static HTML website is now the focus and the single source of truth.** It
is the surface the family actually reads. The goal is to keep these pages clean,
accurate, and **easy for the trip owner and his wife to access — most likely by
hosting them on GitHub (GitHub Pages)**. Keep that hosting goal in mind: pages
must work as plain static files served from the repo root.

The original markdown planning/research docs have been **archived in
`backup-markdowns/`**. They are historical reference only — **do not treat them
as current and do not maintain them**. When the plan changes, edit the **HTML**.

There is no build system, package manager, framework, test suite, or CI. The
HTML is plain static files; open them directly in a browser. Do not add tooling
(npm, bundlers, static-site generators) unless explicitly asked — it would work
against the "simple, GitHub-Pages-hostable" goal.

## Layout

### Active site (root — this is what you edit)
- `index.html` — home page (overview + key dates table). **This is the GitHub
  Pages landing page.**
- Section pages (24 pages total, all sharing the nav): `itinerary.html`,
  `booking.html`, `logistics.html`, `essentials.html`, `resort.html`,
  `activities.html`, `gardaland.html`, `canevaworld.html`, `boats.html`,
  `daytrips.html`, `venice.html`, `towns.html`, `nature.html`, `beaches.html`, `markets.html`,
  `bikes.html`, `running.html`, `dining.html`, `food.html`, `etiquette.html`,
  `phrases.html`, `packing.html`, `budget.html`.
- `style.css` — the single shared stylesheet for every page.
- `theme.js` — shared light/dark toggle + mobile nav drawer behaviour.
- PWA layer (the site is an installable progressive web app):
  `manifest.json` (app metadata), `sw.js` (offline service worker that
  precaches every page — **bump its `CACHE_VERSION` whenever site content
  changes**, or installed apps keep serving stale pages), `pwa.js` (service
  worker registration + nav "Install app" button, injected only when the
  browser reports the app as installable), and `icons/` (app icons; `icon.svg`
  is the source, PNGs are rendered from it). **When you add or remove a page,
  also update the `PRECACHE` list in `sw.js`.**
- `CLAUDE.md` — this file (stays at root).

### Archive (reference only — not maintained)
- `backup-markdowns/` — the former source docs: `README.md`, `itinerary.md`
  (the old master plan), `flights.md` (flight + transfer research), `agents.md`
  (a "personal travel agent" persona brief). The HTML mirrors the useful content
  of these; treat the HTML as authoritative if they ever disagree.

## Key trip facts (keep these consistent across all HTML pages)

- **Base:** Del Garda Village & Camping, Via Marzan 92, 37019 Peschiera del
  Garda VR, Italy. Mobile Home "Clivia Medium (4+1)". Booking ref
  `2026011245404197`.
- **Party:** 2 adults + 3 children — Rachel (b. Apr 2017, ~9) and twins Jessica
  & Rebecca (b. Jun 2019, ~7).
- **Dates:** Sat 27 June 2026 → Tue 7 July 2026 (**10 nights**).
- **Flights (BOOKED):** Aer Lingus both ways. Out Sat 27 June, depart Dublin
  (DUB) **16:10**, arrive Verona (VRN) ~19:45. Back Tue 7 July, depart VRN
  **19:15**, arrive DUB ~20:50. Total fare ~€2,800. Airport transfer to the
  resort via private minivan (e.g. Ziptransfers, ~€150 return).

## Conventions

### Editing the website
- **Navigation must stay in sync.** Every page repeats the same `<nav id="site-nav">`
  block linking all 24 pages. The links are organised into four labelled
  `<div class="nav-group">` clusters (each led by a `<span class="nav-group-label">`):
  **Plan** (Home, Itinerary, Booking, Logistics, Essentials, Packing, Budget),
  **Resort & Active** (Resort, Beaches, Bike Hire, Running),
  **Days Out** (Activities, Gardaland, CanevaWorld, Boat Hire, Day Trips, Venice Day,
  Towns, Nature & Parks, Markets), and
  **Food & Culture** (Dining, Food & Drink, Etiquette, Phrases). On desktop the
  groups show as separated pill clusters; in the mobile drawer each label becomes
  a section heading. When you **add, remove, or rename a page, update the `<nav>`
  in every other HTML file** — there is no shared template or include. The nav
  block is identical across all pages except for the single `class="active"` link,
  so the easiest safe way to re-sync (or to re-group) after a change is a small
  find/replace script over every `*.html` file.
- **Page skeleton:** each page is a full HTML document with `<head>` linking
  `style.css` (plus the inline no-flash theme script and `theme.js`), a
  `<header class="site-header header-NAME">` (the header background is a **CSS
  gradient** defined by the `.header-NAME` class in `style.css` — there are no
  external/inline header images), the shared `<nav id="site-nav">` (with
  `class="active"` on the current page) followed by `<div class="nav-backdrop" hidden>`,
  a `<main>`, and a `<footer>`. When you add a page, add a matching
  `.header-NAME` gradient in `style.css`.
- **Keep links relative** (`style.css`, `booking.html`, …) so the site works
  unchanged when served from GitHub Pages.
- **Styling lives only in `style.css`** (CSS custom properties in `:root`, e.g.
  `--primary-color: #0077be`, plus a `[data-theme="dark"]` set for dark mode).
  Reuse existing classes (`.map-link`, tables, etc.) rather than adding inline
  styles. The stylesheet is already mobile-friendly (`@media (max-width: 640px)`,
  which turns the nav into an off-canvas drawer) — preserve that, since the family
  will read on phones.
- Keep section headings numbered consistently with their titles (e.g.
  "4. Activities Guide").

### Editing content
- Recommendations are **family-first**: note child suitability, and for nearby
  spots include walking and cycling times from the resort.
- **Link every named place** to a Google Maps link (use the `.map-link` style)
  after the bolded place name.
- Currency is **euro (€)**; dates in long form (e.g. "Tue 7 July 2026").
- Flag costs/times that still need verification rather than presenting estimates
  as confirmed. Where useful, date a figure (e.g. "Verified June 2026").

## Git workflow

- Default branch is `master`. Changes land via **pull requests** (history shows
  squash/merge PRs with descriptive titles).
- Commit messages are short and descriptive.
- Do **not** open a pull request unless explicitly asked.
- If asked to set up hosting, the intended path is **GitHub Pages** serving the
  repo root (`index.html`).

## Quick checklist before finishing a change
- [ ] Did you edit the **HTML** (not the archived markdown)?
- [ ] If dates/booking/party/flight facts changed, are they consistent across
      **all** HTML pages (home, logistics, budget especially)?
- [ ] If you added/removed/renamed a page, is the `<nav>` updated in **all**
      pages, with `active` set correctly?
- [ ] Are links relative and styling reusing `style.css` (no stray inline CSS)?
- [ ] New place mentions have Google Maps links (and walk/cycle times if local)?
