// Flat site (the shape the pages were built on) -> the `sites` collection schema.
// Values with no real source keep provenance "simulated"; fields we have no value for stay null.
const MOON_RADIUS_KM = 1737.4;

function siteDoc(s, createdAt) {
  const pub = s.published;
  const evidence = [];
  if (pub) {
    evidence.push({
      source: pub.source, note: "Published location" + (pub.tmaxK ? " and annual maximum temperature (K): " + pub.tmaxK : ""),
      acquiredAt: null, provenance: "published", citation: pub.source,
      data: { tmaxK: pub.tmaxK || null, diameterKm: pub.diameterKm || null }
    });
  }
  const lat = s.lat != null ? s.lat : pub && pub.lat;
  const lon = s.lon != null ? s.lon : pub && pub.lon;
  const doc = {
    _id: s.id,
    name: s.label,
    region: s.crater,
    features: {
      maxTempK: Number.isFinite(s.thermalTemp) ? Math.round((s.thermalTemp + 273.15) * 100) / 100 : null, meanTempK: null, pctBelow110K: null,
      cpr: s.cpr, slopeDeg: null, roughness: null, illumFraction: null, neutronSuppression: null
    },
    prediction: { iceProb: null, label: s.classification, tier: s.tier, rationale: s.rationale, modelVersion: "rules-v0", updatedAt: createdAt },
    featureProvenance: { maxTempK: "simulated", cpr: "simulated" }, // every other feature is null until the pipeline fills it
    evidence,
    // Screening inputs with no column in the target schema yet; all simulated until the pipeline (phase 3) replaces them.
    legacy: {
      x: s.x, y: s.y, pv: s.pv, serd: s.serd, tRatio: s.tRatio, thermalGate: s.thermalGate, thermalTemp: s.thermalTemp,
      altFlag: s.altFlag, altNote: s.altNote, terrainHazard: s.terrainHazard, boulderCount: s.boulderCount
    },
    provenance: "simulated",
    createdAt
  };
  if (lat != null && lon != null) doc.location = { type: "Point", coordinates: [lon, lat] };
  return doc;
}

module.exports = { siteDoc, MOON_RADIUS_KM };
