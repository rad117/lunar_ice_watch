// `npm run snapshot` -> api/_lib/snapshot.json: the seed sites + real pipeline results + planned routes, exactly as the
// database would hold them. The API serves this read-only when MONGODB_URI is not set, so the site works with no database.
// Re-run after changing scripts/seed.json or the pipeline outputs, and commit the result.
const fs = require("fs"), path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { loadPipelineResults } = require("./demo");

(async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await require("./seed")(true);
  const db = await require("../api/_lib/db")();
  await loadPipelineResults(db);
  const sites = await db.collection("sites").find({}, { projection: { ownerId: 0 } }).sort({ createdAt: 1 }).toArray();
  const routes = await db.collection("routes").find({}, { projection: { userId: 0 } }).sort({ createdAt: -1 }).toArray();
  const out = path.join(__dirname, "../api/_lib/snapshot.json");
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), sites, routes }));
  console.log("wrote", path.relative(process.cwd(), out), sites.length + " sites, " + routes.length + " routes, " + Math.round(fs.statSync(out).size / 1024) + " KB");
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
