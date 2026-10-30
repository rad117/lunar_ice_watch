const db = require("../_lib/db");
const route = require("../_lib/http");
const { score } = require("../_lib/score");
const snap = require("../_lib/snapshot");

module.exports = route(["GET"], async function (req, res) {
  if (snap.active()) {
    snap.mark(res);
    const s = snap.data().sites.find(function (x) { return x._id === String(req.query.id); });
    if (!s) return res.status(404).json({ error: "Site not found" });
    return res.json(Object.assign({}, s, { screening: score(s.features, s.featureProvenance) }));
  }
  const site = await (await db()).collection("sites").findOne({ _id: String(req.query.id) }, { projection: { ownerId: 0 } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  site.screening = score(site.features, site.featureProvenance);
  res.json(site);
});
