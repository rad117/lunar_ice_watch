// Shared site list for the whole prototype, loaded from the MongoDB-backed API (api/sites).
// A page opts in with <script src="js/data.js" data-page="js/foo.js">: data.js fetches the sites, shows a
// loading / error banner meanwhile, then loads the page script, which can use `siteData` as before.
// The API returns the sites-collection schema; flattenSite() maps it to the flat shape the pages use.
const siteData = [];

// Map-canvas position (0-100 %) from a real lat/lon: south polar stereographic on a 1737.4 km sphere, 300 km = 40 %.
function polarPercent(lat, lon) {
  const rho = 2 * 1737.4 * Math.tan((90 + lat) * Math.PI / 360);
  const l = lon * Math.PI / 180;
  return { x: 50 + 40 * rho * Math.sin(l) / 300, y: 50 - 40 * rho * Math.cos(l) / 300 };
}

function flattenSite(d) {
  const pubEv = (d.evidence || []).find(function (e) { return e.provenance === "published"; });
  const coords = d.location && d.location.coordinates;
  const legacy = Object.assign({}, d.legacy);
  if (legacy.x == null && coords) { const p = polarPercent(coords[1], coords[0]); legacy.x = p.x; legacy.y = p.y; }
  const pred = d.prediction || {};
  return Object.assign({ terrainHazard: null, boulderCount: null, thermalGate: null, thermalTemp: null, altFlag: false, altNote: "", pv: null, serd: null, tRatio: null, x: 50, y: 50 }, legacy, {
    id: d._id, label: d.name, crater: d.region, cpr: d.features ? d.features.cpr : null,
    screening: d.screening || null, features: d.features || {}, featureProvenance: d.featureProvenance || {},
    classification: pred.label || "INCONCLUSIVE", tier: pred.tier || "NONE", rationale: pred.rationale || "",
    provenance: d.provenance, evidence: d.evidence || [],
    published: pubEv && coords ? { lat: coords[1], lon: coords[0], tmaxK: pubEv.data && pubEv.data.tmaxK, source: pubEv.citation } : null
  });
}

// Small "simulated / published / raster" badge; provenance comes from the database, never hardcoded in pages.
function provBadge(p) {
  if (!p) return "";
  return '<span class="prov prov--' + escapeHtml(p) + '" title="Data provenance: ' + escapeHtml(p) + '">' + escapeHtml(p) + '</span>';
}

(function () {
  const pageScript = document.currentScript && document.currentScript.dataset.page;
  if (!pageScript) return;

  function load() {
    const main = document.getElementById("main-content");
    const banner = document.createElement("p");
    banner.className = "subtext";
    banner.setAttribute("role", "status");
    banner.textContent = "Loading sites...";
    main.prepend(banner);

    fetch("/api/sites").then(function (r) {
      if (!r.ok) throw new Error("API returned " + r.status);
      return r.json();
    }).then(function (docs) {
      docs.forEach(function (d) { siteData.push(flattenSite(d)); });
      banner.remove();
      const note = document.createElement("p");
      note.className = "small-note";
      note.textContent = "Screening estimates, not scientific confirmation of lunar ice.";
      main.append(note);
      const el = document.createElement("script");
      el.src = pageScript;
      document.body.appendChild(el);
    }).catch(function (e) {
      banner.textContent = "Could not load sites (" + e.message + "). ";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "secondary";
      retry.textContent = "Retry";
      retry.addEventListener("click", function () { banner.remove(); load(); });
      banner.append(retry);
    });
  }
  document.addEventListener("DOMContentLoaded", load);
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
