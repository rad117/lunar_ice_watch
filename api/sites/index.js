const db = require("../_lib/db");
const route = require("../_lib/http");

// All sites, seed sites first, then uploads in the order they were added
module.exports = route(["GET"], async function (req, res) {
  const sites = await (await db()).collection("sites").find({}, { projection: { ownerId: 0 } }).sort({ createdAt: 1 }).limit(1000).toArray();
  res.json(sites);
});
