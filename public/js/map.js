const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const landerX = canvas.width / 2;
const landerY = canvas.height / 2;

let selected = null;

function toPixel(site) {
  return {
    px: (site.x / 100) * canvas.width,
    py: (site.y / 100) * canvas.height
  };
}

function hazardColor(h) {
  if (h < 30) return "rgba(74, 222, 128, 0.18)";
  if (h < 50) return "rgba(251, 191, 36, 0.18)";
  return "rgba(248, 113, 113, 0.22)";
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#1c2230";
  for (let r = 60; r < 320; r += 60) {
    ctx.beginPath();
    ctx.arc(landerX, landerY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  siteData.forEach(function (site) {
    const p = toPixel(site);
    const radius = 14 + (site.terrainHazard / 100) * 32;
    ctx.fillStyle = hazardColor(site.terrainHazard);
    ctx.beginPath();
    ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(landerX, landerY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a8b0c0";
  ctx.font = "11px Consolas";
  ctx.fillText("base station", landerX + 10, landerY + 4);

  siteData.forEach(function (site) {
    const p = toPixel(site);
    ctx.fillStyle = classColor(site.classification);
    ctx.beginPath();
    ctx.arc(p.px, p.py, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0b0e14";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#e6e9ef";
    ctx.font = "11px Consolas";
    ctx.fillText(site.label, p.px + 10, p.py - 8);
  });

  if (selected) {
    const p = toPixel(selected);

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(landerX, landerY);
    ctx.lineTo(p.px, p.py);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.px - 12, p.py - 12, 24, 24);
  }
}

canvas.addEventListener("click", function (e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  let closest = null;
  let closestDist = 999;

  siteData.forEach(function (site) {
    const p = toPixel(site);
    const d = Math.sqrt((p.px - mx) * (p.px - mx) + (p.py - my) * (p.py - my));
    if (d < 18 && d < closestDist) {
      closest = site;
      closestDist = d;
    }
  });

  if (closest) {
    selected = closest;
    draw();
    showInfo(closest);
  }
});

function showInfo(site) {
  const dist = Math.round(Math.sqrt(
    Math.pow(site.x - 50, 2) + Math.pow(site.y - 50, 2)
  ) * 3);

  document.getElementById("infoCard").innerHTML =
    "<h3>" + site.label + " - " + site.crater + "</h3>" +
    "<p>Classification: <span class=\"badge\" style=\"background:" + classColor(site.classification) + "\">" + site.classification + "</span></p>" +
    "<p class=\"subtext\">Terrain hazard: " + site.terrainHazard + "% | Boulder count (optical): " + site.boulderCount + "</p>" +
    "<p class=\"subtext\">Estimated distance from base station: " + dist + " m</p>" +
    "<a class=\"back-link\" href=\"site.html?id=" + site.id + "\">view full evidence &rarr;</a><br>" +
    "<a class=\"back-link\" href=\"traverse.html?id=" + site.id + "\">simulate rover traverse &rarr;</a>";
}

draw();
