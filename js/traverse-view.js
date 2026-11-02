const KM_PER_PERCENT = 7.5;

const PLANNER_BASE = { lat: -89.45, lon: -137.3 };

function kmBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_PERCENT;
}

function fitView(points, width, height, pad) {
  const xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
  const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  const spanX = Math.max(maxX - minX, 0.01), spanY = Math.max(maxY - minY, 0.01);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  return {
    scale: scale,
    toScreen: function (p) { return { px: width / 2 + (p.x - midX) * scale, py: height / 2 + (p.y - midY) * scale }; }
  };
}

function niceStep(km) {
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500];
  for (let i = 0; i < steps.length; i++) if (steps[i] >= km) return steps[i];
  return steps[steps.length - 1];
}

function startProgress(progress) {
  return progress >= 1 ? 0 : progress;
}

if (typeof module !== "undefined") module.exports = { KM_PER_PERCENT, PLANNER_BASE, kmBetween, fitView, niceStep, startProgress };
