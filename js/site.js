// Powers site.html (the "Candidate Evidence" detail page). Reads ?id=... from the URL
// (set by dashboard.js/map.js when a site is clicked) and fills in every panel on the page.

// Page title + subtitle at the top
const params = new URLSearchParams(window.location.search);
const site = getSiteById(params.get("id")) || siteData[0];

document.getElementById("siteTitle").textContent = site.label;
document.getElementById("siteSub").textContent = site.crater;

// ---- "Radar Metrics" card: builds one animated bar per metric (#metricsBox) ----
const metrics = [
  { name: "Pv", val: site.pv },
  { name: "CPR", val: site.cpr },
  { name: "SERD", val: site.serd },
  { name: "T-Ratio", val: site.tRatio }
];

let metricsHtml = "";
metrics.forEach(function (m, i) {
  const pct = Math.min(100, Math.round(m.val * 60));
  metricsHtml += '<div class="metric-row">' +
    '<div class="metric-label">' + m.name + '</div>' +
    '<div class="metric-bar-bg"><div class="metric-bar-fill" data-pct="' + pct + '" style="transition-delay:' + (i * 90) + 'ms"></div></div>' +
    '<div class="metric-val">' + m.val + '</div>' +
    '</div>';
});
document.getElementById("metricsBox").innerHTML = metricsHtml;

requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    document.querySelectorAll(".metric-bar-fill").forEach(function (bar) {
      bar.style.width = bar.dataset.pct + "%";
    });
  });
});

// ---- "Gates & Flags" card: thermal gate pill + alt-explanation flag pill + boulder count ----
const thermalPill = document.getElementById("thermalPill");
thermalPill.textContent = site.thermalGate.toUpperCase();
thermalPill.className = "pill " + (site.thermalGate === "pass" ? "pass" : "fail");
document.getElementById("thermalTempText").textContent = "measured temp: " + site.thermalTemp + " K";

const altPill = document.getElementById("altPill");
altPill.textContent = site.altFlag ? "FLAGGED" : "CLEAR";
altPill.className = "pill " + (site.altFlag ? "flagged" : "clear");
document.getElementById("altNoteText").textContent = site.altNote;

document.getElementById("boulderText").textContent = site.boulderCount;

// The circular hazard gauge (an SVG ring whose stroke-dasharray is animated to "fill up" to the hazard %)
const gaugeColor = hazardLevelColor(site.terrainHazard);
const gaugeRadius = 30;
const gaugeCircumference = 2 * Math.PI * gaugeRadius;
document.getElementById("hazardGauge").innerHTML =
  '<svg width="76" height="76" viewBox="0 0 76 76">' +
  '<circle class="gauge-track" cx="38" cy="38" r="' + gaugeRadius + '"></circle>' +
  '<circle class="gauge-fill" id="gaugeFill" cx="38" cy="38" r="' + gaugeRadius + '" stroke="' + gaugeColor + '"></circle>' +
  '</svg>' +
  '<div class="gauge-label"><span class="big" style="color:' + gaugeColor + '">' + site.terrainHazard + '%</span><span class="small">Terrain hazard</span></div>';

requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    const dash = (site.terrainHazard / 100) * gaugeCircumference;
    document.getElementById("gaugeFill").style.strokeDasharray = dash + " " + gaugeCircumference;
  });
});

// ---- "Evidence Engine Result" card: final classification badge, tier, rationale text, and the link to the Traverse page ----
const badge = document.getElementById("classBadge");
badge.textContent = site.classification;
badge.className = "badge " + classificationClass(site.classification);

document.getElementById("tierText").textContent = site.tier;
document.getElementById("rationaleText").textContent = site.rationale;
document.getElementById("traverseLink").href = "traverse.html?id=" + site.id;
