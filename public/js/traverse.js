const params = new URLSearchParams(window.location.search);
const currentSite = getSiteById(params.get("id")) || siteData[0];

const select = document.getElementById("siteSelect");
siteData.forEach(function (s) {
  const opt = document.createElement("option");
  opt.value = s.id;
  opt.textContent = s.label + " - " + s.crater;
  if (s.id === currentSite.id) opt.selected = true;
  select.appendChild(opt);
});

function changeSite(id) {
  window.location.href = "traverse.html?id=" + id;
}

const canvas = document.getElementById("traverseCanvas");
const ctx = canvas.getContext("2d");
const baseX = canvas.width / 2;
const baseY = canvas.height / 2;

function toPixel(site) {
  return {
    px: (site.x / 100) * canvas.width,
    py: (site.y / 100) * canvas.height
  };
}

function hazardBucket(h) {
  if (h < 30) return "Low";
  if (h < 50) return "Medium";
  return "High";
}

const stepFractions = [0.2, 0.4, 0.6, 0.8, 1.0];
const targetPixel = toPixel(currentSite);
const totalDist = Math.round(Math.sqrt(
  Math.pow(currentSite.x - 50, 2) + Math.pow(currentSite.y - 50, 2)
) * 3);

const waypoints = stepFractions.map(function (frac, i) {
  const type = i === 4 ? "Ice Target" : (i === 2 && currentSite.terrainHazard >= 40 ? "Hazard Zone" : (i === 0 ? "Entry Point" : "Nav Node"));
  const prevFrac = i === 0 ? 0 : stepFractions[i - 1];
  return {
    px: baseX + (targetPixel.px - baseX) * frac,
    py: baseY + (targetPixel.py - baseY) * frac,
    type: type,
    fracFrom: prevFrac,
    fracTo: frac,
    distance: Math.round(totalDist * (frac - prevFrac)),
    slope: Math.round((currentSite.terrainHazard / 100) * 30 + i * 2),
    hazard: hazardBucket(currentSite.terrainHazard * (0.5 + 0.5 * frac)),
    boulders: Math.round(currentSite.boulderCount * frac)
  };
});

function waypointColor(type) {
  if (type === "Hazard Zone") return "#f87171";
  if (type === "Ice Target") return "#4ade80";
  return "#7dd3fc";
}

let progress = 0;
let timer = null;

function drawBackground() {
  ctx.strokeStyle = "#1c2230";
  for (let r = 60; r < 340; r += 60) {
    ctx.beginPath();
    ctx.arc(baseX, baseY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(baseX, baseY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a8b0c0";
  ctx.font = "11px Consolas";
  ctx.fillText("base station", baseX + 12, baseY + 4);

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

  waypoints.forEach(function (w, i) {
    ctx.fillStyle = waypointColor(w.type);
    ctx.beginPath();
    ctx.arc(w.px, w.py, w.type === "Ice Target" ? 9 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6e9ef";
    ctx.font = "11px Consolas";
    ctx.fillText(String(i + 1), w.px + 8, w.py - 8);
  });

  const rx = baseX + (targetPixel.px - baseX) * progress;
  const ry = baseY + (targetPixel.py - baseY) * progress;
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(rx, ry, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0b0e14";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function statusForProgress(p) {
  if (p <= 0) return "rover parked at base station";
  for (let i = 0; i < waypoints.length; i++) {
    if (p <= waypoints[i].fracTo + 0.0001) {
      return p >= 1 ? "arrived at " + waypoints[i].type : "en route to " + waypoints[i].type;
    }
  }
  return "arrived at Ice Target";
}

function playTraverse() {
  if (timer) return;
  document.getElementById("playBtn").disabled = true;

  timer = setInterval(function () {
    progress += 0.01;
    if (progress >= 1) {
      progress = 1;
      draw();
      document.getElementById("statusText").textContent = statusForProgress(progress);
      clearInterval(timer);
      timer = null;
      document.getElementById("playBtn").disabled = false;
      return;
    }
    draw();
    document.getElementById("statusText").textContent = statusForProgress(progress);
  }, 50);
}

function resetTraverse() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  progress = 0;
  draw();
  document.getElementById("statusText").textContent = "rover parked at base station";
  document.getElementById("playBtn").disabled = false;
}

let rows = "";
waypoints.forEach(function (w, i) {
  rows += "<tr><td>" + (i + 1) + "</td><td>" + w.type + "</td><td>" + w.distance +
    "</td><td>" + w.slope + "</td><td>" + w.hazard + "</td><td>" + w.boulders + "</td></tr>";
});
document.getElementById("waypointTable").innerHTML = rows;

draw();
