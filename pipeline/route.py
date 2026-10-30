"""Traverse planner (phase 5): A* over LOLA 80 m slope from a base point to each site centre.

    python route.py            plan all sites, write output/routes.json
    python route.py --write    also replace this planner's routes in MongoDB

Cost per step = distance * (1 + (slope/10)^2); slope > rover.max_slope_deg or no data = impassable.
Slope is the block-maximum on a coarser grid, so routes are conservative.
"""
import heapq
import json
import math
import os
import sys

import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString

from pipeline import CFG, DATA, HERE, MOON_GEO, MOON_POLAR, TO_POLAR, now, open_polar, read_window, slope_deg, load_env

OUT = os.path.join(HERE, "output", "routes.json")
ROVER = CFG["rover"]
FROM_POLAR = Transformer.from_crs(MOON_POLAR, MOON_GEO, always_xy=True)
STEPS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def block_max(a, b):
    h, w = (a.shape[0] // b) * b, (a.shape[1] // b) * b
    blocks = a[:h, :w].reshape(h // b, b, w // b, b)
    return np.where(np.isnan(blocks).any(axis=(1, 3)), np.nan, blocks.max(axis=(1, 3)))  # any gap -> no data


def astar(slope, start, goal, cell, max_slope):
    """Cheapest 8-connected path (list of (row, col)) or None. NaN / too-steep cells are blocked."""
    rows, cols = slope.shape
    blocked = np.isnan(slope) | (slope > max_slope)
    s = np.where(blocked, 0.0, slope).tolist()
    bl = blocked.tolist()
    if bl[start[0]][start[1]] or bl[goal[0]][goal[1]]:
        return None
    dist = {start: 0.0}
    prev = {}
    heap = [(0.0, start)]
    done = set()
    while heap:
        _, cur = heapq.heappop(heap)
        if cur in done:
            continue
        if cur == goal:
            path = [cur]
            while cur in prev:
                cur = prev[cur]
                path.append(cur)
            return path[::-1]
        done.add(cur)
        r, c = cur
        for dr, dc in STEPS:
            nr, nc = r + dr, c + dc
            if not (0 <= nr < rows and 0 <= nc < cols) or bl[nr][nc]:
                continue
            step = cell * (1.41421356 if dr and dc else 1.0)
            nd = dist[cur] + step * (1 + (((s[r][c] + s[nr][nc]) / 2) / 10) ** 2)
            if nd < dist.get((nr, nc), 1e30):
                dist[(nr, nc)] = nd
                prev[(nr, nc)] = cur
                h = cell * math.hypot(goal[0] - nr, goal[1] - nc)  # straight line: never overestimates
                heapq.heappush(heap, (nd + h, (nr, nc)))
    return None


def nearest_open(slope, rc, max_slope, radius=15):
    """The base or site centre can sit on a blocked cell (steep rim, data gap): use the closest open one."""
    ok = ~np.isnan(slope) & (slope <= max_slope)
    r0, c0 = rc
    best = None
    for r in range(max(0, r0 - radius), min(slope.shape[0], r0 + radius + 1)):
        for c in range(max(0, c0 - radius), min(slope.shape[1], c0 + radius + 1)):
            if ok[r, c] and (best is None or math.hypot(r - r0, c - c0) < best[0]):
                best = (math.hypot(r - r0, c - c0), (r, c))
    return best and best[1]


def plan(site, base_xy, src):
    sx, sy = TO_POLAR.transform(site["lon"], site["lat"])
    b = ROVER["block"]
    pad = 20000.0
    bounds = (min(sx, base_xy[0]) - pad, min(sy, base_xy[1]) - pad, max(sx, base_xy[0]) + pad, max(sy, base_xy[1]) + pad)
    cell80 = abs(src.transform.a)
    z, tf = read_window(src, tuple(v - 2 * cell80 for v in bounds[:2]) + tuple(v + 2 * cell80 for v in bounds[2:]))
    sl = block_max(slope_deg(z * 0.5, cell80), b)
    cell = cell80 * b

    def to_rc(x, y):  # polar metres -> (row, col) of the coarse grid
        col = int((x - tf.c) / cell80) // b
        row = int((tf.f - y) / cell80) // b
        return min(max(row, 0), sl.shape[0] - 1), min(max(col, 0), sl.shape[1] - 1)

    def to_xy(r, c):
        return tf.c + (c + 0.5) * cell, tf.f - (r + 0.5) * cell

    start, goal = nearest_open(sl, to_rc(*base_xy), ROVER["max_slope_deg"]), nearest_open(sl, to_rc(sx, sy), ROVER["max_slope_deg"])
    path = start and goal and astar(sl, start, goal, cell, ROVER["max_slope_deg"])
    if not path:
        return dict(siteId=site["siteId"], name=site["name"], error="no route under the rover slope limit (crater walls steeper than rover.max_slope_deg, or no LOLA data)")
    xy = LineString([to_xy(r, c) for r, c in path]).simplify(cell / 2)
    pts = list(xy.coords)
    worst = max(sl[r, c] for r, c in path)
    return dict(
        siteId=site["siteId"], name=site["name"],
        start=list(FROM_POLAR.transform(*pts[0])), end=list(FROM_POLAR.transform(*pts[-1])),
        distanceKm=round(sum(math.dist(p, q) for p, q in zip(pts, pts[1:])) / 1000, 1),
        maxSlopeDeg=round(float(worst), 1),
        difficulty="Easy" if worst < ROVER["easy_deg"] else "Moderate" if worst < ROVER["moderate_deg"] else "Hard",
        path={"type": "LineString", "coordinates": [[round(v, 5) for v in FROM_POLAR.transform(*p)] for p in pts]},
    )


def write_mongo(routes):
    from pymongo import MongoClient
    import datetime
    load_env()
    if not os.environ.get("MONGODB_URI"):
        sys.exit("Set MONGODB_URI (environment or ../.env) to use --write")
    col = MongoClient(os.environ["MONGODB_URI"])[os.environ.get("MONGODB_DB", "lunar_ice_watch")]["routes"]
    col.delete_many({"planner": "astar-lola-v1"})  # only this planner's routes; user-saved ones stay
    docs = [dict(r, planner="astar-lola-v1", createdAt=datetime.datetime.now(datetime.timezone.utc)) for r in routes if "error" not in r]
    for d in docs:
        d.pop("name")
    if docs:
        col.insert_many(docs)
    print("wrote", len(docs), "routes to MongoDB")


def main(argv):
    base = CFG["base"]
    bx, by = TO_POLAR.transform(base["lon"], base["lat"])
    routes = []
    with open_polar(os.path.join(DATA, "lola", "LDEM_80S_80M.LBL")) as src:
        for site in CFG["sites"]:
            r = plan(site, (bx, by), src)
            routes.append(r)
            print(f"{r['name']:10s}", r.get("error") or f"{r['distanceKm']} km, max slope {r['maxSlopeDeg']} deg, {r['difficulty']}")
    json.dump({"generatedAt": now(), "base": base, "rover": ROVER, "routes": routes}, open(OUT, "w"), indent=1)
    print("wrote", os.path.relpath(OUT, HERE))
    if "--write" in argv:
        write_mongo(routes)


if __name__ == "__main__":
    main(sys.argv)
