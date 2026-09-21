const siteData = [
  {
    id: "s1",
    label: "Site A1",
    crater: "Near Cabeus rim",
    x: 32, y: 40,
    pv: 0.71, cpr: 1.42, serd: 0.18, tRatio: 0.62,
    thermalGate: "pass", thermalTemp: -238,
    altFlag: false, altNote: "No fresh crater ejecta nearby",
    terrainHazard: 22, boulderCount: 4,
    classification: "ICE-SUPPORTED-HIGH",
    tier: "STRONG_SUPPORT",
    rationale: "High CPR combined with a passed thermal gate and low terrain hazard. No competing explanation found for the radar anomaly."
  },
  {
    id: "s2",
    label: "Site A2",
    crater: "Faustini floor",
    x: 55, y: 25,
    pv: 0.34, cpr: 0.88, serd: 0.41, tRatio: 0.35,
    thermalGate: "pass", thermalTemp: -221,
    altFlag: true, altNote: "Adjacent to a young crater, ejecta blanket may explain roughness",
    terrainHazard: 48, boulderCount: 11,
    classification: "INCONCLUSIVE",
    tier: "NONE",
    rationale: "Passed the thermal gate but the alternative-explanation flag is raised. Radar signal alone is not enough to confirm ice."
  },
  {
    id: "s3",
    label: "Site A3",
    crater: "Shoemaker basin",
    x: 68, y: 58,
    pv: 0.19, cpr: 0.61, serd: 0.55, tRatio: 0.21,
    thermalGate: "fail", thermalTemp: -142,
    altFlag: false, altNote: "No unusual terrain features",
    terrainHazard: 35, boulderCount: 7,
    classification: "ICE-UNLIKELY",
    tier: "NONE",
    rationale: "Region is not cold enough to sustain surface ice. Thermal gate failure overrides any radar signal."
  },
  {
    id: "s4",
    label: "Site A4",
    crater: "Haworth wall",
    x: 20, y: 65,
    pv: 0.58, cpr: 1.15, serd: 0.22, tRatio: 0.49,
    thermalGate: "pass", thermalTemp: -230,
    altFlag: false, altNote: "Terrain is smooth, no ejecta signature",
    terrainHazard: 40, boulderCount: 9,
    classification: "ICE-SUPPORTED-MODERATE",
    tier: "STRONG_SUPPORT",
    rationale: "Moderate radar and thermal evidence align. Terrain hazard is on the higher side so confidence is not maximal."
  },
  {
    id: "s5",
    label: "Site A5",
    crater: "Amundsen crater",
    x: 78, y: 33,
    pv: 0.25, cpr: 0.7, serd: 0.6, tRatio: 0.3,
    thermalGate: "fail", thermalTemp: -160,
    altFlag: true, altNote: "Ejecta blanket overlaps candidate zone",
    terrainHazard: 61, boulderCount: 14,
    classification: "ICE-UNLIKELY",
    tier: "NONE",
    rationale: "Failed thermal gate and a raised alternative-explanation flag. Radar anomaly most likely explained by terrain."
  },
  {
    id: "s6",
    label: "Site A6",
    crater: "Sverdrup ridge",
    x: 44, y: 78,
    pv: 0.66, cpr: 1.3, serd: 0.16, tRatio: 0.58,
    thermalGate: "pass", thermalTemp: -242,
    altFlag: false, altNote: "No competing terrain explanation identified",
    terrainHazard: 18, boulderCount: 3,
    classification: "ICE-SUPPORTED-HIGH",
    tier: "PROOF",
    rationale: "Strongest candidate in the set. Passed thermal gate, low hazard, high CPR, and no alternative explanation."
  }
];

function getSiteById(id) {
  return siteData.find(function (s) { return s.id === id; });
}

function classColor(classification) {
  if (classification === "ICE-SUPPORTED-HIGH") return "#4ade80";
  if (classification === "ICE-SUPPORTED-MODERATE") return "#60a5fa";
  if (classification === "INCONCLUSIVE") return "#fbbf24";
  return "#f87171";
}
