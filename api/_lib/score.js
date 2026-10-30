// Screening score (0-1) from measured features. A transparent heuristic, NOT a trained model:
// there is no labelled ground truth to train on. Missing or simulated inputs are skipped and the
// score is the plain mean of the rest; `coverage` says what share of the terms contributed.
//
// What the sources support (and what they don't):
//  - 110 K is the usual cold-trap threshold (Paige et al. 2010; reviewed in arXiv:2502.06056). That review gives crystalline
//    ice sublimating at ~100 kg/m^2/Ga at 109 K and ~1000 at 114 K, i.e. ~10x per 5 K. Three decades faster is ~124 K, so the
//    temperature term falls from 1 at <=110 K to 0 at >=125 K (an extrapolation of those two points, rounded).
//  - pctBelow110K is already the fraction of the site's area that is a cold trap, so it is used as is.
//  - CPR: a dry surface is < 1 (Mini-RF team); anomalous-crater CPR > 1 is read as ice by Spudis et al. 2013 but disputed
//    (roughness, arXiv:1312.4749). The term is 0 at <= 1 and 1 at >= 2; the upper end is my choice.
//  - neutronSuppression (assumed a 0-1 fraction) and illumFraction (1 in permanent shadow, 0 at >= 10 % lit) have no source
//    for their ramps; they only count when a raster is supplied.
//  - Slope is NOT in the score: it says nothing about ice stability. Trafficability is the traverse planner's job.
//  - The weights are equal: no source supports unequal ones.
const clamp = (v) => Math.max(0, Math.min(1, v));
const TERMS = [
  ["pctBelow110K", (v) => clamp(v / 100)],
  ["maxTempK", (v) => clamp((125 - v) / 15)],
  ["cpr", (v) => clamp(v - 1)],
  ["neutronSuppression", (v) => clamp(v)],
  ["illumFraction", (v) => 1 - clamp((v > 1 ? v / 100 : v) / 0.1)]
];

function score(features, prov) {
  let sum = 0;
  const used = [], missing = [];
  TERMS.forEach(function ([k, f]) {
    const v = features && features[k];
    if (!Number.isFinite(v) || (prov && prov[k] === "simulated")) return missing.push(k);
    sum += f(v); used.push(k);
  });
  return { score: used.length ? Math.round(sum / used.length * 100) / 100 : null, coverage: Math.round(used.length / TERMS.length * 100) / 100, used, missing, modelVersion: "score-v2" };
}

module.exports = { score };
