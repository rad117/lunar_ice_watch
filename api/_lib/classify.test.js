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
console.log("ok");
