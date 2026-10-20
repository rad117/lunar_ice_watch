// API + static file server. Set MONGODB_URI to use your own MongoDB (e.g. Atlas); otherwise an
// embedded MongoDB is started with its data kept in server/.data (nothing to install).
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const { buildSite } = require("./classify");

const Site = mongoose.model("Site", new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  label: String, crater: String,
  x: Number, y: Number,
  pv: Number, cpr: Number, serd: Number, tRatio: Number,
  thermalGate: String, thermalTemp: Number,
  altFlag: Boolean, altNote: String,
  terrainHazard: Number, boulderCount: Number,
  classification: String, tier: String, rationale: String
}, { versionKey: false, timestamps: { createdAt: "createdAt", updatedAt: false } }));

async function connect() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const dbPath = path.join(__dirname, ".data");
    require("fs").mkdirSync(dbPath, { recursive: true });
    uri = (await MongoMemoryServer.create({ instance: { dbPath, storageEngine: "wiredTiger" } })).getUri("lunar_ice_watch");
  }
  await mongoose.connect(uri);
  if (!(await Site.countDocuments())) await Site.insertMany(require("./seed.json"));
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// Seed sites first, then uploads in the order they were added
app.get("/api/sites", async function (req, res) {
  const sites = await Site.find({}, { _id: 0, createdAt: 0 }).lean();
  res.json(sites);
});

// Body: { name, rows: [{cpr, thermalTemp, terrainHazard, ...}] } -> server classifies and stores each row
app.post("/api/sites", async function (req, res) {
  const rows = req.body && req.body.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) {
    return res.status(400).json({ error: "rows must be a non-empty array (max 500)" });
  }
  try {
    const name = String(req.body.name || "Site").slice(0, 80);
    const docs = rows.map(function (r, i) { return buildSite(r || {}, i, name); });
    await Site.insertMany(docs);
    res.status(201).json(docs);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Static site = the project root, minus anything that isn't front-end (server code, .env, deps, git)
app.use(function (req, res, next) {
  if (/^\/(server|node_modules|\.|package)/i.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(path.join(__dirname, "..")));

connect().then(function () {
  const port = process.env.PORT || 3000;
  app.listen(port, function () { console.log("Lunar Ice Watch on http://localhost:" + port); });
}).catch(function (e) { console.error("Startup failed:", e.message); process.exit(1); });
