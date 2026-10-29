const db = require("./_lib/db");
const route = require("./_lib/http");
const { buildSite } = require("./_lib/classify");
const { siteDoc } = require("./_lib/siteDoc");

// Body: { name, rows: [{cpr, thermalTemp, terrainHazard, ...}] } -> classify each row, store as a site.
// ponytail: still creates sites directly and is unauthenticated; phase 2 adds auth + file storage, phase 4 the model.
module.exports = route(["POST"], async function (req, res) {
  const rows = req.body && req.body.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) {
    return res.status(400).json({ error: "rows must be a non-empty array (max 500)" });
  }
  const name = String(req.body.name || "Site").slice(0, 80);
  const now = new Date();
  let docs;
  try {
    docs = rows.map(function (r, i) {
      const flat = buildSite(r || {}, i, name);
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { flat.lat = lat; flat.lon = lon; }
      const doc = siteDoc(flat, new Date(+now + i));
      doc.evidence.push({ source: "user CSV upload", note: "Unverified user-supplied values", acquiredAt: now, provenance: "simulated", citation: null });
      return doc;
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  await (await db()).collection("sites").insertMany(docs);
  res.status(201).json(docs);
});
