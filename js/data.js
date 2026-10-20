// Shared site list for the whole prototype, loaded from the MongoDB-backed API (server/index.js).
// Loaded on Dashboard, Map, Traverse and Site Detail pages — they all read from this same array.
// x/y are 0-100 percentage coordinates plotted onto the map canvas in js/map.js.
// ponytail: synchronous XHR keeps every page script unchanged; switch to fetch + per-page init if blocking ever matters.
const siteData = (function () {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/sites", false);
    xhr.send();
    if (xhr.status === 200) return JSON.parse(xhr.responseText);
  } catch (e) { /* fall through */ }
  document.addEventListener("DOMContentLoaded", function () {
    showToast("Can't reach the server - run `npm start` and open http://localhost:3000", "error");
  });
  return [];
})();

// Looks up one site's record; used by site.html, map.html and traverse.html to show details for the picked site
function getSiteById(id) {
  return siteData.find(function (s) { return s.id === id; });
}

// Site labels can come from uploaded CSVs / the "Site name" field, so escape before interpolating into HTML.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// These three helpers turn a classification string (e.g. "ICE-SUPPORTED-HIGH") into
// the matching hex color / CSS badge class used on the Dashboard table and Site Detail badge
function classColor(classification) {
  if (classification === "ICE-SUPPORTED-HIGH") return "#4ade80";
  if (classification === "ICE-SUPPORTED-MODERATE") return "#60a5fa";
  if (classification === "INCONCLUSIVE") return "#fbbf24";
  return "#f87171";
}

function classificationClass(classification) {
  if (classification === "ICE-SUPPORTED-HIGH") return "badge--high";
  if (classification === "ICE-SUPPORTED-MODERATE") return "badge--moderate";
  if (classification === "INCONCLUSIVE") return "badge--inconclusive";
  return "badge--unlikely";
}

// Colors the hazard gauge/legend green/yellow/red by terrain hazard score
function hazardLevelColor(h) {
  if (h < 30) return "#4ade80";
  if (h < 50) return "#fbbf24";
  return "#f87171";
}
