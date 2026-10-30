# Lunar Ice Watch: what we built and why (explained simply)

A guide for explaining the project to a teacher. Read sections 1-3 first; the rest is detail you can open if asked.

---

## 1. The 30-second summary

**Lunar Ice Watch** is a website that helps decide where water ice might be on the Moon's south pole, and how a rover could drive there.

At the start it was only a **front-end mock-up**: all numbers were typed into the code or made up by a random-number generator, and nothing was saved anywhere.

We turned it into a **real system with five layers**:

| Layer | What it is | Why it matters |
|---|---|---|
| 1. Website | HTML, CSS and JavaScript pages | What the user sees |
| 2. API | Small server functions (Node.js, hosted on Vercel) | The only thing allowed to touch the database |
| 3. Database | MongoDB (cloud, "Atlas") | Stores sites, uploads, routes so everyone sees the same data |
| 4. File storage | Vercel Blob | Stores the uploaded CSV files themselves |
| 5. Data pipeline | Python program that reads real NASA data | Replaces invented numbers with measured ones |

On top of that we added a **screening score** (how ice-friendly a site looks) and a **route planner** (A* path-finding over real terrain slope).

> **Honest framing for your teacher:** this is a *screening* tool, not a scientific proof of ice. Every number on the site says where it came from (real measurement, published paper, or still simulated).

---

## 2. The big picture (how the parts talk)

```
                           ┌───────────────────────────┐
   NASA data (Diviner,     │  Python pipeline (offline) │
   LOLA) ───────────────►  │  computes real features    │
                           └─────────────┬─────────────┘
                                         │ writes
                                         ▼
 ┌──────────┐  fetch  ┌──────────┐  read/write  ┌──────────────┐
 │ Browser  │ ◄─────► │ API      │ ◄──────────► │ MongoDB      │
 │ (pages)  │  JSON   │ (Vercel) │              │ (Atlas)      │
 └──────────┘         └────┬─────┘              └──────────────┘
                           │ stores uploaded CSV files
                           ▼
                      Vercel Blob
```

**Why a server between the page and the database?** A web page can't safely talk to a database directly: the database password would be visible to every visitor. The API holds the password and only offers a few safe actions.

**Why does the Python pipeline run offline (not on the website)?** The NASA map files are hundreds of megabytes. We process them once on a computer and save the small results to the database. The website only reads the results.

---

## 3. The database (the part teachers usually ask about)

We use **MongoDB**, a *document database*. Instead of tables with rows and columns (like Excel or SQL), it stores flexible JSON-like **documents** in **collections**.

**Why MongoDB and not SQL?**
- Every site has a *different set of known measurements*. Some have a radar value, some don't. Documents handle "this field is missing" naturally (we store `null`).
- It has built-in **geospatial queries**: "find sites within 200 km of this point".
- It's free to start (Atlas M0 cluster) and works well with serverless hosting.

### The 4 collections

| Collection | Holds | One document is... |
|---|---|---|
| `sites` | Every candidate ice site (7 real craters + any uploaded) | One place on the Moon |
| `observations` | One record per uploaded CSV row | A measurement event tied to a site |
| `routes` | Planned rover paths | One path from base to a site |
| `rateLimits` | Counters that stop spam | One counter per client per hour (auto-deleted) |

### What a `sites` document looks like (simplified)

```json
{
  "_id": "s3",
  "name": "Shoemaker",
  "region": "Shoemaker crater floor",
  "location": { "type": "Point", "coordinates": [44.9, -88.1] },   // [longitude, latitude]
  "features": {
    "maxTempK": 76.9,          // hottest it ever gets, in kelvin   (REAL, from Diviner)
    "meanTempK": 55.0,
    "pctBelow110K": 100,       // % of area cold enough to trap ice (REAL)
    "slopeDeg": 9.1,           // typical slope                      (REAL, from LOLA)
    "roughness": 1.7,
    "cpr": null,               // radar value                        (not available yet)
    "illumFraction": null,
    "neutronSuppression": null
  },
  "featureProvenance": { "maxTempK": "raster", "slopeDeg": "raster", ... },
  "prediction": { "label": "...", "modelVersion": "rules-v0", ... },
  "evidence": [ { "source": "...", "citation": "...", "provenance": "published" } ],
  "provenance": "mixed"        // simulated | published | raster | mixed
}
```

Key ideas to mention:
- **`location` is GeoJSON with a `2dsphere` index.** That index is what makes "sites near this point" fast and correct. We use the **Moon's radius (1737.4 km)**, not Earth's, in the distance maths. (MongoDB's default `$near` assumes Earth in metres, which would be wrong here.)
- **Provenance** = "where did this number come from?" Every feature has a tag:
  - `simulated`: made up / placeholder from the old demo
  - `published`: taken from a scientific paper (with citation)
  - `raster`: computed by us from real NASA map data
  - `mixed`: some real, some still simulated
- **`null` means "we don't have it"**. We never fill gaps with invented numbers.

### Seeding
`npm run seed` loads the 6 original demo sites into MongoDB and creates the indexes (geospatial, creation time, auto-expiry for rate-limit counters). It is safe to re-run.

### Why uploaded CSV files go to Blob, not the database
A database is for small structured records. The raw file goes to **Vercel Blob** (file storage); MongoDB only keeps the file's **URL** plus the extracted rows. This keeps the database small and fast.

---

## 4. The API (what the server offers)

All are Vercel serverless functions in the `api/` folder. They share one cached database connection (so each request doesn't reconnect).

| Endpoint | Does |
|---|---|
| `GET /api/sites` | All sites (plus the screening score) |
| `GET /api/sites/<id>` | One site |
| `GET /api/sites/near?lat=..&lon=..&km=..` | Sites within a distance, nearest first |
| `POST /api/upload` | Validate a CSV, classify each row, store file + records |
| `GET /api/routes?siteId=..` | Saved routes for a site |
| `POST /api/routes` | Save a route |

### Safety measures (good to mention)
Because anyone can use the site without logging in, the endpoints protect themselves:
- Uploads must be `.csv`, max **1 MB** and **500 rows**.
- **Rate limit**: 20 uploads / 60 route saves per client per hour. It uses **one atomic database increment** so ten parallel requests can't sneak past the limit.
- The client's IP is stored only as a **keyed hash (HMAC)**, never in readable form, and never on the uploaded records.
- Text from uploads is escaped before it's shown on a page (prevents XSS, i.e. injected scripts).
- Classification is computed **on the server**, so a user can't fake a "high confidence" result by editing page code.

---

## 5. Timeline: everything we did

### Part A: earlier work (Sept-Oct 20)

**Before:** pure front-end. Sites hard-coded in `js/data.js`; "upload" ignored the file and generated random numbers; data lived in each browser's `localStorage`; login accepted any username.

**Backend branch (Oct 20)**:
- First backend: Express + MongoDB, `/api/sites`, real CSV upload, classification moved to the server, 6 demo sites loaded from `seed.json`.
- Real craters: the demo sites were matched to real south-pole craters with published citations.
- Fixes: HTML-escaping in the map tooltip, temperatures shown in °C.
- Documentation: `CHANGES.md`.

### Part B: this session (Oct 29-30), in five phases

| Phase | What | Result |
|---|---|---|
| **Cleanup** | Removed the fake demo login page and logout links | No pretend authentication |
| **1. MongoDB on Vercel** | Replaced the Express server (can't run on Vercel) with serverless `/api` functions on the native MongoDB driver; new `sites` schema; seed script; pages now load data asynchronously with a loading banner and a Retry button on error; provenance badges | The site now runs on Vercel + Atlas |
| **2. Uploads** | Server-side validation; files to Blob; observations stored. We built a full sign-in (bcrypt + JWT), then **removed it on request** (mini-project). Replaced by size limits + an atomic rate limiter. Found and fixed bugs (page posting to a deleted endpoint; two uploads in the same millisecond getting the same id) | Safe open uploads |
| **3. Real data pipeline** | Python program that downloads real **LRO Diviner** (temperature) and **LOLA** (elevation) data and computes, per crater: max/mean temperature, % area below 110 K, slope, roughness. Added Shackleton as a 7th site. Downloads use HTTPS and are checked against fixed SHA-256 fingerprints | Real numbers replace invented ones |
| **4. Screening score** | A 0-1 score from the measured features, shown on each site page | A transparent ranking, not a black box |
| **5. Traverse planner** | A* path-finding over the real LOLA slope map from a base to each site; the traverse page draws the route, waypoints, and animates the rover | Real routes instead of a straight line |

Afterwards we:
- Had the pipeline and the whole app **reviewed twice** by a separate reviewer; fixed what it found (e.g. don't overwrite published coordinates, null out stale values, hide internal fields, XSS hardening on the traverse page).
- **Tested in a real browser** against a throwaway in-memory MongoDB: pages load, score and route display, the rover animation runs, no JavaScript errors.
- **Replaced guessed thresholds with sourced ones** (slope limits from NASA's VIPER rover figures; cold-trap temperature from the literature).

---

## 6. The real data and the real formulas

### Data sources (all real NASA data)
- **LRO Diviner**: the Moon's surface temperature, polar seasonal maps (Williams et al. 2019).
- **LRO LOLA**: laser-altimeter elevation map at 80 m per pixel for the south pole.
- Mini-RF radar (CPR), LEND neutron data and illumination maps need manual download, so those fields stay `null`.

### Formulas that are standard science / maths
- **Slope from elevation**: `slope = arctan( sqrt( (dz/dx)² + (dz/dy)² ) )`.
- **Moon polar stereographic projection**: turns latitude/longitude near the pole into flat x/y metres (with the Moon's radius, not Earth's).
- **Great-circle distance** (haversine) on a sphere of radius 1737.4 km.
- **Cold trap = 110 K** (about -163 °C). Below this, water ice can survive for billions of years.
- **A\* search**: finds the cheapest path on a grid; it is guaranteed optimal because its distance estimate never overestimates.

### Our own choices (marked as such in the code)
- **Screening score** (`score-v2`): the plain average of whichever terms we have data for:
  - % area below 110 K (used as-is)
  - max temperature: 1 at 110 K or colder, falling to 0 at 125 K (extrapolated from published sublimation rates: roughly 10× faster per 5 K)
  - radar CPR: 0 at ≤ 1 (a dry surface), rising to 1 at 2
  - neutron / illumination: only if a map is provided
  - **All weights are equal** because no source supports unequal ones. Slope is **not** in the score; it says nothing about ice (the route planner uses it instead).
  - Missing inputs are skipped, and a **coverage** number shows how many terms were used. **It's not a trained AI model**: there is no labelled data to train on.
- **Route planner**:
  - Slope tiers from NASA's VIPER rover figures: up to **15°** = Easy, up to **25°** = Moderate, up to **30°** = Hard (slipping likely), steeper = impassable.
  - Step cost = `distance × (1 + (slope/15)²)`, plus a 10× penalty above 15°. (The penalty size is our choice.)
  - Planning cells are 320 m using the *steepest* slope in each block (conservative).

---

## 7. Results (current numbers)

| Crater | Max temp | % area < 110 K | Screening score | Route |
|---|---|---|---|---|
| Shoemaker | 77 K | 100 % | 1.00 | 85 km, Moderate |
| Haworth | 68 K | 100 % | 1.00 | 98 km, Moderate |
| Shackleton | 94 K | 100 % | 1.00 | none (walls too steep) |
| Faustini | 90 K | 73 % | 0.87 | 117 km, Hard |
| Sverdrup | 105 K | 64 % | 0.82 | 53 km, Moderate |
| Cabeus | 214 K | 10 % | 0.05 | 189 km, Moderate |
| Amundsen | 217 K | 4 % | 0.02 | 206 km, Moderate |

Sanity check: Faustini (90 K), Shoemaker (77 K) and Haworth (68 K) agree with published ranges (Hayne et al. 2015).

---

## 8. Honest limitations (say these before the teacher finds them)

1. **Cabeus scores low although NASA's LCROSS impact did detect water there.** Our window is large and partly sunlit, and its crater centre is unverified, so the median temperature comes out high. The score inherits that data problem.
2. **The rover base station is a placeholder** (recalled Connecting Ridge position, not checked for sunlight or slope).
3. **Crater centres were recalled from the gazetteer, not re-checked.** Shackleton's centre was taken from the data instead.
4. **The classification is still the old hand-written rules** (`rules-v0`) on partly simulated inputs; CPR, boulders, hazard and some other fields are still simulated.
5. **Routes ignore** sunlight, radio contact and rover dynamics. Rover slope limits are VIPER's, not a specific mission's plan.
6. **No trained model:** a model trained on 7 sites would look scientific without being so.
7. **Not yet run against real Atlas / Blob / `vercel dev`** (needs your accounts). Everything was tested against an in-memory MongoDB.
8. The traverse page's boulder column says "n/a": no dataset measures it yet.

---

## 8b. Running without a database (demo and snapshot mode)

- `npm run demo` starts a temporary in-memory MongoDB on your computer, loads the 7 sites and 6 routes, and serves the whole site at `http://localhost:3000`. Uploads work; data resets when you stop it.
- If the deployed site has **no database connected** (no `MONGODB_URI`), the API serves a saved **snapshot** of the same data (`api/_lib/snapshot.json`, made with `npm run snapshot`). The pages work read-only and say so; uploads are switched off with a clear message. As soon as a real `MONGODB_URI` is added, the site uses the database automatically.

---

## 8c. How to run the demo (step by step)

The demo runs the whole site on your own computer. It needs no accounts, no Atlas and no Vercel.

**You need:** Node.js installed (any recent version) and an internet connection the first time.

**One-time setup** (in the project folder):
```
npm install
```

**Start it:**
```
npm run demo
```
- The first run downloads a small MongoDB program (about a minute). Later runs start in seconds.
- Wait for these lines: `pipeline data loaded: { sites: 7, routes: 6 }` and `Lunar Ice Watch demo: http://localhost:3000`.
- Open **http://localhost:3000** in your browser.
- Stop it with **Ctrl+C**.

**What it does:** starts a temporary database in memory, loads the 6 demo sites, adds the real Diviner/LOLA results (7 sites in total, including Shackleton) and the 6 planned routes, then serves the website and the API.

**A 5-minute tour to show your teacher**
1. **Dashboard** (`/dashboard.html`): 7 sites with their classifications and a provenance badge on each (real / mixed / simulated).
2. **Site page:** click Shoemaker or Haworth. The "Measured Features" card shows real values tagged RASTER, "not available yet" for the missing radar and neutron data, and the screening score with its coverage.
3. **Map:** hover a site for the tooltip and click it for the detail panel.
4. **Traverse:** pick a site such as Cabeus, press **Play**, and watch the rover follow the green route while the waypoint table highlights the current leg.
5. **Upload:** click "Download template", change a value or two, upload it, and see a new site appear on the dashboard. Try a bad value such as `1.2abc` to show that it is rejected with a clear message.

**What works and what doesn't**
- Everything works, including uploads, because the temporary database accepts writes.
- The data **resets every time you stop it**, so uploaded sites disappear. The uploaded CSV file itself is not stored (there is no file storage in the demo), only its rows.
- The live site (`lunar-ice-watch.vercel.app`) shows the same data read-only, because no database is connected to it yet.

**If something goes wrong**
| Problem | Fix |
|---|---|
| `EADDRINUSE` / port 3000 already in use | Use another port. PowerShell: `$env:PORT=3001; npm run demo`. Command Prompt: `set PORT=3001 && npm run demo`. Then open `http://localhost:3001` |
| Stuck on the first run | It is downloading MongoDB. Check your internet and wait, or run it again |
| `Cannot find module` | Run `npm install` first |
| Windows asks about firewall access | Allow it; it only serves your own computer |
| Pages say "Could not load sites" | The demo is not running. Start it again and refresh |

To try the "no database" mode that the live site uses, run `npm run demo -- --snapshot` instead. It serves the saved data read-only, and uploads show the "switched off" message.

---

## 9. Likely questions from a teacher

**Why MongoDB?** Flexible documents (missing measurements are natural), built-in geospatial index, free cloud tier.

**Why an API instead of the page calling the database?** Security: the database password must never reach the browser.

**Why is the classification on the server?** So users can't tamper with it from the browser.

**How do you know the data is real?** Each value carries a provenance tag; downloads are checked against pinned SHA-256 fingerprints; the pipeline cites each dataset; the numbers match published ranges.

**Why not train a machine-learning model?** No labelled examples of "ice / no ice" to learn from; 7 sites is far too few. A transparent formula with documented sources is more honest.

**What if the database is down or not connected?** With no `MONGODB_URI` the site serves a saved read-only snapshot of the real data (labelled as such). If a database is configured but fails, the error is shown, not hidden.

**Why did you remove login?** It's a mini-project; real authentication was built, then removed on request. Open endpoints are guarded with size limits and rate limits instead.

**What would you do next?** Add the radar, neutron and illumination data; verify the crater centres; choose a real base site; run against the real Atlas and Blob services; maybe train a model if labelled data can be found.

---

## 10. How to run and check it

```
npm test                              # classification + score tests
node scripts/smoke.js                 # every API function against an in-memory MongoDB
cd pipeline && python -m unittest test_pipeline     # maths, projection, A* tests

# With a real database (put MONGODB_URI and BLOB_READ_WRITE_TOKEN in .env):
npm run seed
cd pipeline && python pipeline.py compute --write    # real temperature/slope features -> MongoDB
cd pipeline && python route.py --write               # planned routes -> MongoDB
```

More detail: `CHANGELOG.md` (technical log), `CHANGES.md` (the earlier backend work), `pipeline/README.md` (data sources and what to verify).
