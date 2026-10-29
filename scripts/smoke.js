// Local check without Atlas: starts an in-memory MongoDB, seeds it, calls every API handler directly.
// Usage: node scripts/smoke.js   (first run downloads a MongoDB binary)
const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

function call(handler, req) {
  return new Promise(function (resolve) {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code || 200, body: b, headers: this.headers }); } };
    handler(Object.assign({ method: "GET", query: {}, headers: { "content-type": "application/json" } }, req), res);
  });
}

(async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.BLOB_READ_WRITE_TOKEN = "fake";
  const stored = [];
  require.cache[require.resolve("../api/_lib/blob")] = { id: "blob", loaded: true, exports: async function (p) { stored.push(p); return "https://blob.test/" + p; } };
  await require("./seed")(true);
  const api = function (p) { return require("../api/" + p); };

  let r = await call(api("sites/index"));
  assert.strictEqual(r.body.length, 6);
  assert.strictEqual(r.body[0]._id, "s1");
  assert.strictEqual(r.body[0].provenance, "simulated");

  r = await call(api("sites/[id]"), { query: { id: "s2" } });
  assert.strictEqual(r.body.name, "Site A2");
  assert.strictEqual((await call(api("sites/[id]"), { query: { id: "nope" } })).code, 404);

  r = await call(api("sites/near"), { query: { lat: "-87", lon: "70", km: "100" } });
  assert.deepStrictEqual(r.body.map(function (s) { return s._id; }), ["s2", "s3"]); // Faustini ~15 km, Shoemaker ~46 km (meridians converge at the pole)
  assert.strictEqual((await call(api("sites/near"), { query: { lat: "x" } })).code, 400);

  // ---- open writes (no sign-in): size / type / rate guards instead ----
  const post = function (p, body, extra) { return call(api(p), { method: "POST", body, headers: Object.assign({ "content-type": "application/json", "x-forwarded-for": "1.2.3.4" }, extra) }); };
  assert.strictEqual((await call(api("upload"), { method: "POST", body: {}, headers: { "content-type": "text/plain" } })).code, 415);
  const csv = ["label,cpr,thermalTemp,terrainHazard,lat,lon", "T,1.3,-235,20,-85,10", ""].join("\n");
  assert.strictEqual((await post("upload", { filename: "x.txt", csv })).code, 400);
  assert.strictEqual((await post("upload", { filename: "x.csv", csv: "a".repeat(1024 * 1024 + 1) })).code, 413);
  assert.strictEqual((await post("upload", { filename: "x.csv", csv: "cpr\n1" })).code, 400); // missing columns
  assert.deepStrictEqual(stored, []); // nothing stored for rejected files
  r = await post("upload", { name: "T", filename: "my file.csv", csv });
  assert.strictEqual(r.code, 201);
  assert.strictEqual(r.body[0].prediction.label, "ICE-SUPPORTED-HIGH");
  assert.strictEqual(stored.length, 1);
  assert.strictEqual((await call(api("sites/index"))).body.length, 7);
  const obs = await (await require("../api/_lib/db")()).collection("observations").find().toArray();
  assert.strictEqual(obs.length, 1);
  assert.strictEqual(obs[0].fileUrl, "https://blob.test/" + stored[0]);
  assert.ok(!("csv" in obs[0]) && !JSON.stringify(obs[0]).includes("1.2.3.4")); // no file body, no raw IP

  // rate limit: 4 attempts used so far by this client; 20 parallel more must leave exactly 16 allowed
  const burst = await Promise.all(Array.from({ length: 20 }, function () { return post("upload", { filename: "x.csv", csv }); }));
  assert.strictEqual(burst.filter(function (x) { return x.code === 201; }).length, 16);
  assert.strictEqual(burst.filter(function (x) { return x.code === 429; }).length, 4);
  assert.strictEqual((await post("upload", { filename: "x.csv", csv }, { "x-forwarded-for": "9.9.9.9" })).code, 201); // other client unaffected

  // ---- routes ----
  const rt = { siteId: "s1", start: [0, -89], end: [-46.5, -84.5], distanceKm: 12.5, difficulty: "Medium", path: { type: "LineString", coordinates: [[0, -89], [-46.5, -84.5]] } };
  assert.strictEqual((await post("routes", Object.assign({}, rt, { path: { type: "Point" } }))).code, 400);
  assert.strictEqual((await post("routes", rt)).code, 201);
  assert.strictEqual((await call(api("routes"), { query: { siteId: "s1" } })).body.length, 1);

  console.log("smoke ok");
  await mongod.stop();
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
