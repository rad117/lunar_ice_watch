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
