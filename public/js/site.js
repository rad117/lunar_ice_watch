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
metrics.forEach(function (m) {
  const pct = Math.min(100, Math.round(m.val * 60));
  metricsHtml += '<div class="metric-row">' +
    '<div class="metric-label">' + m.name + '</div>' +
    '<div class="metric-bar-bg"><div class="metric-bar-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="metric-val">' + m.val + '</div>' +
    '</div>';
});
document.getElementById("metricsBox").innerHTML = metricsHtml;

const thermalPill = document.getElementById("thermalPill");
thermalPill.textContent = site.thermalGate.toUpperCase();
thermalPill.className = "pill " + (site.thermalGate === "pass" ? "pass" : "fail");
document.getElementById("thermalTempText").textContent = "measured temp: " + site.thermalTemp + " K";

const altPill = document.getElementById("altPill");
altPill.textContent = site.altFlag ? "FLAGGED" : "CLEAR";
altPill.className = "pill " + (site.altFlag ? "flagged" : "clear");
document.getElementById("altNoteText").textContent = site.altNote;

document.getElementById("hazardText").textContent = site.terrainHazard + "%";
document.getElementById("boulderText").textContent = site.boulderCount;

const badge = document.getElementById("classBadge");
badge.textContent = site.classification;
badge.style.background = classColor(site.classification);

document.getElementById("tierText").textContent = site.tier;
document.getElementById("rationaleText").textContent = site.rationale;
document.getElementById("traverseLink").href = "traverse.html?id=" + site.id;
