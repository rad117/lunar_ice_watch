const db = require("../_lib/db");
const route = require("../_lib/http");
const { score } = require("../_lib/score");
const snap = require("../_lib/snapshot");

// All sites, seed sites first, then uploads in the order they were added
module.exports = route(["GET"], async function (req, res) {
  if (snap.active()) { snap.mark(res); return res.json(snap.data().sites.map(function (s) { return Object.assign({}, s, { screening: score(s.features, s.featureProvenance) }); })); }
  const sites = await (await db()).collection("sites").find({}, { projection: { ownerId: 0 } }).sort({ createdAt: 1 }).limit(1000).toArray();
  res.json(sites.map(function (s) { return Object.assign(s, { screening: score(s.features, s.featureProvenance) }); }));
});
