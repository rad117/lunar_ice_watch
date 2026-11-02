const siteData = [];

function polarPercent(lat, lon) {
  const rho = 2 * 1737.4 * Math.tan((90 + lat) * Math.PI / 360);
  const l = lon * Math.PI / 180;
  return { x: 50 + 40 * rho * Math.sin(l) / 300, y: 50 - 40 * rho * Math.cos(l) / 300 };
}

function flattenSite(d) {
  const pubEv = (d.evidence || []).find(function (e) { return e.provenance === "published"; });
  const coords = d.location && d.location.coordinates;
  const legacy = Object.assign({}, d.legacy);
  let fromCoords = false;
  if (coords) { const p = polarPercent(coords[1], coords[0]); legacy.x = p.x; legacy.y = p.y; fromCoords = true; }
  const pred = d.prediction || {};
  return Object.assign({ terrainHazard: null, boulderCount: null, thermalGate: null, thermalTemp: null, altFlag: false, altNote: "", pv: null, serd: null, tRatio: null, x: 50, y: 50 }, legacy, {
    id: d._id, label: d.name, crater: d.region, cpr: d.features ? d.features.cpr : null,
    screening: d.screening || null, posFromCoords: fromCoords, features: d.features || {}, featureProvenance: d.featureProvenance || {},
    classification: pred.label || "INCONCLUSIVE", tier: pred.tier || "NONE", rationale: pred.rationale || "",
    provenance: d.provenance, evidence: d.evidence || [],
    published: pubEv && coords ? { lat: coords[1], lon: coords[0], tmaxK: pubEv.data && pubEv.data.tmaxK, source: pubEv.citation } : null
  });
}

function h(tag, attrs, ...kids) {
  const NS = { svg: 1, circle: 1 };
  const e = NS[tag] ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  kids.forEach(function (c) { if (c != null && c !== false) e.append(c); });
  return e;
}

function provBadge(p) {
  if (!p) return "";
  return '<span class="prov prov--' + escapeHtml(p) + '" title="Data provenance: ' + escapeHtml(p) + '">' + escapeHtml(p) + '</span>';
}

function provNode(p) {
  return p ? h("span", { class: "prov prov--" + p, title: "Data provenance: " + p }, p) : null;
}

const API_TIMEOUT_MS = 12000;
let usingSavedCopy = false;

function apiGet(url) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, API_TIMEOUT_MS);
  return fetch(url, { signal: ctl.signal }).then(function (r) {
    if (!r.ok) throw new Error("API returned " + r.status);
    return r.json().then(function (body) { return { body: body, snapshot: r.headers.get("x-data-source") === "snapshot" }; });
  }).finally(function () { clearTimeout(timer); });
}

function loadSavedCopy() {
  if (window.LIW_SNAPSHOT) return Promise.resolve(window.LIW_SNAPSHOT);
  return new Promise(function (resolve, reject) {
    const el = document.createElement("script");
    el.src = "js/snapshot-data.js";
    el.onload = function () { resolve(window.LIW_SNAPSHOT); };
    el.onerror = function () { reject(new Error("the saved copy of the data is missing")); };
    document.head.appendChild(el);
  });
}

function loadRoutes() {
  const saved = function () { return loadSavedCopy().then(function (s) { return s.routes; }); };
  if (usingSavedCopy) return saved();
  return apiGet("/api/routes").then(function (r) { return r.body; }).catch(saved);
}

(function () {
  if (typeof document === "undefined") return;
  const pageScript = document.currentScript && document.currentScript.dataset.page;
  if (!pageScript) return;

  function load() {
    const main = document.getElementById("main-content");
    const message = h("span", null, "Loading sites...");
    const banner = h("div", { class: "load-status", role: "status" }, h("span", { class: "load-spinner", "aria-hidden": "true" }), message);
    const hero = main.querySelector(".page-hero");
    if (hero) hero.after(banner); else main.prepend(banner);
    document.body.classList.add("is-loading");
    const slow = setTimeout(function () { message.textContent = "Waking up the database, this can take a few seconds..."; }, 4000);

    let snapshot = false;
    apiGet("/api/sites").catch(function () {
      return loadSavedCopy().then(function (s) { usingSavedCopy = true; return { body: s.sites }; });
    }).then(function (result) {
      snapshot = !!result.snapshot;
      result.body.forEach(function (d) { siteData.push(flattenSite(d)); });
      clearTimeout(slow);
      banner.remove();
      document.body.classList.remove("is-loading");
      const note = document.createElement("p");
      note.className = "small-note";
      note.textContent = "Screening estimates, not scientific confirmation of lunar ice." +
        (usingSavedCopy ? " Showing a saved copy of the data because the live server could not be reached, so uploads are switched off." : "") +
        (snapshot ? " Showing a saved snapshot of the data (read-only): no database is connected, so uploads are switched off." : "");
      main.append(note);
      const el = document.createElement("script");
      el.src = pageScript;
      document.body.appendChild(el);
    }).catch(function (e) {
      clearTimeout(slow);
      message.textContent = "Could not load sites (" + e.message + "). ";
      banner.querySelector(".load-spinner").remove();
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

function getSiteById(id) {
  return siteData.find(function (s) { return s.id === id; });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

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

function hazardLevelColor(h) {
  if (h < 30) return "#4ade80";
  if (h < 50) return "#fbbf24";
  return "#f87171";
}

if (typeof module !== "undefined") module.exports = { polarPercent, flattenSite };
