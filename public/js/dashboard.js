const highCount = siteData.filter(function (s) { return s.classification === "ICE-SUPPORTED-HIGH"; }).length;
const passCount = siteData.filter(function (s) { return s.thermalGate === "pass"; }).length;
const flagCount = siteData.filter(function (s) { return s.altFlag; }).length;

const statsRow = document.getElementById("statsRow");
statsRow.innerHTML =
  '<div class="stat-card" style="animation-delay:0ms"><div class="num" data-target="' + siteData.length + '">0</div><div class="lbl">Sites Screened</div></div>' +
  '<div class="stat-card" style="animation-delay:60ms"><div class="num" data-target="' + passCount + '">0</div><div class="lbl">Passed Thermal Gate</div></div>' +
  '<div class="stat-card" style="animation-delay:120ms"><div class="num" data-target="' + highCount + '">0</div><div class="lbl">High Confidence Ice</div></div>' +
  '<div class="stat-card" style="animation-delay:180ms"><div class="num" data-target="' + flagCount + '">0</div><div class="lbl">Alt-Explanation Flags</div></div>';

statsRow.querySelectorAll(".num").forEach(function (el) {
  animateCount(el, Number(el.dataset.target));
});

const filters = {
  all: function () { return true; },
  supported: function (s) { return s.classification === "ICE-SUPPORTED-HIGH" || s.classification === "ICE-SUPPORTED-MODERATE"; },
  inconclusive: function (s) { return s.classification === "INCONCLUSIVE"; },
  unlikely: function (s) { return s.classification === "ICE-UNLIKELY"; },
  flagged: function (s) { return s.altFlag; }
};

const chipDefs = [
  { key: "all", label: "All" },
  { key: "supported", label: "Ice-Supported" },
  { key: "inconclusive", label: "Inconclusive" },
  { key: "unlikely", label: "Ice-Unlikely" },
  { key: "flagged", label: "Flagged" }
];

let activeFilter = "all";
let sortKey = null;
let sortDir = 1;

function renderChips() {
  document.getElementById("chipRow").innerHTML = chipDefs.map(function (c) {
    const count = siteData.filter(filters[c.key]).length;
    return '<div class="chip' + (c.key === activeFilter ? " active" : "") + '" data-key="' + c.key + '">' +
      c.label + '<span class="count">' + count + '</span></div>';
  }).join("");

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      activeFilter = chip.dataset.key;
      renderChips();
      renderTable();
    });
  });
}

function renderTable() {
  let rows = siteData.filter(filters[activeFilter]);

  if (sortKey) {
    rows = rows.slice().sort(function (a, b) {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    });
  }

  let html = "";
  rows.forEach(function (s) {
    html += '<tr class="site-row" onclick="goToSite(\'' + s.id + '\')">' +
      '<td>' + s.label + '</td>' +
      '<td>' + s.crater + '</td>' +
      '<td><span class="pill ' + (s.thermalGate === "pass" ? "pass" : "fail") + '">' + s.thermalGate.toUpperCase() + '</span></td>' +
      '<td>' + s.terrainHazard + '%</td>' +
      '<td><span class="badge" style="background:' + classColor(s.classification) + '">' + s.classification + '</span></td>' +
      '</tr>';
  });
  document.getElementById("siteTable").innerHTML = html ||
    '<tr><td colspan="5" class="subtext" style="padding:20px 14px;">No sites match this filter.</td></tr>';
}

document.querySelectorAll("#tableHead th.sortable").forEach(function (th) {
  th.addEventListener("click", function () {
    const key = th.dataset.key;
    if (sortKey === key) {
      sortDir *= -1;
    } else {
      sortKey = key;
      sortDir = 1;
    }
    document.querySelectorAll("#tableHead th.sortable").forEach(function (other) {
      other.removeAttribute("aria-sort");
    });
    th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
    th.querySelector(".sort-arrow").innerHTML = sortDir === 1 ? "&#9650;" : "&#9660;";
    renderTable();
  });
});

function goToSite(id) {
  window.location.href = "site.html?id=" + id;
}

renderChips();
renderTable();
