const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const landerX = canvas.width / 2;
const landerY = canvas.height / 2;
const tooltip = document.getElementById("mapTooltip");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let selected = null;
let hovered = null;
let sweepAngle = 0;
let pulsePhase = 0;

function toPixel(site) {
  return {
    px: (site.x / 100) * canvas.width,
    py: (site.y / 100) * canvas.height
  };
}

function drawLabel(text, x, y, color) {
  ctx.font = "11px 'JetBrains Mono', Consolas, monospace";
  const w = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(5, 8, 16, 0.72)";
  ctx.fillRect(x - 4, y - 12, w + 8, 16);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawSiteLabel(text, p, color, placed) {
  ctx.font = "11px 'JetBrains Mono', Consolas, monospace";
  const w = ctx.measureText(text).width + 8, h = 16;
  const spots = [[p.px + 10, p.py - 8], [p.px + 10, p.py + 20], [p.px - w - 8, p.py - 8], [p.px - w - 8, p.py + 20], [p.px - w / 2, p.py - 22], [p.px - w / 2, p.py + 32]];
  const fits = function (s) {
    const box = { l: s[0] - 4, r: s[0] - 4 + w, t: s[1] - 12, b: s[1] - 12 + h };
    return box.l >= 0 && box.r <= canvas.width && box.t >= 0 && box.b <= canvas.height &&
      placed.every(function (o) { return box.r < o.l || box.l > o.r || box.b < o.t || box.t > o.b; }) ? box : null;
  };
  const spot = spots.find(fits) || spots[0];
  placed.push(fits(spot) || { l: spot[0] - 4, r: spot[0] - 4 + w, t: spot[1] - 12, b: spot[1] - 12 + h });
  drawLabel(text, spot[0], spot[1], color);
}

function hazardFillColor(h) {
  if (h < 30) return "rgba(74, 222, 128, 0.18)";
  if (h < 50) return "rgba(251, 191, 36, 0.18)";
  return "rgba(248, 113, 113, 0.22)";
}

function drawSweep(angle) {
  const maxR = 300;
  const width = Math.PI / 5;
  const grad = ctx.createRadialGradient(landerX, landerY, 0, landerX, landerY, maxR);
  grad.addColorStop(0, "rgba(125, 211, 252, 0.22)");
  grad.addColorStop(1, "rgba(125, 211, 252, 0)");

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(landerX, landerY);
  ctx.arc(landerX, landerY, maxR, angle - width / 2, angle + width / 2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#1c2230";
  for (let r = 60; r < 320; r += 60) {
    ctx.beginPath();
    ctx.arc(landerX, landerY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!reduceMotion) drawSweep(sweepAngle);

  siteData.forEach(function (site) {
    const p = toPixel(site);
    const radius = 14 + ((site.terrainHazard || 0) / 100) * 32;
    ctx.fillStyle = hazardFillColor(site.terrainHazard || 0);
    ctx.beginPath();
    ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(landerX, landerY, 6, 0, Math.PI * 2);
  ctx.fill();
  drawLabel("base station", landerX + 10, landerY + 20, "#a8b0c0");

  const placed = [{ l: landerX + 6, r: landerX + 100, t: landerY + 8, b: landerY + 24 }];
  siteData.forEach(function (site) {
    const p = toPixel(site);
    const isHovered = hovered === site;

    ctx.fillStyle = classColor(site.classification);
    ctx.beginPath();
    ctx.arc(p.px, p.py, isHovered ? 10 : 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0b0e14";
    ctx.lineWidth = 2;
    ctx.stroke();

    drawSiteLabel(site.label, p, isHovered ? "#ffffff" : "#e6e9ef", placed);
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

    const pulse = reduceMotion ? 0 : Math.sin(pulsePhase) * 3;
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.px - 12 - pulse, p.py - 12 - pulse, 24 + pulse * 2, 24 + pulse * 2);
  }
}

function findSiteNear(mx, my) {
  let closest = null;
  let closestDist = 18;

  siteData.forEach(function (site) {
    const p = toPixel(site);
    const d = Math.sqrt((p.px - mx) * (p.px - mx) + (p.py - my) * (p.py - my));
    if (d < closestDist) {
      closest = site;
      closestDist = d;
    }
  });
  return closest;
}

canvas.addEventListener("click", function (e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const closest = findSiteNear(mx, my);

  if (closest) {
    selected = closest;
    draw();
    showInfo(closest);
  }
});

canvas.addEventListener("mousemove", function (e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const closest = findSiteNear(mx, my);

  if (closest !== hovered) {
    hovered = closest;
    canvas.style.cursor = closest ? "pointer" : "default";
    if (closest) {
      const p = toPixel(closest);
      tooltip.replaceChildren(
        h("span", { class: "t-name" }, closest.label), " \u00b7 " + closest.crater, h("br"),
        "hazard " + (closest.terrainHazard == null ? "n/a" : closest.terrainHazard + "%") + " \u00b7 " + closest.classification);
      tooltip.style.left = (p.px / canvas.width * 100) + "%";
      tooltip.style.top = (p.py / canvas.height * 100) + "%";
      tooltip.classList.add("visible");
    } else {
      tooltip.classList.remove("visible");
    }
    if (reduceMotion) draw();
  }
});

canvas.addEventListener("mouseleave", function () {
  hovered = null;
  tooltip.classList.remove("visible");
  if (reduceMotion) draw();
});

function showInfo(site) {
  const offset = Math.sqrt(Math.pow(site.x - 50, 2) + Math.pow(site.y - 50, 2));
  const distText = site.posFromCoords ? Math.round(offset / 40 * 300) + " km" : Math.round(offset * 3) + " m";

  const heading = document.createElement("h3");
  heading.textContent = site.label + " - " + site.crater;

  const classP = document.createElement("p");
  classP.append("Classification: ");
  const badge = document.createElement("span");
  badge.className = "badge " + classificationClass(site.classification);
  badge.textContent = site.classification;
  classP.appendChild(badge);
  classP.insertAdjacentHTML("beforeend", provBadge(site.provenance));

  const hazardP = document.createElement("p");
  hazardP.className = "subtext";
  hazardP.textContent = "Terrain hazard: " + (site.terrainHazard == null ? "n/a" : site.terrainHazard + "%") + " | Boulder count (optical): " + (site.boulderCount == null ? "n/a" : site.boulderCount);

  const distP = document.createElement("p");
  distP.className = "subtext";
  distP.textContent = "Estimated distance from base station: " + distText;

  const evidenceLink = document.createElement("a");
  evidenceLink.className = "back-link";
  evidenceLink.href = "site.html?id=" + encodeURIComponent(site.id);
  evidenceLink.textContent = "view full evidence →";

  const traverseLink = document.createElement("a");
  traverseLink.className = "back-link";
  traverseLink.href = "traverse.html?id=" + encodeURIComponent(site.id);
  traverseLink.textContent = "simulate rover traverse →";

  document.getElementById("infoCard").replaceChildren(
    heading, classP, hazardP, distP, evidenceLink, document.createElement("br"), traverseLink
  );
}

if (reduceMotion) {
  draw();
} else {
  (function animate() {
    sweepAngle += 0.012;
    pulsePhase += 0.12;
    draw();
    requestAnimationFrame(animate);
  })();
}
