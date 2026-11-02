// Powers traverse.html: draws the rover's route from the base station to the chosen site, splits it into
// 5 waypoints and animates the rover along it. The view zooms to fit each route (js/traverse-view.js).

const TRAVERSE_MS = 6000;      // one full run at 1x speed
const LINE_POINTS = 21;        // a straight line is split into this many points so it follows the same code as a real route
const stepFractions = [0.2, 0.4, 0.6, 0.8, 1.0];

const params = new URLSearchParams(window.location.search);
const select = document.getElementById("siteSelect");
const canvas = document.getElementById("traverseCanvas");
const ctx = canvas.getContext("2d");
const playBtn = document.getElementById("playBtn");
const statusText = document.getElementById("statusText");

let currentSite = getSiteById(params.get("id")) || siteData[0];
let routes = [];     // every planned route, loaded once so changing site is instant
let plan = null;     // the current site's route: { route, points, totalKm, waypoints }
let view = null;     // fitView() result for the current route and canvas size
let width = 0, height = 0;

let progress = 0;    // 0 at the base, 1 at the target
let raf = null;      // animation frame while the rover is moving
let lastTick = 0;
let speed = 1;

// ---- "Target site" dropdown (#siteSelect) ----
siteData.forEach(function (s) {
  const opt = document.createElement("option");
  opt.value = s.id;
  opt.textContent = s.label + " - " + s.crater;
  if (s.id === currentSite.id) opt.selected = true;
  select.appendChild(opt);
});

// Swaps the route in place, keeping the URL shareable
function changeSite(id) {
  try { history.replaceState(null, "", "?id=" + encodeURIComponent(id)); } catch (e) { /* some file:// pages refuse this; the switch below still works */ }
  applySite(getSiteById(id));
}

// great-circle km on the Moon
function legKm(a, b) {
  const r = Math.PI / 180, h = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 2 * 1737.4 * Math.asin(Math.sqrt(h));
}

// Hazard tiers follow VIPER: <=15 deg operational (Low), <=25 extended (Medium), above that slip risk (High).
function slopeHazard(slope) {
  return slope <= 15 ? "Low" : slope <= 25 ? "Medium" : "High";
}

// The hazard score only exists for sites with simulated or uploaded data; a site with no score says so.
function siteHazard(site) {
  const s = site.terrainHazard;
  return s == null ? "n/a" : s < 30 ? "Low" : s < 50 ? "Medium" : "High";
}

function slopeColor(slope) {
  if (slope == null) return "#ffb454";
  return slope <= 15 ? "#4ade80" : slope <= 25 ? "#fbbf24" : "#f87171";
}

// Colour of the segment ending at point i, from the steeper of its two ends
function segmentColor(i) {
  const a = plan.points[i - 1].slope, b = plan.points[i].slope;
  return slopeColor(a == null || b == null ? null : Math.max(a, b));
}

// The site's A* route (pipeline/route.py) when there is one, otherwise a straight line from the base, for scale only.
function buildPlan(site) {
  const route = routes.find(function (r) {
    return r.siteId === site.id && r.planner === "astar-lola-v1" && Array.isArray(r.slopes) && r.slopes.length === r.path.coordinates.length;
  }) || null;

  let points, cumKm = [0];
  if (route) {
    const co = route.path.coordinates;
    points = co.map(function (c, i) { return Object.assign(polarPercent(c[1], c[0]), { slope: route.slopes[i] }); });
    for (let i = 1; i < co.length; i++) cumKm.push(cumKm[i - 1] + legKm(co[i - 1], co[i]));
  } else {
    const a = polarPercent(PLANNER_BASE.lat, PLANNER_BASE.lon);
    points = Array.from({ length: LINE_POINTS }, function (_, i) {
      const t = i / (LINE_POINTS - 1);
      return { x: a.x + (site.x - a.x) * t, y: a.y + (site.y - a.y) * t, slope: null };
    });
    for (let i = 1; i < points.length; i++) cumKm.push(cumKm[i - 1] + kmBetween(points[i - 1], points[i]));
  }

  const lastKm = cumKm[cumKm.length - 1] || 1;
  points.forEach(function (p, i) { p.cum = cumKm[i] / lastKm; });
  return { route: route, points: points, totalKm: route ? Number(route.distanceKm) : cumKm[cumKm.length - 1], waypoints: buildWaypoints(site, points, cumKm) };
}

// 5 waypoints at equal distances along the route; slope = steepest planning cell in each leg, hazard from that slope.
// Boulder counts are not measured by any dataset yet, so they show "n/a".
function buildWaypoints(site, points, cumKm) {
  let from = 0, prevIdx = 0;
  return stepFractions.map(function (frac, k) {
    let idx = points.length - 1;
    for (let i = prevIdx; i < points.length; i++) if (points[i].cum >= frac - 1e-9) { idx = i; break; }
    const legSlopes = points.slice(prevIdx, idx + 1).map(function (p) { return p.slope; }).filter(function (s) { return s != null; });
    const worst = legSlopes.length ? Math.max.apply(null, legSlopes) : null;
    const hazard = worst == null ? siteHazard(site) : slopeHazard(worst);
    const w = {
      point: points[idx],
      type: k === 4 ? "Ice Target" : hazard === "High" ? "Hazard Zone" : k === 0 ? "Entry Point" : "Nav Node",
      fracFrom: from, fracTo: frac,
      distance: Math.round((cumKm[idx] - cumKm[prevIdx]) * 1000), slope: worst == null ? "n/a" : Math.round(worst), hazard: hazard, boulders: "n/a"
    };
    from = frac; prevIdx = idx;
    return w;
  });
}

function waypointColor(type) {
  if (type === "Hazard Zone") return "#f87171";
  if (type === "Ice Target") return "#4ade80";
  return "#7dd3fc";
}

// Index of the segment the rover is on at progress p, and how far along it
function segmentAt(p) {
  const pts = plan.points;
  let i = 1;
  while (i < pts.length - 1 && pts[i].cum < p) i++;
  const a = pts[i - 1], b = pts[i];
  return { a: a, b: b, i: i, t: b.cum === a.cum ? 0 : Math.min(1, Math.max(0, (p - a.cum) / (b.cum - a.cum))) };
}

function roverPoint(p) {
  const s = segmentAt(p);
  return { x: s.a.x + (s.b.x - s.a.x) * s.t, y: s.a.y + (s.b.y - s.a.y) * s.t };
}

// ---- Canvas: sized to its container each time so text stays sharp on any screen ----
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  width = canvas.parentElement.clientWidth;
  height = Math.round(Math.max(280, Math.min(width * 0.52, window.innerHeight - 300))); // leaves room for the controls and readouts on a laptop screen
  canvas.style.height = height + "px";
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view = fitView(plan.points, width, height, width < 520 ? 44 : 72);
}

function drawLabel(text, x, y, color) {
  ctx.font = "12px 'JetBrains Mono', Consolas, monospace";
  const w = ctx.measureText(text).width;
  const left = Math.max(6, Math.min(x, width - w - 10)); // labels stay on the canvas near the edges
  ctx.fillStyle = "rgba(5, 8, 16, 0.78)";
  ctx.fillRect(left - 5, y - 14, w + 10, 19);
  ctx.fillStyle = color;
  ctx.fillText(text, left, y);
}

// Range rings around the base, on round km values, so the zoom level can be read off the picture
function drawRings(base) {
  const pxPerKm = view.scale / KM_PER_PERCENT;
  const step = niceStep(plan.totalKm / 3);
  ctx.lineWidth = 1;
  for (let km = step, n = 0; n < 12; km += step, n++) {
    const r = km * pxPerKm;
    ctx.strokeStyle = "rgba(125, 211, 252, 0.13)";
    ctx.beginPath();
    ctx.arc(base.px, base.py, r, 0, Math.PI * 2);
    ctx.stroke();
    const lx = base.px + r * Math.cos(-0.5), ly = base.py + r * Math.sin(-0.5);
    if (lx > 12 && lx < width - 60 && ly > 16 && ly < height - 12) {
      ctx.font = "11px 'JetBrains Mono', Consolas, monospace";
      ctx.fillStyle = "rgba(168, 176, 192, 0.65)";
      ctx.fillText(km + " km", lx + 4, ly);
    }
  }

  const barKm = step, barPx = barKm * pxPerKm;
  ctx.strokeStyle = "#a8b0c0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, height - 18);
  ctx.lineTo(18 + barPx, height - 18);
  ctx.stroke();
  drawLabel(barKm + " km", 18, height - 26, "#a8b0c0");
}

// The route, coloured by slope. The stretch already driven is drawn brighter and thicker on top.
function drawRoute(rover) {
  const pts = plan.points.map(view.toScreen);
  ctx.lineCap = "round";
  ctx.setLineDash(plan.route ? [] : [8, 7]);
  plan.points.forEach(function (p, i) {
    if (!i) return;
    ctx.strokeStyle = segmentColor(i);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].px, pts[i - 1].py);
    ctx.lineTo(pts[i].px, pts[i].py);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  if (progress > 0) {
    const end = segmentAt(progress).i;
    ctx.lineWidth = 4;
    for (let i = 1; i <= end; i++) {
      ctx.strokeStyle = segmentColor(i);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].px, pts[i - 1].py);
      const to = i === end ? rover : pts[i];
      ctx.lineTo(to.px, to.py);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
}

function drawMarkers(base, target, rover) {
  plan.waypoints.forEach(function (w, i) {
    const p = view.toScreen(w.point);
    if (i === plan.waypoints.length - 1) return;
    ctx.fillStyle = waypointColor(w.type);
    ctx.beginPath();
    ctx.arc(p.px, p.py, 5, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(String(i + 1), p.px + 9, p.py - 9, "#e6e9ef");
  });

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(base.px, base.py, 8, 0, Math.PI * 2);
  ctx.fill();
  drawLabel("Base station", base.px + 13, base.py + 22, "#a8b0c0");

  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(74, 222, 128, 0.22)";
  ctx.beginPath();
  ctx.arc(target.px, target.py, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.arc(target.px, target.py, 5, 0, Math.PI * 2);
  ctx.fill();
  drawLabel(currentSite.label, target.px + 18, target.py - 14, "#ffffff");

  ctx.fillStyle = "rgba(255, 180, 84, 0.25)";
  ctx.beginPath();
  ctx.arc(rover.px, rover.py, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(rover.px, rover.py, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0b0e14";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  const base = view.toScreen(plan.points[0]);
  const target = view.toScreen(plan.points[plan.points.length - 1]);
  const rover = view.toScreen(roverPoint(progress));
  drawRings(base);
  drawRoute(rover);
  drawMarkers(base, target, rover);
}

// Text shown in #statusText (e.g. "en route to Nav Node", "arrived at Ice Target")
function statusForProgress(p) {
  if (p <= 0) return "rover parked at base station";
  if (p >= 1) return "arrived at Ice Target";
  const w = plan.waypoints.find(function (x) { return p <= x.fracTo + 0.0001; });
  return "en route to " + w.type;
}

// Readouts under the canvas, and the "wp-active" highlight on the current waypoint's table row
function updateReadouts() {
  statusText.textContent = statusForProgress(progress);
  document.getElementById("hudDistance").textContent = (plan.totalKm * progress).toFixed(1) + " / " + plan.totalKm.toFixed(1) + " km";
  const slope = segmentAt(progress).b.slope;
  document.getElementById("hudSlope").textContent = slope == null ? "n/a" : Math.round(slope) + "°";

  let active = plan.waypoints.findIndex(function (w) { return progress <= w.fracTo + 0.0001; });
  if (progress >= 1) active = plan.waypoints.length - 1;
  document.querySelectorAll("#waypointTable tr").forEach(function (tr, i) {
    tr.classList.toggle("wp-active", i === active && progress > 0);
  });
}

function render() {
  draw();
  updateReadouts();
}

function stopRover() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
}

function tick(now) {
  progress = Math.min(1, progress + (now - lastTick) / TRAVERSE_MS * speed);
  lastTick = now;
  render();
  if (progress >= 1) {
    raf = null;
    playBtn.textContent = "Replay";
  } else {
    raf = requestAnimationFrame(tick);
  }
}

// Wired to the Play button: starts, pauses, resumes, or replays a finished run
function playTraverse() {
  if (raf) {
    stopRover();
    playBtn.textContent = "Resume";
    return;
  }
  progress = startProgress(progress);
  lastTick = performance.now();
  playBtn.textContent = "Pause";
  // Brings the controls, canvas and readouts into view together when the page sits above them
  const bottom = document.querySelector(".traverse-hud").getBoundingClientRect().bottom;
  if (bottom > window.innerHeight) document.querySelector(".traverse-controls").scrollIntoView({ behavior: "smooth", block: "start" });
  raf = requestAnimationFrame(tick);
}

// Wired to the Reset button: puts the rover back at the base station
function resetTraverse() {
  stopRover();
  progress = 0;
  playBtn.textContent = "Play";
  render();
}

// ---- Waypoint Plan table and the planned-route card ----
function renderTable() {
  document.getElementById("waypointTable").replaceChildren(...plan.waypoints.map(function (w, i) {
    return h("tr", null, h("td", null, String(i + 1)), h("td", null, w.type), h("td", null, w.distance.toLocaleString()),
      h("td", null, String(w.slope)), h("td", null, w.hazard), h("td", null, w.boulders));
  }));
}

function renderRouteInfo() {
  const r = plan.route;
  document.getElementById("routeFlag").hidden = !!r;
  document.getElementById("hudDifficulty").textContent = r ? r.difficulty : "No planned route";
  document.getElementById("routeInfo").replaceChildren(r
    ? h("p", { class: "subtext" }, Number(r.distanceKm) + " km, steepest cell " + Number(r.maxSlopeDeg) + "°, difficulty ", h("strong", null, r.difficulty),
        ". The waypoint table and rover follow this route (boulders: no data). A* over the 80 m LOLA slope from a placeholder base, not a rover-qualified plan.")
    : h("p", { class: "subtext" }, "No planned route for this site (none computed yet, or the crater walls exceed the 30° rover slope limit). The dashed line is the straight path from the base, shown for scale only: it is not a drivable plan."));
}

function applySite(site) {
  currentSite = site;
  plan = buildPlan(site);
  stopRover();
  progress = 0;
  playBtn.textContent = "Play";
  fitCanvas();
  renderTable();
  renderRouteInfo();
  render();
}

const speedRange = document.getElementById("speedRange");
speedRange.addEventListener("input", function () {
  speed = Number(speedRange.value);
  document.getElementById("speedLabel").textContent = speed.toFixed(1) + "×";
});

window.addEventListener("resize", function () {
  if (!plan) return;
  fitCanvas();
  render();
});

// Routes load once, so switching site afterwards is immediate. With no routes at all the straight line still works.
statusText.textContent = "loading route...";
loadRoutes().catch(function () { return []; }).then(function (list) {
  routes = list;
  playBtn.disabled = false;
  applySite(currentSite);
});
