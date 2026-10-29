const db = require("./_lib/db");
const route = require("./_lib/http");
const store = require("./_lib/blob");
const { requireUser, httpError } = require("./_lib/auth");
const { parseCsv } = require("./_lib/csv");
const { buildSite } = require("./_lib/classify");
const { siteDoc } = require("./_lib/siteDoc");

const MAX_BYTES = 1024 * 1024;
const MAX_ROWS = 500;
const MAX_UPLOADS_PER_HOUR = 20;

// Body: { name, filename, csv } (signed in). The CSV is validated and stored in Vercel Blob; MongoDB keeps only
// the URL + metadata. Each row is classified, becomes a site owned by the user, and gets an observation.
// ponytail: file travels inside the JSON body (Vercel caps bodies at ~4.5 MB); switch to client-direct Blob upload for big GeoTIFFs (phase 4).
module.exports = route(["POST"], async function (req, res) {
  const user = requireUser(req);
  const { name, filename, csv } = req.body || {};
  if (typeof csv !== "string" || !csv) throw httpError(400, "csv is required");
  if (!/\.csv$/i.test(String(filename || ""))) throw httpError(400, "Only .csv files are accepted");
  if (Buffer.byteLength(csv) > MAX_BYTES) throw httpError(413, "File is larger than 1 MB");

  const d = await db();
  const since = new Date(Date.now() - 3600 * 1000);
  if (await d.collection("observations").countDocuments({ userId: user.id, createdAt: { $gt: since }, rowIndex: 0 }) >= MAX_UPLOADS_PER_HOUR) {
    throw httpError(429, "Upload limit reached, try again later");
  }

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
      doc.ownerId = user.id;
      doc.evidence.push({ source: "user CSV upload", note: "Unverified user-supplied values", acquiredAt: now, provenance: "simulated", citation: null });
      return doc;
    });
  } catch (e) {
    throw httpError(400, e.message);
  }

  const fileUrl = await store("uploads/" + String(filename).replace(/[^\w.-]/g, "_").slice(-80), csv, "text/csv");
  await d.collection("sites").insertMany(docs);
  await d.collection("observations").insertMany(docs.map(function (s, i) {
    return { userId: user.id, siteId: s._id, rowIndex: i, instrument: "csv", acquiredAt: null, fileUrl, extractedFeatures: s.features, prediction: s.prediction, createdAt: now };
  }));
  res.status(201).json(docs);
});
