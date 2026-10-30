# Changelog - everything changed in this session

Branch `remove-login`. The aim: replace hard-coded and simulated data with a MongoDB-backed system, a real data pipeline
and (later) a real ML model. Phases 1-5 have a first version (phase 4 is a heuristic score, not a trained model).

## Phase 1 - MongoDB backend (Vercel serverless)
- Removed the Express + Mongoose server (`server/`) and `mongodb-memory-server` as a runtime dependency. It could not run on Vercel.
- Added `/api` functions on the native `mongodb` driver with a cached connection (`api/_lib/db.js`):
  `GET /api/sites`, `GET /api/sites/[id]`, `GET /api/sites/near` (geospatial, uses the Moon radius, not Earth's), `POST /api/upload`, `GET|POST /api/routes`.
- New `sites` schema: name, region, GeoJSON `location` (2dsphere), `features{maxTempK, meanTempK, pctBelow110K, cpr, slopeDeg, roughness, illumFraction, neutronSuppression}`, `prediction`, `evidence[]`, `provenance`.
  Screening inputs with no home in the new schema are kept in `legacy{}` (simulated).
- `scripts/seed.js` moves the demo sites into MongoDB and creates the indexes. `scripts/smoke.js` tests every handler against a throwaway in-memory MongoDB.
- Pages (`dashboard`, `site`, `map`, `traverse`) now fetch from the API with a loading banner and an error state with Retry.
  Provenance badges (`simulated` / `published` / `raster` / `mixed`) are shown, and the disclaimer
  "Screening estimates, not scientific confirmation of lunar ice." appears on every data page.

## Phase 2 - Uploads (sign-in was removed at your request)
- Uploads: server-side validation (`.csv` only, 1 MB, 500 rows), file stored in Vercel Blob, MongoDB keeps only the URL plus per-row `observations`.
- A real sign-in (bcrypt + JWT cookie) was built, then **removed** because this is a mini-project: no login page, no `/api/auth/*`, no JWT/bcrypt.
- Replaced by guards on the open endpoints: type/size/row caps and an atomic per-client hourly rate limit
  (`api/_lib/limit.js`, one `$inc` per request so parallel requests cannot bypass it; keyed by an HMAC of the IP, never stored on uploads).
- Bugs found and fixed on the way: `upload.js` still posted to the deleted `/api/sites` (405); two uploads in the same millisecond got the same site id.
- Security-review follow-ups: keyed IP hash, legacy `userId` hidden on routes, `ownerId` hidden on sites.

## Phase 3 - Real data pipeline (`pipeline/`, Python)
- `pipeline.py fetch` downloads real data: **LRO Diviner** polar seasonal temperature maps (Williams et al. 2019) and the **LOLA** 80 m south-polar DEM (PDS `LRO-L-LOLA-4-GDR-V1.0`).
- `pipeline.py compute [--write]` clips a circle around each of 7 sites in a **Moon south-polar stereographic CRS** and computes
  annual max / mean temperature, % area below 110 K, median slope and roughness; writes them to MongoDB with `provenance: "raster"`,
  per-feature provenance, evidence entries with citations and a boundary polygon. Results are also saved to `pipeline/output/site_features.json`.
- Mini-RF CPR, LEND neutron suppression and illumination fraction are **not downloadable automatically**: those fields stay `null`
  (nothing is invented) and `pipeline/README.md` says exactly what to download and where to put it.
- Added Shackleton (`s7`) as a new site. Its gazetteer coordinate sits on the rim next to the pole and gave a wrong sunlit result,
  so its centre was taken from the data; this is flagged for your verification.
- Sanity check: Faustini 90 K, Shoemaker 77 K, Haworth 68 K agree with the ranges already cited in the seed data (Hayne et al. 2015).
- Site page: new "Measured Features" card with a provenance badge per value; null shows "not available yet".
- A second, read-only reviewer agent audited the work. Its findings were fixed: `pipeline/data/` gitignored (rasters are hundreds of MB),
  front-end null-safety for pipeline-only sites (map position now comes from the real lat/lon), NaN guard in `siteDoc.js`, hard-coded "(simulated)" temperature text.

- Second review round fixed: seed `location` is no longer overwritten (the pipeline centre is stored as `pipelineCenter`, so the published citation still matches its coordinates);
  stale raster values are nulled when a re-run cannot compute them; `.env` quotes are stripped; the site page says classification still uses the simulated inputs.
- Downloads use HTTPS and are checked against pinned SHA-256 values in `pipeline/config.json` (trust-on-first-use; a mismatch deletes the file).
- Known caveat from the reviewer: Cabeus (214 K) and Amundsen (217 K) medians are high because their 20/25 km windows cover large partly-sunlit floors and the centres are unverified; `pctBelow110K` (10 % / 4 %) is the better cold-trap indicator for them.

## Phase 4 - Screening score
- `api/_lib/score.js`: hand-weighted 0-1 score from measured features; missing or simulated inputs skipped, weights renormalised, `coverage` reported. Returned as `screening` by `/api/sites`; shown on the site page. No trained model (no labelled data).

## Phase 5 - Traverse planner
- `pipeline/route.py`: A* over the LOLA 80 m slope (320 m planning cells, block-max slope, steps cost more on steeper ground, > 30 deg impassable) from `config.json -> base` to each site centre. `python route.py [--write]` -> `pipeline/output/routes.json` / MongoDB `routes` (`planner: "astar-lola-v1"`).
- Result: 6 of 7 sites get a route (33-211 km; all but Sverdrup rate "Hard", 20-26 deg steepest cell). Shackleton has none: its walls exceed the slope limit.
- The base is a **placeholder** (Connecting Ridge area, recalled, unverified); slope limits are illustrative. Routes ignore illumination, communications and rover dynamics.
- Traverse page draws the planned path and a summary card; its waypoint table is still the old simulated straight line.

## Tests
- `npm test` (classification rules), `node scripts/smoke.js` (API + DB + rate-limit burst), `cd pipeline && python -m unittest test_pipeline` (CRS, slope, roughness, null handling).
- Browser-checked against an in-memory MongoDB seeded and then updated by the pipeline: all pages load with no JS errors.
- **Not done:** `vercel dev` and a real Atlas / Blob run (needs your credentials and `vercel link`).

## Still simulated or missing
- `cpr`, `legacy.*` (hazard, boulders, Pv, SERD, T-ratio, gate temperature, map x/y for the six seed sites), and every classification
  (still the old rules, `modelVersion: "rules-v0"`) are simulated.
- `neutronSuppression`, `illumFraction`, real CPR: missing until you add the manual downloads.
- Phase 4 (weighted score + trained classifier + upload feature extraction) and Phase 5 (A* traverse on LOLA slope) are not started.

## What you need to do
1. Atlas M0 cluster; put `MONGODB_URI` (and `BLOB_READ_WRITE_TOKEN`) in `.env` locally and in Vercel Settings > Environment Variables.
2. `npm run seed`, then `cd pipeline && python pipeline.py compute --write`.
3. Verify the crater centres and the pending published figures listed in `pipeline/README.md`.
4. Optionally add the Mini-RF / LEND / illumination rasters and re-run the pipeline.
