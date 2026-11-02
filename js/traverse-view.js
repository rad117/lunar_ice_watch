// Geometry and playback rules for the traverse canvas, kept free of the DOM so js/traverse-view.test.js can run them in Node.
// Positions are "map percent" {x, y} from polarPercent() in js/data.js, where 300 km = 40 %.
const KM_PER_PERCENT = 7.5;

// Where the pipeline starts every planned route (pipeline/config.json -> base). It is a placeholder, not a verified landing site.
const PLANNER_BASE = { lat: -89.45, lon: -137.3 };

function kmBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_PERCENT;
}

// Zooms the view so the whole route fills the canvas. A fixed polar scale cannot work here: routes run from
// 20 to 200 km on a map spanning 750 km, so the short ones shrink to a few pixels.
function fitView(points, width, height, pad) {
  const xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
  const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  const spanX = Math.max(maxX - minX, 0.01), spanY = Math.max(maxY - minY, 0.01); // floor keeps a zero-length route finite
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  return {
    scale: scale,
    toScreen: function (p) { return { px: width / 2 + (p.x - midX) * scale, py: height / 2 + (p.y - midY) * scale }; }
  };
}

// Rounds a distance up to a tidy value for the range rings and the scale bar
function niceStep(km) {
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500];
  for (let i = 0; i < steps.length; i++) if (steps[i] >= km) return steps[i];
  return steps[steps.length - 1];
}

// Where a run starts when Play is pressed: a finished run starts again, a paused one carries on
function startProgress(progress) {
  return progress >= 1 ? 0 : progress;
}

if (typeof module !== "undefined") module.exports = { KM_PER_PERCENT, PLANNER_BASE, kmBetween, fitView, niceStep, startProgress };
