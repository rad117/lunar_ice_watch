// Local check without Atlas: starts an in-memory MongoDB, seeds it, calls every API handler directly.
// Usage: node scripts/smoke.js   (first run downloads a MongoDB binary)
const assert = require("assert");
const { MongoMemoryServer } = require("mongodb-memory-server");

function call(handler, req) {
  return new Promise(function (resolve) {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code || 200, body: b, headers: this.headers }); } };
    handler(Object.assign({ method: "GET", query: {}, headers: { host: "localhost:3000", "content-type": "application/json" } }, req), res);
  });
}

(async function () {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = "test-secret";
  process.env.BLOB_READ_WRITE_TOKEN = "fake";
  const stored = [];
  require.cache[require.resolve("../api/_lib/blob")] = { id: "blob", loaded: true, exports: async function (p, body) { stored.push(p); return "https://blob.test/" + p; } };
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

  // ---- auth ----
  const post = function (p, body, cookie) { return call(api(p), { method: "POST", body, headers: { host: "localhost:3000", "content-type": "application/json", cookie: cookie || "" } }); };
  assert.strictEqual((await call(api("upload"), { method: "POST", body: {}, headers: { "content-type": "text/plain" } })).code, 415);
  assert.strictEqual((await post("upload", { csv: "a" })).code, 401); // signed out
  assert.strictEqual((await call(api("routes"))).code, 401);
  assert.strictEqual((await post("auth/register", { email: "bad", password: "longenough" })).code, 400);
  assert.strictEqual((await post("auth/register", { email: "a@b.co", password: "short" })).code, 400);
  r = await post("auth/register", { email: "A@b.co", password: "correct horse" });
  assert.strictEqual(r.code, 201);
  assert.match(r.headers["Set-Cookie"], /HttpOnly/);
  const cookie = r.headers["Set-Cookie"].split(";")[0];
  assert.strictEqual((await post("auth/register", { email: "a@b.co", password: "correct horse" })).code, 409);
  assert.strictEqual((await post("auth/login", { email: "a@b.co", password: "wrong wrong" })).code, 401);
  assert.strictEqual((await post("auth/login", { email: "nobody@b.co", password: "correct horse" })).code, 401);
  assert.strictEqual((await post("auth/login", { email: "a@b.co", password: "correct horse" })).code, 200);
  assert.strictEqual((await call(api("auth/me"), { headers: { cookie } })).body.email, "a@b.co");
  assert.strictEqual((await call(api("auth/me"), { headers: { cookie: "liw_session=garbage" } })).body, null);
  assert.ok(!JSON.stringify((await call(api("auth/me"), { headers: { cookie } })).body).includes("passwordHash"));

  // ---- upload ----
  const csv = ["label,cpr,thermalTemp,terrainHazard,lat,lon", "T,1.3,-235,20,-85,10", ""].join("\n");
  assert.strictEqual((await post("upload", { filename: "x.txt", csv }, cookie)).code, 400);
  assert.strictEqual((await post("upload", { filename: "x.csv", csv: "a".repeat(1024 * 1024 + 1) }, cookie)).code, 413);
  assert.strictEqual((await post("upload", { filename: "x.csv", csv: "cpr\n1" }, cookie)).code, 400); // missing columns
  assert.deepStrictEqual(stored, []); // nothing stored for rejected files
  r = await post("upload", { name: "T", filename: "my file.csv", csv }, cookie);
  assert.strictEqual(r.code, 201);
  assert.strictEqual(r.body[0].prediction.label, "ICE-SUPPORTED-HIGH");
  assert.strictEqual(stored.length, 1);
  const sites = (await call(api("sites/index"))).body;
  assert.strictEqual(sites.length, 7);
  assert.ok(sites.every(function (s) { return !("ownerId" in s); }));
  const obs = await (await require("../api/_lib/db")()).collection("observations").find().toArray();
  assert.strictEqual(obs.length, 1);
  assert.strictEqual(obs[0].fileUrl, "https://blob.test/" + stored[0]);
  assert.ok(!("csv" in obs[0]));

  // ---- routes ----
  const rt = { siteId: "s1", start: [0, -89], end: [-46.5, -84.5], distanceKm: 12.5, difficulty: "Medium", path: { type: "LineString", coordinates: [[0, -89], [-46.5, -84.5]] } };
  assert.strictEqual((await post("routes", Object.assign({}, rt, { path: { type: "Point" } }), cookie)).code, 400);
  assert.strictEqual((await post("routes", rt, cookie)).code, 201);
  assert.strictEqual((await call(api("routes"), { headers: { cookie } })).body.length, 1);

  console.log("smoke ok");
  await mongod.stop();
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
