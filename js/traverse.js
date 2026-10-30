// Powers traverse.html: builds a straight-line route from the base station to the chosen site,
// splits it into 5 waypoints, draws it on the canvas, and animates the rover moving along it.

// Read which site to simulate from the URL (set by the dropdown below, or a "simulate traverse" link elsewhere)
const params = new URLSearchParams(window.location.search);
const currentSite = getSiteById(params.get("id")) || siteData[0];

// ---- "Target site" dropdown (#siteSelect) ----
const select = document.getElementById("siteSelect");
siteData.forEach(function (s) {
  const opt = document.createElement("option");
  opt.value = s.id;
  opt.textContent = s.label + " - " + s.crater;
  if (s.id === currentSite.id) opt.selected = true;
  select.appendChild(opt);
});

// Reloads the page targeting the newly picked site (simplest way to rebuild the whole route)
function changeSite(id) {
  window.location.href = "traverse.html?id=" + id;
}

const canvas = document.getElementById("traverseCanvas");
const ctx = canvas.getContext("2d");
const baseX = canvas.width / 2; // base station is always drawn at canvas center
const baseY = canvas.height / 2;

function toPixel(site) {
  return {
    px: (site.x / 100) * canvas.width,
    py: (site.y / 100) * canvas.height
  };
}

// Draws canvas text with a translucent backing rect so labels stay legible when the base station
// and a waypoint land close together (mirrors the same helper in js/map.js).
function drawLabel(text, x, y, color) {
  ctx.font = "11px Consolas";
  const w = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(5, 8, 16, 0.72)";
  ctx.fillRect(x - 4, y - 12, w + 8, 16);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function hazardBucket(h) {
  if (h < 30) return "Low";
  if (h < 50) return "Medium";
  return "High";
}

// ---- "Waypoint Plan" table (#waypointTable): 5 evenly-spaced points along the straight-line route ----
const stepFractions = [0.2, 0.4, 0.6, 0.8, 1.0];
const targetPixel = toPixel(currentSite);
const totalDist = Math.round(Math.sqrt(
  Math.pow(currentSite.x - 50, 2) + Math.pow(currentSite.y - 50, 2)
) * 3);

let waypoints = stepFractions.map(function (frac, i) {
  const type = i === 4 ? "Ice Target" : (i === 2 && (currentSite.terrainHazard || 0) >= 40 ? "Hazard Zone" : (i === 0 ? "Entry Point" : "Nav Node"));
  const prevFrac = i === 0 ? 0 : stepFractions[i - 1];
  return {
    px: baseX + (targetPixel.px - baseX) * frac,
    py: baseY + (targetPixel.py - baseY) * frac,
    type: type,
    fracFrom: prevFrac,
    fracTo: frac,
    distance: Math.round(totalDist * (frac - prevFrac)),
    slope: Math.round(((currentSite.terrainHazard || 0) / 100) * 30 + i * 2),
    hazard: hazardBucket((currentSite.terrainHazard || 0) * (0.5 + 0.5 * frac)),
    boulders: Math.round((currentSite.boulderCount || 0) * frac)
  };
});

function waypointColor(type) {
  if (type === "Hazard Zone") return "#f87171";
  if (type === "Ice Target") return "#4ade80";
  return "#7dd3fc";
}

let plannedRoute = null;
let routePts = null; // planned route as [{px, py, cum}] with cum = fraction of total length

const toCanvas = function (c) { const p = polarPercent(c[1], c[0]); return { px: (p.x / 100) * canvas.width, py: (p.y / 100) * canvas.height }; };

// great-circle km on the Moon
function legKm(a, b) {
  const r = Math.PI / 180, h = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 2 * 1737.4 * Math.asin(Math.sqrt(h));
}

// Hazard tiers follow VIPER: <=15 deg operational (Low), <=25 extended (Medium), above that slip risk (High).
// 5 waypoints at equal distances along the real route; slope = steepest planning cell in each leg (from the pipeline), hazard from that slope.
// Boulder counts are not measured by any dataset yet, so they show "n/a".
function buildPlanned(route) {
  const co = route.path.coordinates, sl = route.slopes;
  const cumKm = [0];
  for (let i = 1; i < co.length; i++) cumKm.push(cumKm[i - 1] + legKm(co[i - 1], co[i]));
  const total = cumKm[cumKm.length - 1];
  routePts = co.map(function (c, i) { return Object.assign(toCanvas(c), { cum: cumKm[i] / total }); });
  let from = 0, prevIdx = 0;
  return stepFractions.map(function (frac, k) {
    let idx = co.length - 1;
    for (let i = prevIdx; i < co.length; i++) if (cumKm[i] / total >= frac - 1e-9) { idx = i; break; }
    const worst = sl ? Math.max.apply(null, sl.slice(prevIdx, idx + 1)) : null;
    const hazard = worst == null ? "n/a" : worst <= 15 ? "Low" : worst <= 25 ? "Medium" : "High";
    const w = {
      px: routePts[idx].px, py: routePts[idx].py,
      type: k === 4 ? "Ice Target" : hazard === "High" ? "Hazard Zone" : k === 0 ? "Entry Point" : "Nav Node",
      fracFrom: from, fracTo: frac,
      distance: Math.round((cumKm[idx] - cumKm[prevIdx]) * 1000), slope: worst == null ? "n/a" : Math.round(worst), hazard: hazard, boulders: "n/a"
    };
    from = frac; prevIdx = idx;
    return w;
  });
}

// Rover position at progress 0..1: along the real route when there is one, else the straight line from the base
function roverPos(p) {
  if (!routePts) return { px: baseX + (targetPixel.px - baseX) * p, py: baseY + (targetPixel.py - baseY) * p };
  let i = 1;
  while (i < routePts.length - 1 && routePts[i].cum < p) i++;
  const a = routePts[i - 1], b = routePts[i], t = b.cum === a.cum ? 0 : Math.min(1, Math.max(0, (p - a.cum) / (b.cum - a.cum)));
  return { px: a.px + (b.px - a.px) * t, py: a.py + (b.py - a.py) * t };
}

// progress: 0 (at base) to 1 (arrived at target); timer drives the Play animation
let progress = 0;
let timer = null;
let speed = 1;

const speedRange = document.getElementById("speedRange");
speedRange.addEventListener("input", function () {
  speed = Number(speedRange.value);
  document.getElementById("speedLabel").textContent = speed.toFixed(1) + "×";
});

function drawBackground() {
  ctx.strokeStyle = "#1c2230";
  for (let r = 60; r < 340; r += 60) {
    ctx.beginPath();
    ctx.arc(baseX, baseY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Redraws the canvas: base station, dashed route line, every waypoint dot, and the rover's current position
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  const bx = routePts ? routePts[0].px : baseX, by = routePts ? routePts[0].py : baseY;
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(bx, by, 7, 0, Math.PI * 2);
  ctx.fill();
  drawLabel("base station", bx + 12, by + 20, "#a8b0c0");

  if (!routePts) {
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#7dd3fc";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  waypoints.forEach(function (w) {
    ctx.lineTo(w.px, w.py);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  }

  waypoints.forEach(function (w, i) {
    ctx.fillStyle = waypointColor(w.type);
    ctx.beginPath();
    ctx.arc(w.px, w.py, w.type === "Ice Target" ? 9 : 5, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(String(i + 1), w.px + 8, w.py - 8, "#e6e9ef");
  });

  if (plannedRoute) {  // real A* path over LOLA slope (pipeline/route.py), same polar-percent mapping as the site dots
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    plannedRoute.path.coordinates.forEach(function (c, i) {
      const p = polarPercent(c[1], c[0]);
      ctx[i ? "lineTo" : "moveTo"]((p.x / 100) * canvas.width, (p.y / 100) * canvas.height);
    });
    ctx.stroke();
  }

  const rp = roverPos(progress), rx = rp.px, ry = rp.py;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(rx, ry, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0b0e14";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Text shown in #statusText (e.g. "en route to Nav Node", "arrived at Ice Target")
function statusForProgress(p) {
  if (p <= 0) return "rover parked at base station";
  for (let i = 0; i < waypoints.length; i++) {
    if (p <= waypoints[i].fracTo + 0.0001) {
      return p >= 1 ? "arrived at " + waypoints[i].type : "en route to " + waypoints[i].type;
    }
  }
  return "arrived at Ice Target";
}

// Adds the "wp-active" highlight to the current waypoint's row in the table below the canvas
function highlightActiveRow() {
  let activeIndex = -1;
  for (let i = 0; i < waypoints.length; i++) {
    if (progress <= waypoints[i].fracTo + 0.0001) {
      activeIndex = i;
      break;
    }
  }
  if (progress >= 1) activeIndex = waypoints.length - 1;

  document.querySelectorAll("#waypointTable tr").forEach(function (tr, i) {
    tr.classList.toggle("wp-active", i === activeIndex && progress > 0);
  });
}

// Wired to the "Play" button: advances progress on a timer until the rover reaches the target
function playTraverse() {
  if (timer) return;
  document.getElementById("playBtn").disabled = true;

  timer = setInterval(function () {
    progress += 0.01 * speed;
    if (progress >= 1) {
      progress = 1;
      draw();
      highlightActiveRow();
      document.getElementById("statusText").textContent = statusForProgress(progress);
      clearInterval(timer);
      timer = null;
      document.getElementById("playBtn").disabled = false;
      return;
    }
    draw();
    highlightActiveRow();
    document.getElementById("statusText").textContent = statusForProgress(progress);
  }, 50);
}

// Wired to the "Reset" button: stops any running animation and puts the rover back at the base station
function resetTraverse() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  progress = 0;
  draw();
  highlightActiveRow();
  document.getElementById("statusText").textContent = "rover parked at base station";
  document.getElementById("playBtn").disabled = false;
}

// Initial fill of the waypoint table and first draw of the map when the page loads
function renderTable() {
  let rows = "";
  waypoints.forEach(function (w, i) {
    rows += "<tr><td>" + (i + 1) + "</td><td>" + w.type + "</td><td>" + w.distance.toLocaleString() +
      "</td><td>" + w.slope + "</td><td>" + w.hazard + "</td><td>" + w.boulders + "</td></tr>";
  });
  document.getElementById("waypointTable").innerHTML = rows;
}
renderTable();

draw();

// Planned route card: loaded after the first draw so the page never waits on it. The waypoint table above is still the simulated straight line.
fetch("/api/routes?siteId=" + encodeURIComponent(currentSite.id)).then(function (r) { return r.ok ? r.json() : []; }).then(function (routes) {
  plannedRoute = routes.find(function (r) { return r.planner === "astar-lola-v1"; }) || null;
  if (plannedRoute && Array.isArray(plannedRoute.slopes) && plannedRoute.slopes.length === plannedRoute.path.coordinates.length) {
    waypoints = buildPlanned(plannedRoute);
    renderTable();
  } else if (plannedRoute) { routePts = null; }
  const card = document.createElement("div");
  card.className = "card";
  card.append(h("h3", null, "Planned route (LOLA terrain)"), plannedRoute
    ? h("p", { class: "subtext" }, Number(plannedRoute.distanceKm) + " km, steepest cell " + Number(plannedRoute.maxSlopeDeg) + "\u00b0, difficulty ", h("strong", null, plannedRoute.difficulty),
        " (green line). The waypoint table and rover follow this route (boulders: no data). A* over the 80 m LOLA slope from a placeholder base, not a rover-qualified plan.")
    : h("p", { class: "subtext" }, "No planned route for this site (none computed yet, or the crater walls exceed the rover slope limit)."));
  document.querySelector("main .card:last-of-type").after(card);
  draw();
}).catch(function () {});
