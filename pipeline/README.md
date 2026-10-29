# Lunar Ice Watch data pipeline (offline, Python)

Computes real, raster-derived features for each candidate site and writes them to the MongoDB `sites` collection with
`provenance: "raster"`. Nothing is estimated: if a dataset is missing, the feature is `null` and the run says so.

## Setup

```
cd pipeline
pip install -r requirements.txt
python pipeline.py fetch              # downloads what is publicly downloadable (~210 MB) into pipeline/data/ (gitignored)
python pipeline.py compute            # dry run -> output/site_features.json
python pipeline.py compute --write    # also updates MongoDB (MONGODB_URI from the environment or ../.env)
python -m unittest test_pipeline      # maths + CRS checks, no data needed
```

Run `npm run seed` first (it creates the demo sites and indexes); the pipeline then updates those sites and adds Shackleton.
Re-running the seed overwrites pipeline results, so run the pipeline again afterwards.

## Coordinate system

Everything is done in a **Moon south polar stereographic** projection (`+proj=stere +lat_0=-90 +lat_ts=-90 +R=1737400`),
never an Earth CRS. `test_pipeline.py` checks that 1 degree of latitude is 30.3 km. Each site is a circle of `window_km`
(config.json) around its centre; every statistic is a median over the valid pixels inside that circle, and is `null`
if less than half of the circle has data.

## Datasets

| Feature | Dataset | How it is obtained | Status |
|---|---|---|---|
| `maxTempK`, `meanTempK`, `pctBelow110K` | LRO Diviner polar seasonal maps, 240 m/px, Williams et al. 2019 (luna1.diviner.ucla.edu) | automatic (`fetch`) | **real** |
| `slopeDeg`, `roughness` | LRO LOLA `LDEM_80S_80M` (PDS `LRO-L-LOLA-4-GDR-V1.0`, v2.0), from imbrium.mit.edu | automatic (`fetch`) | **real** |
| `cpr` | LRO Mini-RF S-band circular polarization ratio | **manual** | null (seed keeps its simulated placeholder) |
| `neutronSuppression` | LRO LEND epithermal neutron map | **manual** | null |
| `illumFraction` | LOLA-derived illumination map (e.g. Mazarico et al. 2011) | **manual** | null |

How the Diviner numbers are defined: annual maximum per pixel = max(summer maximum, winter maximum) map; annual mean =
average of the summer and winter average maps (an approximation of a true annual mean, since the seasons are not
equal-length); `pctBelow110K` = % of pixels in the circle whose annual maximum is below 110 K (the usual cold-trap threshold).
`slopeDeg` is the median slope at an 80 m baseline; `roughness` is the median local standard deviation of slope in a
5x5 window (about 400 m).

The Diviner winter-maximum map is only published as a GMT `.grd` with coordinates in units of the Moon radius.
`fetch` re-georeferences it onto the identical grid of the other maps after asserting that the shape and NaN mask match
and that it is not flipped.

## Manual downloads (what you need to do)

The pipeline reads any GeoTIFF in any CRS (it is warped to Moon polar stereographic) placed at:

* `pipeline/data/minirf/<anything>cpr<anything>.tif` - **Mini-RF CPR, south polar**. NASA PDS Geosciences / ODE
  (ode.rsl.wustl.edu/moon, instrument Mini-RF, "Mosaic Derived Data Record"). I could not find a ready-made south-polar CPR
  GeoTIFF on PDS; the MOSDDR mosaic is a global simple-cylindrical Stokes product, so you need to derive CPR from it (or use
  a polar CPR mosaic from Moon Trek / a paper's supplementary data) and save it as a GeoTIFF.
* `pipeline/data/lend/<anything>neutron<anything>.tif` - **LEND epithermal neutron suppression** (e.g. Mitrofanov et al. 2010,
  Litvak et al. 2012). I did not find a directly downloadable raster; request it from the LEND team / PDS or digitise from
  the paper.
* `pipeline/data/illum/<anything>illum<anything>.tif` - **illumination fraction** (0-1 or 0-100 %).
* Chandrayaan-2 (ISRO PRADAN) needs registration and is not used.

After adding a file, rerun `python pipeline.py compute --write`. The `fetch` command lists which of these are still missing.

## Please verify (I could not)

* **Crater centres** in `config.json` were recalled from the USGS Gazetteer / Wikipedia, not re-checked. Shackleton's gazetteer
  position (89.9S) is on the rim next to the pole and gave a wrong (sunlit) result, so its centre was set from the data
  (centroid of the Diviner <110 K pixels near the pole); see its `coord_note`.
* **Published ice evidence**: only the qualitative LCROSS-at-Cabeus detection (Colaprete et al. 2010, Science 330, 463) is
  stored. The water abundance figure and which craters have Li et al. 2018 (PNAS 115, 8907) M3 surface-ice detections are in
  `config.json -> published_pending_user_verification`; they are not written to the database until you confirm them.
* Diviner values are medians over a floor-sized circle, so large partly-sunlit floors (Cabeus, Amundsen) show high
  medians and low `pctBelow110K`. Shoemaker 77 K, Haworth 68 K, Faustini 90 K agree with the ranges quoted by Hayne et al. 2015.

## Output

`output/site_features.json` (committed) has, per site: features, per-feature provenance, evidence entries with citations,
the window boundary polygon (null for windows containing the pole) and a `missing` list.
