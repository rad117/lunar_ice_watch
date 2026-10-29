// Local check without Atlas: starts an in-memory MongoDB, seeds it, calls every API handler directly.
// Usage: node scripts/smoke.js   (first run downloads a MongoDB binary)
const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

function call(handler, req) {
  return new Promise(function (resolve) {
    const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code || 200, body: b }); } };
    handler(Object.assign({ method: "GET", query: {} }, req), res);
  });
}

(async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
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

  r = await call(api("upload"), { method: "POST", body: { name: "T", rows: [{ cpr: "1.3", thermalTemp: "-235", terrainHazard: "20", lat: "-85", lon: "10" }] } });
  assert.strictEqual(r.code, 201);
  assert.strictEqual(r.body[0].prediction.label, "ICE-SUPPORTED-HIGH");
  assert.strictEqual((await call(api("sites/index"))).body.length, 7);
  assert.strictEqual((await call(api("upload"), { method: "POST", body: { rows: [{ cpr: "1" }] } })).code, 400);

  assert.deepStrictEqual((await call(api("routes"))).body, []);
  console.log("smoke ok");
  await mongod.stop();
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
