const db = require("./_lib/db");
const route = require("./_lib/http");
const limit = require("./_lib/limit");
const store = require("./_lib/blob");
const snap = require("./_lib/snapshot");
const { parseCsv } = require("./_lib/csv");
const { buildSite } = require("./_lib/classify");
const { siteDoc } = require("./_lib/siteDoc");

const { httpError, clientId } = route;
const MAX_BYTES = 1024 * 1024;
const MAX_ROWS = 500;
const MAX_UPLOADS_PER_HOUR = 20;

// Body: { name, filename, csv }. Open to anyone (no sign-in), so it is capped: 1 MB, 500 rows, 20 uploads per
// client per hour. The CSV is validated and stored in Vercel Blob; MongoDB keeps only the URL + metadata.
// Each row is classified, becomes a site, and gets an observation.
// ponytail: file travels inside the JSON body (Vercel caps bodies at ~4.5 MB); switch to client-direct Blob upload for big GeoTIFFs (phase 4).
module.exports = route(["POST"], async function (req, res) {
  if (snap.active()) snap.needsDb();
  const d = await db();
  const client = clientId(req);
  await limit(d, "upload:" + client, MAX_UPLOADS_PER_HOUR);

  const { name, filename, csv } = req.body || {};
  if (typeof csv !== "string" || !csv) throw httpError(400, "csv is required");
  if (!/\.csv$/i.test(String(filename || ""))) throw httpError(400, "Only .csv files are accepted");
  if (Buffer.byteLength(csv) > MAX_BYTES) throw httpError(413, "File is larger than 1 MB");

  const now = new Date();
  const siteName = String(name || "Site").slice(0, 80);
  let docs;
  try {
    const rows = parseCsv(csv);
    if (rows.length > MAX_ROWS) throw new Error("At most " + MAX_ROWS + " rows per file");
    docs = rows.map(function (r, i) {
      const flat = buildSite(r, i, siteName);
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { flat.lat = lat; flat.lon = lon; }
      const doc = siteDoc(flat, new Date(+now + i));
      doc.evidence.push({ source: "user CSV upload", note: "Unverified user-supplied values", acquiredAt: now, provenance: "simulated", citation: null });
      return doc;
    });
  } catch (e) {
    throw httpError(400, e.message);
  }

  const fileUrl = await store("uploads/" + String(filename).replace(/[^\w.-]/g, "_").slice(-80), csv, "text/csv");
  const ids = docs.map(function (s) { return s._id; });
  try {
    await d.collection("sites").insertMany(docs);
    await d.collection("observations").insertMany(docs.map(function (s, i) {
      return { siteId: s._id, rowIndex: i, instrument: "csv", acquiredAt: null, fileUrl, extractedFeatures: s.features, prediction: s.prediction, createdAt: now };
    }));
  } catch (e) { // no half-saved uploads (a multi-document transaction needs a replica set; this is the cheap equivalent)
    await Promise.all([d.collection("sites").deleteMany({ _id: { $in: ids } }), d.collection("observations").deleteMany({ siteId: { $in: ids } })]).catch(function () {});
    throw e;
  }
  res.status(201).json(docs);
});
