// Server-side "evidence engine": the single source of truth for turning raw radar/thermal/terrain
// numbers into a classification. Clients send raw metrics only, so results can't be faked.
const REQUIRED = ["cpr", "thermalTemp", "terrainHazard"];

function classify(m) {
  if (m.thermalGate === "fail") {
    return { classification: "ICE-UNLIKELY", tier: "NONE", rationale: "Region is not cold enough to sustain surface ice. Thermal gate failure overrides any radar signal." };
  }
  if (m.altFlag) {
    return { classification: "INCONCLUSIVE", tier: "NONE", rationale: "Passed the thermal gate but the alternative-explanation flag is raised. Radar signal alone is not enough to confirm ice." };
  }
  if (m.cpr >= 1.2 && m.terrainHazard < 30) {
    return { classification: "ICE-SUPPORTED-HIGH", tier: "STRONG_SUPPORT", rationale: "High CPR combined with a passed thermal gate and low terrain hazard. No competing explanation found for the radar anomaly." };
  }
  if (m.cpr >= 0.9) {
    return { classification: "ICE-SUPPORTED-MODERATE", tier: "STRONG_SUPPORT", rationale: "Moderate radar and thermal evidence align. Terrain hazard is on the higher side so confidence is not maximal." };
  }
  return { classification: "INCONCLUSIVE", tier: "NONE", rationale: "Radar signal is weak. Thermal gate passed but evidence is not strong enough for a confident call." };
}

// One raw row ({column: value}, e.g. from a CSV) -> a full site document. Throws on bad input.
function buildSite(row, i, fallbackName) {
  const num = function (k, d) { const v = parseFloat(row[k]); return isNaN(v) ? d : v; };
  REQUIRED.forEach(function (k) {
    if (isNaN(parseFloat(row[k]))) throw new Error("Row " + (i + 2) + ": " + k + " must be a number");
  });
  const cpr = num("cpr"), thermalTemp = num("thermalTemp"), terrainHazard = num("terrainHazard");
  const altFlag = /^(true|1|yes)$/i.test(String(row.altFlag || ""));
  const thermalGate = thermalTemp < -190 ? "pass" : "fail";
  return Object.assign({
    id: "u" + Date.now() + "_" + require("crypto").randomBytes(3).toString("hex") + "_" + i,
    label: String(row.label || fallbackName + (i ? " #" + (i + 1) : "")).slice(0, 80),
    crater: String(row.crater || "Newly surveyed region").slice(0, 80),
    x: num("x", 50), y: num("y", 50),
    pv: num("pv", 0), cpr: cpr, serd: num("serd", 0), tRatio: num("tRatio", 0),
    thermalGate: thermalGate, thermalTemp: thermalTemp,
    altFlag: altFlag,
    altNote: altFlag ? "Adjacent terrain feature may explain part of the signal" : "No competing terrain explanation identified",
    terrainHazard: terrainHazard,
    boulderCount: num("boulderCount", Math.round(terrainHazard / 5))
  }, classify({ cpr: cpr, terrainHazard: terrainHazard, thermalGate: thermalGate, altFlag: altFlag }));
}

module.exports = { classify, buildSite };
