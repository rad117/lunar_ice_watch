// Run with `npm test`. With MONGODB_URI unset the API must serve the saved snapshot read-only and refuse writes.
const assert = require("assert");
delete process.env.MONGODB_URI;

function call(handler, req) {
  return new Promise(function (resolve) {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code || 200, body: b, headers: this.headers }); } };
    handler(Object.assign({ method: "GET", query: {}, headers: { "content-type": "application/json" } }, req), res);
  });
}

(async function () {
  let r = await call(require("../sites/index"));
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.headers["x-data-source"], "snapshot");
  assert.strictEqual(r.body.length, 7);                               // 6 seed sites + Shackleton from the pipeline
  assert(r.body.every(function (s) { return !("ownerId" in s); }));
  assert.strictEqual(r.body.find(function (s) { return s._id === "s3"; }).screening.score, 1);

  assert.strictEqual((await call(require("../sites/[id]"), { query: { id: "s7" } })).body.name, "Shackleton");
  assert.strictEqual((await call(require("../sites/[id]"), { query: { id: "nope" } })).code, 404);
  assert.strictEqual((await call(require("../sites/near"), { query: { lat: "-87", lon: "70", km: "100" } })).body[0]._id, "s2");

  r = await call(require("../routes"), { query: { siteId: "s1" } });
  assert.strictEqual(r.body.length, 1);
  assert.strictEqual((await call(require("../routes"), { method: "POST", body: {} })).code, 503);
  assert.strictEqual((await call(require("../upload"), { method: "POST", body: {} })).code, 503);
  console.log("ok");
})().catch(function (e) { console.error(e); process.exit(1); });
