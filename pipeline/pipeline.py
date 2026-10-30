"""Lunar Ice Watch offline pipeline.

    python pipeline.py fetch              # download the datasets that are publicly downloadable, list the manual ones
    python pipeline.py compute            # compute features per site -> output/site_features.json (dry run)
    python pipeline.py compute --write    # ...and update MongoDB (needs MONGODB_URI in the environment or ../.env)

Every number written comes from a raster, or is null. Nothing is estimated or filled in.
All geometry is done in Moon south polar stereographic metres (sphere R = 1737.4 km), never an Earth CRS.
"""
import datetime
import hashlib
import glob
import json
import os
import sys
import urllib.request

import geopandas as gpd
import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.features import geometry_mask
from rasterio.vrt import WarpedVRT
from rasterio.windows import from_bounds
from scipy.ndimage import uniform_filter
from shapely.geometry import Point, mapping

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "output", "site_features.json")
CFG = json.load(open(os.path.join(HERE, "config.json")))
R = CFG["moon_radius_m"]

MOON_GEO = CRS.from_proj4(f"+proj=longlat +R={R} +no_defs")
MOON_POLAR = CRS.from_proj4(f"+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R={R} +units=m +no_defs")
TO_POLAR = Transformer.from_crs(MOON_GEO, MOON_POLAR, always_xy=True)

DIVINER_BASE = "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/"
DIVINER = {  # name -> file
    "summer_max": "polar_south_80_summer_max-float.tif",
    "winter_max": "polar_south_80_winter_max-float.tif",  # derived by fetch() from the published .grd, see derive_winter_max()
    "summer_avg": "polar_south_80_summer_avg-float.tif",
    "winter_avg": "polar_south_80_winter_avg-float.tif",
}
LOLA_BASE = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/"
LOLA = ["LDEM_80S_80M.LBL", "LDEM_80S_80M.IMG"]

CITE = {
    "diviner": "Williams, J.-P. et al. (2019) Seasonal polar temperatures on the Moon. J. Geophys. Res. Planets 124, 2505-2521. doi:10.1029/2019JE006028",
    "lola": "LRO LOLA polar gridded data record LDEM_80S_80M (PDS dataset LRO-L-LOLA-4-GDR-V1.0, product version V2.0, D. E. Smith, created 2017-06-15)",
}

# Optional rasters that cannot be downloaded automatically: drop a GeoTIFF matching the glob into data/<dir>/.
# Any CRS is fine (it is warped to Moon polar stereographic). scale() maps raw values to the stored unit.
OPTIONAL = {
    "cpr": dict(glob="minirf/*cpr*.tif", name="LRO Mini-RF circular polarization ratio mosaic", scale=lambda a: a),
    "neutronSuppression": dict(glob="lend/*neutron*.tif", name="LRO LEND epithermal neutron suppression map", scale=lambda a: a),
    "illumFraction": dict(glob="illum/*illum*.tif", name="LOLA-derived illumination fraction map",
                          scale=lambda a: a / 100.0 if np.nanmax(a) > 1.5 else a),  # accepts 0-1 or 0-100 %
}


def verify_checksum(path):
    """Check a downloaded file against the pinned SHA-256 in config.json before anything parses it; delete it on mismatch."""
    want = CFG["sha256"].get(os.path.basename(path))
    if not want:
        return
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    if h.hexdigest() != want:
        os.remove(path)
        sys.exit(f"Checksum mismatch for {os.path.basename(path)}: file deleted. It changed upstream or was tampered with; "
                 "re-check the source, then update config.json sha256 if the change is legitimate.")


def fetch():
    jobs = [(DIVINER_BASE + f, os.path.join(DATA, "diviner", f)) for k, f in DIVINER.items() if k != "winter_max"]
    jobs.append((DIVINER_BASE + "polar_south_80_winter_max.grd", os.path.join(DATA, "diviner", "polar_south_80_winter_max.grd")))
    jobs += [(LOLA_BASE + f, os.path.join(DATA, "lola", f)) for f in LOLA]
    for url, dest in jobs:
        if not (os.path.exists(dest) and os.path.getsize(dest) > 0):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            print("downloading", url)
            urllib.request.urlretrieve(url, dest)
        else:
            print("have", os.path.relpath(dest, HERE))
        verify_checksum(dest)
    derive_winter_max()
    print("\nMANUAL datasets (not fetched; the matching feature stays null until you add them) - see README:")
    for key, d in OPTIONAL.items():
        found = glob.glob(os.path.join(DATA, d["glob"]))
        print(f"  {key:20s} {'FOUND ' + found[0] if found else 'MISSING - put a GeoTIFF at data/' + d['glob']}")


def derive_winter_max():
    """The winter-maximum map is published only as a GMT .grd whose coordinates are in units of the Moon radius.
    It is on the identical 2533x2533 grid as the other maps, so write it as a GeoTIFF with their metre georeferencing
    (after checking the shape and NaN mask really are identical, and that it is not flipped)."""
    d = os.path.join(DATA, "diviner")
    out = os.path.join(d, DIVINER["winter_max"])
    if os.path.exists(out):
        return
    with rasterio.open(os.path.join(d, DIVINER["winter_avg"])) as ref, rasterio.open(os.path.join(d, "polar_south_80_winter_max.grd")) as g:
        a, b = g.read(1), ref.read(1)
        assert a.shape == b.shape and np.array_equal(np.isnan(a), np.isnan(b)), "winter_max.grd is not on the same grid as the other maps"
        m = ~np.isnan(a)
        assert np.corrcoef(a[m], b[m])[0, 1] > 0.8, "winter_max.grd looks flipped"
        prof = ref.profile
    tmp = out + ".part"  # write then rename, so an interrupted run never leaves a half-written file at `out`
    with rasterio.open(tmp, "w", **prof) as dst:
        dst.write(a.astype(prof["dtype"]), 1)
    os.replace(tmp, out)
    print("derived", os.path.relpath(out, HERE))


# ---------- geometry / raster helpers ----------

def is_moon_polar(src):
    wkt = src.crs.to_wkt() if src.crs else ""
    return "Polar_Stereographic" in wkt and "1737400" in wkt and "-90" in wkt


def open_polar(path):
    """Open a raster so that its coordinates are Moon polar stereographic metres."""
    src = rasterio.open(path)
    if src.crs and is_moon_polar(src):
        return src
    return WarpedVRT(src, crs=rasterio.crs.CRS.from_wkt(MOON_POLAR.to_wkt()))


def read_window(src, bounds, band=1):
    """(array with nodata -> NaN, window transform) covering bounds, clipped to the raster."""
    win = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
    win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
    a = src.read(band, window=win).astype("float64")
    if src.nodata is not None and not np.isnan(src.nodata):
        a[a == src.nodata] = np.nan
    return a, src.window_transform(win)


def site_geometry(site):
    x, y = TO_POLAR.transform(site["lon"], site["lat"])
    r = site["window_km"] * 1000.0
    circle = gpd.GeoSeries([Point(x, y)], crs=MOON_POLAR).buffer(r, quad_segs=32).iloc[0]
    return (x, y), circle


def masked(src, circle, pad=0.0):
    """Values of band 1 inside the circle plus the mask, read from just the bounding window."""
    minx, miny, maxx, maxy = circle.bounds
    a, tf = read_window(src, (minx - pad, miny - pad, maxx + pad, maxy + pad))
    inside = ~geometry_mask([mapping(circle)], out_shape=a.shape, transform=tf)
    return a, inside, tf


def median_in(a, inside, min_valid=0.5, full=None):
    """Median of valid pixels inside the circle, or None if too little of the circle has data.
    `full` = pixels the whole circle would hold; pass it so a raster that only covers part of the circle is rejected."""
    v = a[inside]
    ok = v[~np.isnan(v)]
    if v.size == 0 or ok.size / max(v.size, full or 0) < min_valid:
        return None, int(ok.size)
    return float(np.median(ok)), int(ok.size)


def slope_deg(z, cell):
    gy, gx = np.gradient(z, cell)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def roughness_deg(slope, size=5):
    """Local standard deviation of slope over a size x size window (about 400 m at 80 m/px), in degrees."""
    m = uniform_filter(slope, size, mode="nearest")
    m2 = uniform_filter(slope * slope, size, mode="nearest")
    return np.sqrt(np.maximum(m2 - m * m, 0.0))


# ---------- per-site computation ----------

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def compute_site(site):
    (x, y), circle = site_geometry(site)
    feats = {k: None for k in ("maxTempK", "meanTempK", "pctBelow110K", "cpr", "slopeDeg", "roughness", "illumFraction", "neutronSuppression")}
    prov = {k: None for k in feats}  # provenance of each value; None while the value is null
    evidence, missing = [], []

    # Diviner: annual maximum = max(summer max, winter max); mean = average of the two seasonal averages
    dv = {k: os.path.join(DATA, "diviner", f) for k, f in DIVINER.items()}
    if all(os.path.exists(p) for p in dv.values()):
        arr, tfs = {}, {}
        for k, p in dv.items():
            with open_polar(p) as s:
                arr[k], inside, tfs[k] = masked(s, circle)
                full = circle.area / abs(s.transform.a * s.transform.e)
        if len({a.shape for a in arr.values()}) != 1 or len(set(tfs.values())) != 1:
            raise RuntimeError("Diviner rasters are not on the same grid (shape or transform differ)")
        tmax = np.maximum(arr["summer_max"], arr["winter_max"])  # NaN if either season is missing: no half-known maximum
        tavg = (arr["summer_avg"] + arr["winter_avg"]) / 2
        feats["maxTempK"], n = median_in(tmax, inside, full=full)
        feats["meanTempK"], _ = median_in(tavg, inside, full=full)
        valid = tmax[inside][~np.isnan(tmax[inside])]
        if feats["maxTempK"] is not None:
            feats["pctBelow110K"] = float(100.0 * np.mean(valid < 110.0))
            for k in ("maxTempK", "meanTempK", "pctBelow110K"):
                prov[k] = "raster"
            evidence.append(dict(source="LRO Diviner polar seasonal maps (240 m/px)", provenance="raster", citation=CITE["diviner"],
                                 note=f"Median over {n} px within {site['window_km']} km of the site centre. maxTempK = median of max(summer max, winter max); "
                                      "meanTempK = median of the mean of the summer and winter average maps; "
                                      "pctBelow110K = % of pixels whose annual maximum is below 110 K."))
        else:
            missing.append("Diviner (window outside the 80S map or mostly empty)")
    else:
        missing.append("Diviner (run `python pipeline.py fetch`)")

    # LOLA: slope and roughness from the 80 m DEM (DN * 0.5 = height in metres)
    lola = os.path.join(DATA, "lola", "LDEM_80S_80M.LBL")
    if os.path.exists(lola) and os.path.exists(lola.replace(".LBL", ".IMG")):
        with open_polar(lola) as s:
            cell = abs(s.transform.a)
            a, inside, tf = masked(s, circle, pad=2 * cell)  # pad: np.gradient / filters need neighbours
        z = a * 0.5
        sl = slope_deg(z, cell)
        ro = roughness_deg(sl)
        # keep only pixels inside the circle (the pad ring is dropped by the circle mask itself)
        feats["slopeDeg"], n = median_in(np.where(np.isnan(z), np.nan, sl), inside, full=circle.area / cell ** 2)
        feats["roughness"], _ = median_in(np.where(np.isnan(z), np.nan, ro), inside, full=circle.area / cell ** 2)
        if feats["slopeDeg"] is not None:
            prov["slopeDeg"] = prov["roughness"] = "raster"
            evidence.append(dict(source="LRO LOLA polar DEM LDEM_80S_80M", provenance="raster", citation=CITE["lola"],
                                 note=f"Median over {n} px. slopeDeg = median slope at 80 m baseline; roughness = median local standard deviation of slope in a 5x5 window (about 400 m)."))
    else:
        missing.append("LOLA (run `python pipeline.py fetch`)")

    # Manual datasets: only if the user has placed the file
    for key, d in OPTIONAL.items():
        found = sorted(glob.glob(os.path.join(DATA, d["glob"])))
        if not found:
            missing.append(f"{d['name']} (manual download, data/{d['glob']})")
            continue
        with open_polar(found[0]) as s:
            a, inside, _ = masked(s, circle)
        v, n = median_in(d["scale"](a), inside, full=circle.area / abs(s.transform.a * s.transform.e))
        if v is not None:
            feats[key], prov[key] = v, "raster"
            evidence.append(dict(source=d["name"] + " (" + os.path.basename(found[0]) + ")", provenance="raster", citation=None,
                                 note=f"Median over {n} px. Citation for this file: add it to the README after you choose the product."))
        else:
            missing.append(d["name"] + " (no coverage at this site)")

    for e in published_for(site["siteId"]):
        evidence.append(e)
    for e in evidence:
        e["pipeline"] = True
        e["processedAt"] = now()
    boundary = None
    if not circle.contains(Point(0, 0)):  # a polygon around the pole has no valid lon/lat ring
        geo = gpd.GeoSeries([circle], crs=MOON_POLAR).to_crs(MOON_GEO).iloc[0]
        boundary = mapping(geo)
    return dict(siteId=site["siteId"], name=site["name"], region=site["region"], lat=site["lat"], lon=site["lon"],
                polar_xy_m=[x, y], window_km=site["window_km"], features=feats, featureProvenance=prov,
                evidence=evidence, boundary=boundary, missing=missing)


def published_for(site_id):
    return [dict(source=e["source"], note=e["note"], acquiredAt=None, provenance="published", citation=e["citation"])
            for e in CFG["published_ice_evidence"] if e["siteId"] == site_id]


# ---------- MongoDB ----------

def load_env():
    p = os.path.join(HERE, "..", ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def write_mongo(results, started):
    from pymongo import GEOSPHERE, MongoClient, UpdateOne
    load_env()
    if not os.environ.get("MONGODB_URI"):
        sys.exit("Set MONGODB_URI (environment or ../.env) to use --write")
    db = MongoClient(os.environ["MONGODB_URI"])[os.environ.get("MONGODB_DB", "lunar_ice_watch")]
    sites = db["sites"]
    sites.create_index([("location", GEOSPHERE)])
    ops = []
    for r in results:
        cfg = next(c for c in CFG["sites"] if c["siteId"] == r["siteId"])
        old = sites.find_one({"_id": r["siteId"]}) or {}
        base = {"features." + k: v for k, v in r["features"].items() if r["featureProvenance"][k] == "raster"}
        base.update({"featureProvenance." + k: p for k, p in r["featureProvenance"].items() if p})
        # A value this pipeline wrote earlier but cannot compute now must not linger: null it. Simulated/seed values are left alone.
        for k, v in r["features"].items():
            if v is None and old.get("featureProvenance", {}).get(k) == "raster":
                base["features." + k], base["featureProvenance." + k] = None, None
        # The analysis centre is stored separately; `location` (which the published citation refers to) is only filled when absent.
        base["pipelineCenter"] = {"type": "Point", "coordinates": [r["lon"], r["lat"]]}
        if not old.get("location"):
            base["location"] = base["pipelineCenter"]
        base["boundary"] = r["boundary"]
        # A run that started earlier than the one already stored must not overwrite it, even if it finishes writing last.
        base["pipelineRunAt"] = started
        ops.append(UpdateOne({"_id": r["siteId"], "pipelineRunAt": {"$not": {"$gt": started}}},
                             {"$set": base, "$pull": {"evidence": {"pipeline": True}}}))
        ops.append(UpdateOne({"_id": r["siteId"], "pipelineRunAt": started}, {"$push": {"evidence": {"$each": r["evidence"]}}}))
    # Brand-new sites (not in the seed) get a minimal document; the other fields stay null until a model/pipeline run fills them.
    for r in results:
        if sites.count_documents({"_id": r["siteId"]}) == 0:
            sites.insert_one({"_id": r["siteId"], "name": r["name"], "region": r["region"],
                              "features": {k: None for k in r["features"]}, "featureProvenance": {},
                              "prediction": {"iceProb": None, "label": "INCONCLUSIVE", "tier": "NONE", "modelVersion": "none",
                                             "rationale": "No model prediction yet; features come from rasters only.", "updatedAt": None},
                              "evidence": [], "legacy": {}, "provenance": "raster",
                              "createdAt": datetime.datetime.now(datetime.timezone.utc)})
    sites.bulk_write(ops)
    for r in results:  # summary provenance: raster if every non-null feature is raster, mixed if simulated values remain
        d = sites.find_one({"_id": r["siteId"]})
        pv = d.get("featureProvenance", {})
        simulated = [k for k, v in d["features"].items() if v is not None and pv.get(k) != "raster"]
        sites.update_one({"_id": r["siteId"]}, {"$set": {"provenance": "mixed" if simulated else "raster",
                                                         **{"featureProvenance." + k: "simulated" for k in simulated}}})
    print("updated", len(results), "sites in MongoDB")


def main(argv):
    if len(argv) < 2 or argv[1] not in ("fetch", "compute"):
        sys.exit(__doc__)
    if argv[1] == "fetch":
        return fetch()
    started = datetime.datetime.now(datetime.timezone.utc)
    results = [compute_site(s) for s in CFG["sites"]]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"generatedAt": now(), "sites": results}, open(OUT, "w"), indent=1)
    for r in results:
        f = r["features"]
        print(f"{r['name']:10s} Tmax={f['maxTempK']} Tmean={f['meanTempK']} <110K={f['pctBelow110K']} slope={f['slopeDeg']} rough={f['roughness']}")
        for m in r["missing"]:
            print("   missing:", m)
    print("wrote", os.path.relpath(OUT, HERE))
    if "--write" in argv:
        write_mongo(results, started)


if __name__ == "__main__":
    main(sys.argv)
