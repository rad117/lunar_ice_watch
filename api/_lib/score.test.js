const assert = require("assert");
const { score } = require("./score");
const cold = score({ pctBelow110K: 40, maxTempK: 70, slopeDeg: 2 });
const warm = score({ pctBelow110K: 0, maxTempK: 200, slopeDeg: 15 });
assert(cold.score > 0.9 && warm.score < 0.2, "cold trap outranks warm site");
assert.strictEqual(score({ cpr: 2 }, { cpr: "simulated" }).score, null); // simulated inputs ignored
assert.deepStrictEqual(score({ maxTempK: 70 }).used, ["maxTempK"]);
console.log("ok");
