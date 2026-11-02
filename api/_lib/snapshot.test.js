const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
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
  assert.strictEqual(r.body.length, 7);
  assert(r.body.every(function (s) { return !("ownerId" in s); }));
  assert.strictEqual(r.body.find(function (s) { return s._id === "s3"; }).screening.score, 1);

  assert.strictEqual((await call(require("../sites/[id]"), { query: { id: "s7" } })).body.name, "Shackleton");
  assert.strictEqual((await call(require("../sites/[id]"), { query: { id: "nope" } })).code, 404);
  assert.strictEqual((await call(require("../sites/near"), { query: { lat: "-87", lon: "70", km: "100" } })).body[0]._id, "s2");

  r = await call(require("../routes"), { query: { siteId: "s1" } });
  assert.strictEqual(r.body.length, 1);
  assert.strictEqual((await call(require("../routes"), { method: "POST", body: {} })).code, 503);
  assert.strictEqual((await call(require("../upload"), { method: "POST", body: {} })).code, 503);

  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../js/snapshot-data.js"), "utf8"), { window });
  const saved = JSON.parse(JSON.stringify(window.LIW_SNAPSHOT)), server = require("./snapshot.json");
  assert.deepStrictEqual(saved.sites.map(function (s) { return s._id; }), server.sites.map(function (s) { return s._id; }));
  assert.deepStrictEqual(saved.sites.map(function (s) { return s._id; }).sort(), ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
  assert.strictEqual(saved.routes.length, server.routes.length);
  assert.strictEqual(saved.sites.find(function (s) { return s._id === "s3"; }).screening.score, 1);
  console.log("ok");
})().catch(function (e) { console.error(e); process.exit(1); });
