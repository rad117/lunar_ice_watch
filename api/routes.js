const db = require("./_lib/db");
const route = require("./_lib/http");
const limit = require("./_lib/limit");

const { httpError, clientId } = route;
const isPoint = function (p) { return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite); };

// GET /api/routes[?siteId=s1] -> saved routes, newest first.
// POST { siteId, start, end, distanceKm, difficulty, path } -> save one (60 per client per hour).
// start/end are [lon, lat]; path is a GeoJSON LineString. Phase 5 adds the planner that produces these.
module.exports = route(["GET", "POST"], async function (req, res) {
  const d = await db();
  const routes = d.collection("routes");
  if (req.method === "GET") {
    const q = req.query.siteId ? { siteId: String(req.query.siteId) } : {};
    return res.json(await routes.find(q).sort({ createdAt: -1 }).limit(100).toArray());
  }
  await limit(d, "route:" + clientId(req), 60);
  const b = req.body || {};
  const p = b.path;
  if (typeof b.siteId !== "string" || !isPoint(b.start) || !isPoint(b.end) || !Number.isFinite(b.distanceKm) ||
      typeof b.difficulty !== "string" || !p || p.type !== "LineString" ||
      !Array.isArray(p.coordinates) || p.coordinates.length < 2 || p.coordinates.length > 5000 || !p.coordinates.every(isPoint)) {
    throw httpError(400, "siteId, start, end, distanceKm, difficulty and a LineString path are required");
  }
  const doc = { siteId: b.siteId, start: b.start, end: b.end, distanceKm: b.distanceKm, difficulty: b.difficulty.slice(0, 40), path: { type: "LineString", coordinates: p.coordinates }, createdAt: new Date() };
  doc._id = (await routes.insertOne(doc)).insertedId;
  res.status(201).json(doc);
});
