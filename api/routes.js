const db = require("./_lib/db");
const route = require("./_lib/http");

// GET /api/routes?siteId=s1 -> saved routes. Creating routes (POST) needs auth (phase 2) and the planner (phase 5).
module.exports = route(["GET"], async function (req, res) {
  const q = req.query.siteId ? { siteId: String(req.query.siteId) } : {};
  res.json(await (await db()).collection("routes").find(q).sort({ createdAt: -1 }).limit(100).toArray());
});
