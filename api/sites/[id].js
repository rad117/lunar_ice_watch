const db = require("../_lib/db");
const route = require("../_lib/http");

module.exports = route(["GET"], async function (req, res) {
  const site = await (await db()).collection("sites").findOne({ _id: String(req.query.id) }, { projection: { ownerId: 0 } });
  if (!site) return res.status(404).json({ error: "Site not found" });
  res.json(site);
});
