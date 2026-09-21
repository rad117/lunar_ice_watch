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
    const radius = 14 + (site.terrainHazard / 100) * 32;
    ctx.fillStyle = hazardFillColor(site.terrainHazard);
    ctx.beginPath();
    ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(landerX, landerY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a8b0c0";
  ctx.font = "11px 'JetBrains Mono', Consolas, monospace";
  ctx.fillText("base station", landerX + 10, landerY + 4);

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

    ctx.fillStyle = isHovered ? "#ffffff" : "#e6e9ef";
    ctx.font = "11px 'JetBrains Mono', Consolas, monospace";
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
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const closest = findSiteNear(mx, my);

  if (closest) {
    selected = closest;
    draw();
    showInfo(closest);
  }
});

canvas.addEventListener("mousemove", function (e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const closest = findSiteNear(mx, my);

  if (closest !== hovered) {
    hovered = closest;
    canvas.style.cursor = closest ? "pointer" : "default";
    if (closest) {
      const p = toPixel(closest);
      tooltip.innerHTML = '<span class="t-name">' + closest.label + '</span> &middot; ' + closest.crater +
        '<br>hazard ' + closest.terrainHazard + '% &middot; ' + closest.classification;
      tooltip.style.left = p.px + "px";
      tooltip.style.top = p.py + "px";
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
