# What changed: adding a backend and a database

This document explains the work done on the `backend-mongodb` branch (Pull Request #4), in plain language.

## 1. The starting point

Lunar Ice Watch began as a **front-end only** prototype: HTML, CSS and JavaScript running entirely in the browser.

| Part | How it worked before |
|---|---|
| Site data | Six sites typed directly into `js/data.js` |
| "Uploading" a site | The app **invented random numbers** and ignored the file you dropped. The result was saved in the browser's `localStorage`, so only that one browser ever saw it |
| Classification (ice likely / unlikely) | Decided by JavaScript in the browser |
| Login | Accepted any non-empty username (demo only) |

The main weakness: nothing was shared or permanent. Data in one browser was invisible to everyone else, and the "analysis" was fake.

## 2. What we built

```
Browser (the pages)  <-->  Node.js + Express server  <-->  MongoDB database
```

**Why a server in the middle?** A web page cannot safely talk to a database directly, because the database password would be visible to every visitor. The server holds the connection and exposes a small, controlled API.

### 2.1 The database (MongoDB)
- Each site is now a **document** in a MongoDB collection called `sites` (defined with Mongoose in `server/index.js`).
- The six original sites moved from `data.js` into `server/seed.json`. They are loaded into the database automatically the first time the server starts (only if the database is empty).
- **No account or install needed:** by default the server starts an *embedded* MongoDB (the `mongodb-memory-server` package) and keeps the data in the folder `server/.data`, so it survives restarts. If you set the environment variable `MONGODB_URI`, it uses that database instead (for example MongoDB Atlas).

### 2.2 The API (Express server, `server/index.js`)
| Endpoint | What it does |
|---|---|
| `GET /api/sites` | Returns every site from the database |
| `POST /api/sites` | Receives uploaded rows, validates them, classifies them, saves them, and returns the saved sites |

The same server also serves the website files, so everything runs from one command and one address, `http://localhost:3000`.

### 2.3 Real CSV upload (`js/upload.js`)
- The upload page now **reads the file**. It expects a CSV, and there is a "Download template" link showing the format.
- Required columns: `cpr`, `thermalTemp`, `terrainHazard`. Optional: `label, crater, x, y, pv, serd, tRatio, altFlag, boulderCount`.
- The browser parses the CSV and sends the rows to the server. Each row becomes one site.
- Bad input is rejected with a clear message (missing column, non-numeric value, no file chosen).
- The random-number generator was deleted.

### 2.4 Classification moved to the server (`server/classify.js`)
- The rules that decide **ICE-SUPPORTED-HIGH / MODERATE / INCONCLUSIVE / ICE-UNLIKELY** now run on the server.
- **Why:** the browser only sends raw measurements. A user cannot fake a "high confidence" result by editing page code, because the server works out the label itself.
- The rules, in order: thermal gate fails -> unlikely; alternative-explanation flag raised -> inconclusive; CPR >= 1.2 and terrain hazard < 30 -> high; CPR >= 0.9 -> moderate; otherwise inconclusive.
- There is a small test (`npm test`, file `server/classify.test.js`) that checks these rules reproduce the six hand-labelled demo results.

### 2.5 Front-end change (`js/data.js`)
- Instead of a hard-coded array, `data.js` now fetches the list from `/api/sites`. The other pages (dashboard, map, traverse, site detail) needed no changes because they still read the same `siteData` list.
- It uses a synchronous request so existing page scripts keep working unchanged. This is marked in the code as a deliberate shortcut; a more modern approach would be an asynchronous fetch with a loading step on each page.
- If the server isn't running, the pages show a message telling you to run `npm start`.

## 3. Real data added

The six demo sites correspond to real craters near the lunar south pole. Where published sources could be found, we attached them to each site in a `published` field (shown on the site detail page), including the citation:

| Site | Crater | Published annual max temperature |
|---|---|---|
| A1 | Cabeus | 109.8 K |
| A2 | Faustini | 85-95 K |
| A3 | Shoemaker | 70-95 K |
| A4 | Haworth | 60-80 K |
| A6 | Sverdrup | none found (coordinates only) |
| A5 | Amundsen | no data found |

**Be upfront about the limits:** radar values (CPR, Pv, SERD, T-ratio), terrain hazard and boulder counts are still **simulated**. No per-site values for them are published, and we chose not to invent numbers and pass them off as real. The README states what is real versus simulated. Getting real radar and terrain numbers would need processing NASA's raw map files (LRO Mini-RF, Diviner and LOLA), which is a larger future step.

## 4. Security and quality fixes

- **Cross-site scripting (XSS) protection.** Because uploaded text is now shared between users, a malicious site name could run script in another person's browser. An automated security review flagged the map tooltip, which inserted names without escaping. It now escapes them. We tested this by uploading a site named with an HTML `<img onerror=...>` payload: it showed as plain text on the dashboard, tooltip and traverse list, and nothing executed.
- **Server files are not publicly readable.** The static file server blocks `/server`, `node_modules`, `.env` and `package*` paths (they return 404), so database settings and server code can't be downloaded.
- **Input validation on the server:** the row count is capped at 500, text is length-limited, and numeric fields must actually be numbers.
- **Unit mislabel fixed:** the site page said "-230 K", but the values are in degrees Celsius. It now reads "-230 °C (simulated)".
- `.gitignore` now excludes `node_modules`, `server/.data` and `.env`.

## 5. How we tested it

- `npm test`: the classification rules match all six demo sites.
- API checks: the server returns 6 seeded sites, a valid upload is stored and classified, a bad row returns HTTP 400, `/server/*` returns 404, and data was still there after restarting the server.
- Browser checks (Chrome): dashboard counts and filters, site detail page, map hover, traverse page, upload success and the three error cases, all eight pages load, and no console errors.
- Not tested: the native file-browse dialog and drag-and-drop, which can't be driven automatically. The upload logic itself was exercised by supplying the file in code.

## 6. How to run it

```
npm install
npm start        # open http://localhost:3000
npm test
```

## 7. Known limitations (good to mention honestly)

- Login is still the demo version (any username works). Real authentication is the natural next step.
- Radar and terrain metrics are simulated, so the classifications illustrate how the screening method works. They are **not scientific conclusions** about those craters.
- The classification thresholds (such as CPR >= 1.2) come from the original prototype and have not been calibrated against real data. The thermal gate of -190 °C is also looser than real cold-trap temperatures (roughly -213 to -163 °C).
- The CSV parser is intentionally simple: it does not handle commas inside quoted fields.
- Anyone who can reach the server can upload sites, since there is no real login yet.

## 8. Files added or changed

| File | Change |
|---|---|
| `package.json`, `package-lock.json` | New: dependencies (express, mongoose, mongodb-memory-server) and scripts |
| `server/index.js` | New: Express server, MongoDB model, API routes, static file serving |
| `server/classify.js` | New: server-side classification and row validation |
| `server/classify.test.js` | New: test for the classification rules |
| `server/seed.json` | New: the six demo sites plus published real-world data |
| `js/data.js` | Loads sites from the API instead of a hard-coded array and `localStorage` |
| `js/upload.js` | Reads CSV, sends rows to the server, template download |
| `upload.html` | Accepts `.csv`, adds the template link |
| `js/map.js` | Escapes text in the hover tooltip |
| `js/site.js` | Shows the published data line; fixes the temperature unit |
| `README.md`, `.gitignore` | Updated run instructions and notes on real vs simulated data |
