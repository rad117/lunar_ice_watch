const highCount = siteData.filter(function (s) { return s.classification === "ICE-SUPPORTED-HIGH"; }).length;
const passCount = siteData.filter(function (s) { return s.thermalGate === "pass"; }).length;
const flagCount = siteData.filter(function (s) { return s.altFlag; }).length;

document.getElementById("statsRow").innerHTML =
  '<div class="stat-card"><div class="num">' + siteData.length + '</div><div class="lbl">Sites Screened</div></div>' +
  '<div class="stat-card"><div class="num">' + passCount + '</div><div class="lbl">Passed Thermal Gate</div></div>' +
  '<div class="stat-card"><div class="num">' + highCount + '</div><div class="lbl">High Confidence Ice</div></div>' +
  '<div class="stat-card"><div class="num">' + flagCount + '</div><div class="lbl">Alt-Explanation Flags</div></div>';

let rows = "";
siteData.forEach(function (s) {
  rows += '<tr class="site-row" onclick="goToSite(\'' + s.id + '\')">' +
    '<td>' + s.label + '</td>' +
    '<td>' + s.crater + '</td>' +
    '<td><span class="pill ' + (s.thermalGate === "pass" ? "pass" : "fail") + '">' + s.thermalGate.toUpperCase() + '</span></td>' +
    '<td>' + s.terrainHazard + '%</td>' +
    '<td><span class="badge" style="background:' + classColor(s.classification) + '">' + s.classification + '</span></td>' +
    '</tr>';
});
document.getElementById("siteTable").innerHTML = rows;

function goToSite(id) {
  window.location.href = "site.html?id=" + id;
}
