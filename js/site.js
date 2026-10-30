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
  const pct = m.val == null ? 0 : Math.min(100, Math.round(m.val * 60));
  metricsHtml += '<div class="metric-row">' +
    '<div class="metric-label">' + m.name + '</div>' +
    '<div class="metric-bar-bg"><div class="metric-bar-fill" data-pct="' + pct + '" style="transition-delay:' + (i * 90) + 'ms"></div></div>' +
    '<div class="metric-val">' + (m.val == null ? "n/a" : m.val) + '</div>' +
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
thermalPill.textContent = site.thermalGate ? site.thermalGate.toUpperCase() : "N/A";
thermalPill.className = "pill " + (site.thermalGate === "pass" ? "pass" : "fail");
document.getElementById("thermalTempText").textContent = site.thermalTemp == null ? "gate temperature: n/a" : "gate temperature: " + site.thermalTemp + " °C (simulated placeholder; see Measured Features below)";
if (site.published) {
  const pub = site.published;
  document.getElementById("thermalTempText").textContent += " | published: " + pub.lat + ", " + pub.lon + " deg" +
    (pub.tmaxK ? ", annual max " + pub.tmaxK + " K" : "") + " (" + pub.source + ")";
}

const altPill = document.getElementById("altPill");
altPill.textContent = site.altFlag ? "FLAGGED" : "CLEAR";
altPill.className = "pill " + (site.altFlag ? "flagged" : "clear");
document.getElementById("altNoteText").textContent = site.altNote;

document.getElementById("boulderText").textContent = site.boulderCount == null ? "n/a" : site.boulderCount;

// The circular hazard gauge (an SVG ring whose stroke-dasharray is animated to "fill up" to the hazard %)
const hazard = site.terrainHazard == null ? 0 : site.terrainHazard;
const gaugeColor = hazardLevelColor(hazard);
const gaugeRadius = 30;
const gaugeCircumference = 2 * Math.PI * gaugeRadius;
document.getElementById("hazardGauge").innerHTML =
  '<svg width="76" height="76" viewBox="0 0 76 76">' +
  '<circle class="gauge-track" cx="38" cy="38" r="' + gaugeRadius + '"></circle>' +
  '<circle class="gauge-fill" id="gaugeFill" cx="38" cy="38" r="' + gaugeRadius + '" stroke="' + gaugeColor + '"></circle>' +
  '</svg>' +
  '<div class="gauge-label"><span class="big" style="color:' + gaugeColor + '">' + (site.terrainHazard == null ? "n/a" : hazard + "%") + '</span><span class="small">Terrain hazard</span></div>';

requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    const dash = (hazard / 100) * gaugeCircumference;
    document.getElementById("gaugeFill").style.strokeDasharray = dash + " " + gaugeCircumference;
  });
});

// ---- "Evidence Engine Result" card: final classification badge, tier, rationale text, and the link to the Traverse page ----
const badge = document.getElementById("classBadge");
badge.textContent = site.classification;
badge.className = "badge " + classificationClass(site.classification);
badge.insertAdjacentHTML("afterend", provBadge(site.provenance));

document.getElementById("tierText").textContent = site.tier;
document.getElementById("rationaleText").textContent = site.rationale + " (Classification still uses the simulated screening inputs above, not the measured features; the trained model comes later.)";
document.getElementById("traverseLink").href = "traverse.html?id=" + site.id;

// ---- "Measured Features" card: every value from the sites collection with where it came from (null = not available yet) ----
const featureRows = [
  ["maxTempK", "Annual max temperature (K)"], ["meanTempK", "Annual mean temperature (K)"], ["pctBelow110K", "Area below 110 K (%)"],
  ["slopeDeg", "Median slope (deg)"], ["roughness", "Roughness (deg)"], ["cpr", "Radar CPR"],
  ["illumFraction", "Illumination fraction"], ["neutronSuppression", "Neutron suppression"]
];
const featureCard = document.createElement("div");
featureCard.className = "card";
featureCard.innerHTML = "<h3>Measured Features</h3>" + featureRows.map(function (r) {
  const v = site.features[r[0]];
  return '<p class="subtext">' + r[1] + ": " + (v == null ? "not available yet" : Number(v).toFixed(2) + provBadge(site.featureProvenance[r[0]])) + "</p>";
}).join("") + (site.screening && site.screening.score != null ? '<p class="subtext">Screening score: <strong>' + site.screening.score.toFixed(2) + "</strong> (0-1, from " + site.screening.used.join(", ") + "; " + Math.round(site.screening.coverage * 100) + '% of inputs available). A hand-weighted heuristic, not a trained model.</p>' : "") + (site.evidence.length ? '<p class="subtext">Sources: ' + site.evidence.map(function (e) { return escapeHtml(e.source); }).join("; ") + "</p>" : "");
const cards = document.querySelectorAll("main .card");
cards[cards.length - 1].before(featureCard);
