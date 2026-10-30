// Screening score (0-1) from measured features. A hand-weighted heuristic, NOT a trained model:
// there is no labelled ground truth to train on. Missing or simulated inputs are skipped and the
// weights renormalised; `coverage` says how much of the total weight actually contributed.
const clamp = (v) => Math.max(0, Math.min(1, v));
const TERMS = [
  ["pctBelow110K", 3, (v) => clamp(v / 20)],            // area that is a cold trap
  ["maxTempK", 2, (v) => clamp((150 - v) / 70)],        // 80 K -> 1, 150 K+ -> 0
  ["cpr", 2, (v) => clamp((v - 0.5) / 1)],              // radar anomaly
  ["neutronSuppression", 2, (v) => clamp(v)],           // assumes a 0-1 fraction
  ["illumFraction", 1, (v) => 1 - clamp((v > 1 ? v / 100 : v) / 0.1)], // permanent shadow
  ["slopeDeg", 1, (v) => 1 - clamp(v / 20)]             // gentler = easier to reach/trap
];
const TOTAL = TERMS.reduce((a, t) => a + t[1], 0);

function score(features, prov) {
  let sum = 0, w = 0;
  const used = [], missing = [];
  TERMS.forEach(function ([k, wt, f]) {
    const v = features && features[k];
    if (!Number.isFinite(v) || (prov && prov[k] === "simulated")) return missing.push(k);
    sum += wt * f(v); w += wt; used.push(k);
  });
  return { score: w ? Math.round(sum / w * 100) / 100 : null, coverage: Math.round(w / TOTAL * 100) / 100, used, missing, modelVersion: "score-v1" };
}

module.exports = { score };
