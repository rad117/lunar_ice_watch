const db = require("../_lib/db");
const route = require("../_lib/http");
const { score } = require("../_lib/score");

module.exports = route(["GET"], async function (req, res) {
  const site = await (await db()).collection("sites").findOne({ _id: String(req.query.id) }, { projection: { ownerId: 0 } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  site.screening = score(site.features, site.featureProvenance);
  res.json(site);
});
