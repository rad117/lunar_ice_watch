// Run with `npm test`. Checks the rules reproduce the six hand-labelled demo sites.
const assert = require("assert");
const { classify, buildSite } = require("./classify");
const seed = require("../../scripts/seed.json");

seed.forEach(function (s) {
  assert.strictEqual(classify(s).classification, s.classification, s.label);
});
const site = buildSite({ label: "T", cpr: "1.3", thermalTemp: "-235", terrainHazard: "20" }, 0, "x");
assert.strictEqual(site.classification, "ICE-SUPPORTED-HIGH");
assert.throws(function () { buildSite({ cpr: "1" }, 0, "x"); }, /thermalTemp/);
const bad = function (over, re) { assert.throws(function () { buildSite(Object.assign({ cpr: "1", thermalTemp: "-200", terrainHazard: "20" }, over), 0, "x"); }, re); };
bad({ cpr: "1.2abc" }, /cpr/);          // trailing text is rejected, not truncated
bad({ cpr: "1e999" }, /cpr/);           // overflow is not a finite number
bad({ terrainHazard: "250" }, /terrainHazard/);
bad({ x: "-5" }, /x must/);
const { parseCsv } = require("./csv");
assert.deepStrictEqual(parseCsv("\uFEFFlabel,cpr\n\"A, B\",1.1\n"), [{ label: "A, B", cpr: "1.1" }]); // BOM stripped, quoted comma kept
console.log("ok");
