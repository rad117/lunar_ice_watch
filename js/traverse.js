const TRAVERSE_MS = 6000;
const LINE_POINTS = 21;
const stepFractions = [0.2, 0.4, 0.6, 0.8, 1.0];

const params = new URLSearchParams(window.location.search);
const select = document.getElementById("siteSelect");
const canvas = document.getElementById("traverseCanvas");
const ctx = canvas.getContext("2d");
const playBtn = document.getElementById("playBtn");
const statusText = document.getElementById("statusText");

let currentSite = getSiteById(params.get("id")) || siteData[0];
let routes = [];
let plan = null;
let view = null;
let width = 0, height = 0;

let progress = 0;
let raf = null;
let lastTick = 0;
let speed = 1;

siteData.forEach(function (s) {
  const opt = document.createElement("option");
  opt.value = s.id;
  opt.textContent = s.label + " - " + s.crater;
  if (s.id === currentSite.id) opt.selected = true;
  select.appendChild(opt);
});

function changeSite(id) {
  try { history.replaceState(null, "", "?id=" + encodeURIComponent(id)); } catch (e) {  }
  applySite(getSiteById(id));
}

function legKm(a, b) {
  const r = Math.PI / 180, h = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 2 * 1737.4 * Math.asin(Math.sqrt(h));
}

function slopeHazard(slope) {
  return slope <= 15 ? "Low" : slope <= 25 ? "Medium" : "High";
}

function siteHazard(site) {
  const s = site.terrainHazard;
  return s == null ? "n/a" : s < 30 ? "Low" : s < 50 ? "Medium" : "High";
}

function slopeColor(slope) {
  if (slope == null) return "#ffb454";
  return slope <= 15 ? "#4ade80" : slope <= 25 ? "#fbbf24" : "#f87171";
}

function segmentColor(i) {
  const a = plan.points[i - 1].slope, b = plan.points[i].slope;
  return slopeColor(a == null || b == null ? null : Math.max(a, b));
}

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

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  width = canvas.parentElement.clientWidth;
  height = Math.round(Math.max(280, Math.min(width * 0.52, window.innerHeight - 300)));
  canvas.style.height = height + "px";
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view = fitView(plan.points, width, height, width < 520 ? 44 : 72);
}

function drawLabel(text, x, y, color) {
  ctx.font = "12px 'JetBrains Mono', Consolas, monospace";
  const w = ctx.measureText(text).width;
  const left = Math.max(6, Math.min(x, width - w - 10));
  ctx.fillStyle = "rgba(5, 8, 16, 0.78)";
  ctx.fillRect(left - 5, y - 14, w + 10, 19);
  ctx.fillStyle = color;
  ctx.fillText(text, left, y);
}

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

function statusForProgress(p) {
  if (p <= 0) return "rover parked at base station";
  if (p >= 1) return "arrived at Ice Target";
  const w = plan.waypoints.find(function (x) { return p <= x.fracTo + 0.0001; });
  return "en route to " + w.type;
}

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

function playTraverse() {
  if (raf) {
    stopRover();
    playBtn.textContent = "Resume";
    return;
  }
  progress = startProgress(progress);
  lastTick = performance.now();
  playBtn.textContent = "Pause";
  const bottom = document.querySelector(".traverse-hud").getBoundingClientRect().bottom;
  if (bottom > window.innerHeight) document.querySelector(".traverse-controls").scrollIntoView({ behavior: "smooth", block: "start" });
  raf = requestAnimationFrame(tick);
}

function resetTraverse() {
  stopRover();
  progress = 0;
  playBtn.textContent = "Play";
  render();
}

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

statusText.textContent = "loading route...";
loadRoutes().catch(function () { return []; }).then(function (list) {
  routes = list;
  playBtn.disabled = false;
  applySite(currentSite);
});
