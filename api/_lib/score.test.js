const assert = require("assert");
const { score } = require("./score");
const cold = score({ pctBelow110K: 100, maxTempK: 94 });
const warm = score({ pctBelow110K: 0, maxTempK: 200 });
assert.strictEqual(cold.score, 1);
assert.strictEqual(warm.score, 0);
assert.strictEqual(score({ maxTempK: 117.5 }).score, 0.5); // halfway between 110 K and 125 K
assert.strictEqual(score({ cpr: 0.8 }).score, 0);          // dry-surface CPR contributes nothing
assert.strictEqual(score({ cpr: 2 }, { cpr: "simulated" }).score, null); // simulated inputs ignored
assert.deepStrictEqual(score({ slopeDeg: 5 }).used, []);   // slope is not an ice-stability input
console.log("ok");
