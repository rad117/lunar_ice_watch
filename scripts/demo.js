// Local demo with no accounts: `npm run demo` -> http://localhost:3000
// Starts an in-memory MongoDB (first run downloads a MongoDB binary), seeds the sites, loads the real pipeline
// results (pipeline/output/*.json, written by pipeline.py / route.py) and serves the pages plus the /api functions.
// Data lives only while this runs; uploads are accepted but the CSV file itself is not stored (no Blob).
const http = require("http"), fs = require("fs"), path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 3000;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json" };

// Same math as pipeline.py write_mongo, from the committed output files (no Python needed).
async function loadPipelineResults(db) {
  const feats = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/output/site_features.json"))).sites;
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/config.json")));
  for (const r of feats) {
    const old = await db.collection("sites").findOne({ _id: r.siteId });
    const set = { pipelineCenter: { type: "Point", coordinates: [r.lon, r.lat] }, boundary: r.boundary, pipelineRunAt: new Date() };
    Object.keys(r.features).forEach(function (k) {
      if (r.featureProvenance[k] === "raster") { set["features." + k] = r.features[k]; set["featureProvenance." + k] = "raster"; }
    });
    if (old) {
      if (!old.location) set.location = set.pipelineCenter;
      await db.collection("sites").updateOne({ _id: r.siteId }, { $set: set, $push: { evidence: { $each: r.evidence } } });
      const d = await db.collection("sites").findOne({ _id: r.siteId });
      const simulated = Object.keys(d.features).filter(function (k) { return d.features[k] != null && d.featureProvenance[k] !== "raster"; });
      await db.collection("sites").updateOne({ _id: r.siteId }, { $set: Object.assign({ provenance: simulated.length ? "mixed" : "raster" }, ...simulated.map(function (k) { return { ["featureProvenance." + k]: "simulated" }; })) });
    } else {
      const f = {}; Object.keys(r.features).forEach(function (k) { f[k] = r.featureProvenance[k] === "raster" ? r.features[k] : null; });
      await db.collection("sites").insertOne(Object.assign({
        _id: r.siteId, name: r.name, region: r.region, location: set.pipelineCenter, features: f, featureProvenance: r.featureProvenance,
        prediction: { iceProb: null, label: "INCONCLUSIVE", tier: "NONE", modelVersion: "none", rationale: "No model prediction yet; features come from rasters only.", updatedAt: null },
        evidence: r.evidence, legacy: {}, provenance: "raster", createdAt: new Date()
      }, { boundary: r.boundary, pipelineCenter: set.pipelineCenter }));
    }
  }
  const routes = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/output/routes.json"))).routes.filter(function (r) { return !r.error; });
  await db.collection("routes").insertMany(routes.map(function (r) { const d = Object.assign({}, r, { planner: "astar-lola-v1", createdAt: new Date() }); delete d.name; return d; }));
  return { sites: feats.length, routes: routes.length };
}

(async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.BLOB_READ_WRITE_TOKEN = "demo";
  require.cache[require.resolve("../api/_lib/blob")] = { id: "blob", loaded: true, exports: async function (p) { return "demo://" + p; } };
  await require("./seed")(true);
  const db = await require("../api/_lib/db")();
  console.log("pipeline data loaded:", await loadPipelineResults(db));

  http.createServer(function (req, res) {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname.startsWith("/api/")) {
      const parts = u.pathname.slice(5).replace(/\/$/, "").split("/");
      const query = Object.fromEntries(u.searchParams);
      let file = path.join(ROOT, "api", parts.join("/"));
      if (parts[0] === "sites" && parts.length === 1) file = path.join(ROOT, "api/sites/index");
      else if (parts[0] === "sites" && parts.length === 2 && parts[1] !== "near") { file = path.join(ROOT, "api/sites/[id]"); query.id = decodeURIComponent(parts[1]); }
      if (!fs.existsSync(file + ".js")) { res.statusCode = 404; return res.end("not found"); }
      let body = "";
      req.on("data", function (c) { body += c; });
      req.on("end", function () {
        let parsed; try { parsed = body ? JSON.parse(body) : {}; } catch (e) { parsed = {}; }
        const r2 = { status(c) { res.statusCode = c; return this; }, setHeader(k, v) { res.setHeader(k, v); }, json(b) { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(b)); } };
        require(file)({ method: req.method, query, body: parsed, headers: req.headers }, r2).catch(function (e) { res.statusCode = 500; res.end(String(e)); });
      });
      return;
    }
    const p = path.join(ROOT, path.normalize(u.pathname === "/" ? "index.html" : u.pathname).replace(/^(\.\.[\/])+/, ""));
    if (!p.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
    fs.readFile(p, function (e, d) {
      if (e) { res.statusCode = 404; return res.end("not found"); }
      res.setHeader("content-type", TYPES[path.extname(p)] || "application/octet-stream");
      res.end(d);
    });
  }).listen(PORT, function () { console.log("Lunar Ice Watch demo: http://localhost:" + PORT + "  (Ctrl+C to stop)"); });
})().catch(function (e) { console.error(e); process.exit(1); });
