// Powers map.html: draws the whole orbital map (base station, radar sweep, hazard shading,
// site markers, selection line) onto the <canvas id="mapCanvas">, and handles hover/click.

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const landerX = canvas.width / 2; // base station is always drawn at the canvas center
const landerY = canvas.height / 2;
const tooltip = document.getElementById("mapTooltip");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let selected = null;
let hovered = null;
let sweepAngle = 0;
let pulsePhase = 0;

// Converts a site's 0-100 x/y percentage (in js/data.js) into actual canvas pixel coordinates
function toPixel(site) {
  return {
    px: (site.x / 100) * canvas.width,
    py: (site.y / 100) * canvas.height
  };
}

// Green/yellow/red translucent glow drawn under each site marker, sized by that site's hazard score
function hazardFillColor(h) {
  if (h < 30) return "rgba(74, 222, 128, 0.18)";
  if (h < 50) return "rgba(251, 191, 36, 0.18)";
  return "rgba(248, 113, 113, 0.22)";
}

// Draws the rotating radar "sweep" wedge that fans out from the base station (purely decorative)
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

// The main render function: clears and redraws the entire map every frame (rings, sweep, hazard
// glow, base station, every site marker + label, and the dashed line to the selected site)
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

// Given a mouse position (canvas pixels), finds the nearest site marker within click/hover range
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

// Clicking a marker selects it (draws the dashed line + pulsing box) and fills in the #infoCard below the map
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

// Hovering a marker shows the floating #mapTooltip with the site's name/crater/hazard/classification
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
      tooltip.innerHTML = '<span class="t-name">' + closest.label + '</span> &middot; ' + closest.crater +
        '<br>hazard ' + closest.terrainHazard + '% &middot; ' + closest.classification;
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

// Builds the detail panel below the map (#infoCard) for the clicked site, with links to
// the full Site Detail page and to the Traverse simulation for that site
function showInfo(site) {
  const dist = Math.round(Math.sqrt(
    Math.pow(site.x - 50, 2) + Math.pow(site.y - 50, 2)
  ) * 3);

  const heading = document.createElement("h3");
  heading.textContent = site.label + " - " + site.crater;

  const classP = document.createElement("p");
  classP.append("Classification: ");
  const badge = document.createElement("span");
  badge.className = "badge " + classificationClass(site.classification);
  badge.textContent = site.classification;
  classP.appendChild(badge);

  const hazardP = document.createElement("p");
  hazardP.className = "subtext";
  hazardP.textContent = "Terrain hazard: " + site.terrainHazard + "% | Boulder count (optical): " + site.boulderCount;

  const distP = document.createElement("p");
  distP.className = "subtext";
  distP.textContent = "Estimated distance from base station: " + dist + " m";

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

// Kick off the animation loop (radar sweep rotation + selection pulse), unless the user prefers reduced motion
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
