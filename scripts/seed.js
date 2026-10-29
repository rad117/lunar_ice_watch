// Usage: MONGODB_URI=... node scripts/seed.js   (add --reset to wipe `sites` first)
// Loads the demo sites from scripts/seed.json into MongoDB (provenance "simulated") and creates indexes.
const { MongoClient } = require("mongodb");
const { siteDoc } = require("../api/_lib/siteDoc");

async function seed(reset) {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI first (see .env.example)");
  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  const db = client.db(process.env.MONGODB_DB || "lunar_ice_watch");
  const sites = db.collection("sites");
  if (reset) await sites.deleteMany({});
  const now = Date.now();
  const docs = require("./seed.json").map(function (s, i) { return siteDoc(s, new Date(now + i)); });
  const res = await sites.bulkWrite(docs.map(function (d) {
    return { replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } };
  }));
  await sites.createIndex({ location: "2dsphere" });
  await sites.createIndex({ createdAt: 1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("routes").createIndex({ siteId: 1, createdAt: -1 });
  console.log("seeded " + (res.upsertedCount + res.modifiedCount) + " sites");
  await client.close();
}

module.exports = seed;
if (require.main === module) {
  seed(process.argv.includes("--reset")).catch(function (e) { console.error(e.message); process.exit(1); });
}
