# Lunar Ice Watch

A browser-based prototype for screening candidate lunar south-pole sites for
water ice, using simulated thermal, radar and terrain "evidence". Everything
runs client-side (no backend/server) — data lives in JS files and the
browser's `localStorage`.

## Running it

No build step. Open `index.html` in a browser, or serve the folder locally:

```
npx serve .
```

## Pages -> what they do

| File             | What it is                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `index.html`     | Homepage: hero banner with the interactive 3D moon, "Mission Briefing" info section |
| `login.html`     | Demo login form (any non-empty username is accepted)                       |
| `dashboard.html` | Table of every candidate site, with stat tiles and filter chips             |
| `site.html`      | Detail view for one site: radar metrics, thermal/flag gates, hazard gauge, final classification |
| `map.html`       | Canvas map plotting every site around the base station, with hazard shading |
| `traverse.html`  | Animates a simulated rover route from the base station to a chosen site    |
| `upload.html`    | "Uploads" a new observation: fakes an analysis pipeline and adds a randomly generated site |
| `info.html`      | Redirect stub -> `index.html#about`                                        |

Every inner page shares the same top navbar (`Home / Dashboard / Upload / Map
/ Traverse / Logout`) and the same background (starfield + ambient moon).

## Folder structure

```
css/
  tokens.css     design tokens (colors, spacing, fonts) — the single source of truth
  style.css      main stylesheet, shared by every page
  premium.css    icon/glass/cursor polish layered on top of style.css
  starfield.css  the animated background star layers

js/
  data.js        the site "database" (fake data) + helper functions read by every page
  ui.js          shared helpers: navbar highlighting, toasts, moonlight toggle
  nav.js         logout()
  starfield.js   injects and animates the background stars
  cursor.js      the custom glowing cursor + sparkle trail
  moon3d.js      the interactive 3D moon in the homepage hero (three.js)
  dashboard.js   builds the Dashboard page's stats/chips/table
  site.js        fills in the Site Detail page from the URL's ?id=
  map.js         draws the Map page's canvas and handles clicks/hover
  traverse.js    builds and animates the Traverse page's rover route
  upload.js      the Upload page's dropzone + fake analysis pipeline
  vendor/three/  third-party three.js library (not part of this project's own code)

img/
  moon-4k.png    the ambient corner moon image shown behind every page
```

## How a candidate site is classified

`js/data.js` seeds 6 example sites; `js/upload.js` can generate more. Each
site is classified from three signals:

- **Thermal gate** (pass/fail) — is the site cold enough?
- **Alt-explanation flag** — could terrain/ejecta explain the radar signal instead of ice?
- **Radar CPR** and **terrain hazard** — how strong is the signal, how risky is the terrain?

Failing the thermal gate always means `ICE-UNLIKELY`. Otherwise a flagged
site is `INCONCLUSIVE`, and CPR strength decides `ICE-SUPPORTED-HIGH` vs
`ICE-SUPPORTED-MODERATE` vs `INCONCLUSIVE`. The same rules live in
`classifyNewSite()` in `js/upload.js` for newly generated sites.

**Prototype disclaimer:** all data, classifications and rover traverses are
simulated locally for demonstration — this is not real lunar science.

## Code comments

Every HTML/CSS/JS file has inline comments marking which part of the code
drives which part of the website (e.g. `<!-- DASHBOARD: filter chips -->` or
`/* ---- SITE DETAIL: hazard gauge ---- */`), so you can trace a visible
element back to the exact code that builds it.
