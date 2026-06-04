# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this repository is

This is **not a software project** — it is a planning workspace for a family
holiday to **Lake Garda, Italy** (Del Garda Village & Camping, Peschiera del
Garda) in summer 2026. It contains:

1. **Markdown source documents** — the research and planning of record.
2. **A static HTML website** — a presentable, hand-maintained rendering of the
   confirmed plan.

There is no build system, package manager, framework, test suite, or CI for the
content. The HTML is plain static files; open them directly in a browser. Do not
add tooling (npm, bundlers, static-site generators) unless explicitly asked.

## Layout

### Markdown documents (source of truth for planning)
- `README.md` — repo intro, high-level trip overview, and the planning to-do list.
- `itinerary.md` — **the authoritative confirmed plan**: dates, booking details,
  costs, day-by-day schedule, logistics. The most detailed document.
- `flights.md` — flight + airport-transfer research (Dublin → Verona).
- `agents.md` — a persona/prompt brief defining how a "personal travel agent"
  assistant should make recommendations (see *Travel-agent persona* below).

### Static website (one shared stylesheet, hand-written pages)
- `index.html` — home page (overview + key dates table).
- `booking.html`, `logistics.html`, `resort.html`, `activities.html`,
  `dining.html`, `food.html`, `etiquette.html`, `budget.html` — section pages.
- `style.css` — the single shared stylesheet for every page.

The HTML site is effectively a presentation layer derived from `itinerary.md`
and the research docs.

## Key trip facts (keep these consistent across all files)

- **Base:** Del Garda Village & Camping, Via Marzan 92, 37019 Peschiera del
  Garda VR, Italy. Mobile Home "Clivia Medium (4+1)".
- **Party:** 2 adults + 3 children — Rachel (b. Apr 2017, ~9) and twins Jessica
  & Rebecca (b. Jun 2019, ~7).
- **Confirmed dates:** Sat 27 June 2026 → Tue 7 July 2026 (**10 nights**).
- **Booking reference:** `2026011245404197`.
- **Route:** Dublin (DUB) → Verona (VRN) preferred; Bergamo (BGY) / Venice (VCE)
  as fallbacks. Airport transfer via private minivan (e.g. Ziptransfers, ~€150
  return).

> **Known inconsistency:** `README.md` still lists older draft dates (June 27 –
> July 5, "9 Days, 8 Nights"). `itinerary.md` and the HTML site carry the
> **confirmed** "10 nights / depart July 7" figures and win on any conflict. If
> you touch dates/duration, reconcile `README.md` too.

## Conventions

### Editing the website
- **Navigation must stay in sync.** Every page repeats the same `<nav>` block
  linking all nine pages (Home, Booking, Logistics, Resort, Activities, Dining,
  Food & Drink, Etiquette, Budget). When you **add, remove, or rename a page,
  update the `<nav>` in every other HTML file** — there is no shared template or
  include.
- **Page skeleton:** each page is a full HTML document with `<head>` linking
  `style.css`, a `<header>` whose inline `background-image` is a Wikimedia
  Commons URL, the shared `<nav>` (with `class="active"` on the current page),
  a `<main>`, and a `<footer>`.
- **Styling lives only in `style.css`** (CSS custom properties in `:root`, e.g.
  `--primary-color: #0077be`). Reuse existing classes (`.map-link`, tables, etc.)
  rather than adding inline styles, except for the per-page header background
  image which is intentionally inline.
- Keep section headings numbered consistently with their titles (e.g.
  "4. Activities Guide").

### Editing content
- Recommendations are **family-first**: note child suitability, and for nearby
  spots include walking and cycling times from the resort.
- **Link every named place** to a Google Maps link in parentheses after the
  bolded place name (per `agents.md`).
- Currency is **euro (€)**; dates are written in long form (e.g. "Tue 7 July 2026").
- Flag costs/times that still need user verification rather than presenting
  estimates as confirmed.
- When the plan changes, update `itinerary.md` first, then mirror the change
  into the relevant HTML page(s).

### Travel-agent persona (`agents.md`)
When asked to *suggest activities, dining, or daily plans*, follow `agents.md`:
categorize as **"The Local Loop"** (walk/cycle distance), **"Lake Adventures"**
(ferry/drive day trips), or **"Dining & Gelato"**; bold place names; add Google
Maps links and walking/cycling times; and close each day with a
**"Logistics Summary"**. Tailor to the children's ages.

## Git workflow

- Default branch is `master`. Changes land via **pull requests** (history shows
  squash/merge PRs with descriptive titles).
- Commit messages are short and descriptive (e.g. "Update flights.md with
  explicit Jan 2026 schedule data").
- Do **not** open a pull request unless explicitly asked.

## Quick checklist before finishing a change
- [ ] If dates/booking/party facts changed, are they consistent across
      `itinerary.md`, the HTML site, and `README.md`?
- [ ] If you added/removed/renamed an HTML page, is the `<nav>` updated in
      **all** pages, with `active` set correctly?
- [ ] New place mentions have Google Maps links (and walk/cycle times if local)?
- [ ] Styling reuses `style.css` rather than introducing inline CSS?
