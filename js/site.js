const params = new URLSearchParams(window.location.search);
const site = getSiteById(params.get("id")) || siteData[0];

document.getElementById("siteTitle").textContent = site.label;
document.getElementById("siteSub").textContent = site.crater;

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

const thermalPill = document.getElementById("thermalPill");
thermalPill.textContent = site.thermalGate.toUpperCase();
thermalPill.className = "pill " + (site.thermalGate === "pass" ? "pass" : "fail");
document.getElementById("thermalTempText").textContent = "measured temp: " + site.thermalTemp + " K";

const altPill = document.getElementById("altPill");
altPill.textContent = site.altFlag ? "FLAGGED" : "CLEAR";
altPill.className = "pill " + (site.altFlag ? "flagged" : "clear");
document.getElementById("altNoteText").textContent = site.altNote;

document.getElementById("boulderText").textContent = site.boulderCount;

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

const badge = document.getElementById("classBadge");
badge.textContent = site.classification;
badge.style.background = classColor(site.classification);

document.getElementById("tierText").textContent = site.tier;
document.getElementById("rationaleText").textContent = site.rationale;
document.getElementById("traverseLink").href = "traverse.html?id=" + site.id;
