const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { polarPercent, flattenSite } = require("./data");
const { fitView, niceStep, startProgress, kmBetween, PLANNER_BASE } = require("./traverse-view");

const snapshot = require("../api/_lib/snapshot.json");
const WIDTH = 760, HEIGHT = 440, PAD = 56;

function coverage(points) {
  const view = fitView(points, WIDTH, HEIGHT, PAD);
  const px = points.map(view.toScreen);
  const w = Math.max.apply(null, px.map(function (p) { return p.px; })) - Math.min.apply(null, px.map(function (p) { return p.px; }));
  const h = Math.max.apply(null, px.map(function (p) { return p.py; })) - Math.min.apply(null, px.map(function (p) { return p.py; }));
  px.forEach(function (p) {
    assert(p.px >= PAD - 1 && p.px <= WIDTH - PAD + 1 && p.py >= PAD - 1 && p.py <= HEIGHT - PAD + 1, "route left the canvas");
  });
  return Math.max(w / WIDTH, h / HEIGHT);
}

assert.strictEqual(snapshot.routes.length, 6);
snapshot.routes.forEach(function (r) {
  const points = r.path.coordinates.map(function (c) { return polarPercent(c[1], c[0]); });
  assert(coverage(points) > 0.5, r.siteId + " route is too small to see");
});

const shackleton = flattenSite(snapshot.sites.find(function (s) { return s._id === "s7"; }));
const direct = [polarPercent(PLANNER_BASE.lat, PLANNER_BASE.lon), { x: shackleton.x, y: shackleton.y }];
assert(coverage(direct) > 0.5, "direct line is too small to see");
assert(Math.abs(kmBetween(direct[0], direct[1]) - 19.1) < 0.5, "base to Shackleton should be about 19 km");

const haworth = snapshot.sites.find(function (s) { return s._id === "s4"; });
const expected = polarPercent(haworth.location.coordinates[1], haworth.location.coordinates[0]);
const flat = flattenSite(haworth);
assert.deepStrictEqual([flat.x, flat.y, flat.posFromCoords], [expected.x, expected.y, true]);

assert(Number.isFinite(fitView([{ x: 50, y: 50 }, { x: 50, y: 50 }], WIDTH, HEIGHT, PAD).scale));

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../pipeline/config.json")));
assert.deepStrictEqual(PLANNER_BASE, { lat: cfg.base.lat, lon: cfg.base.lon });

assert.strictEqual(niceStep(3), 5);
assert.strictEqual(niceStep(12), 25);
assert.strictEqual(niceStep(60), 100);

assert.strictEqual(startProgress(1), 0);
assert.strictEqual(startProgress(0.4), 0.4);

console.log("ok");
