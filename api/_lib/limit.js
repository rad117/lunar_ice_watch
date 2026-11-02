const { httpError } = require("./http");

module.exports = async function limit(db, key, max) {
  const bucket = Math.floor(Date.now() / 3600000);
  const doc = await db.collection("rateLimits").findOneAndUpdate(
    { _id: key + ":" + bucket },
    { $inc: { n: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 3600000) } },
    { upsert: true, returnDocument: "after" }
  );
  if (doc.n > max) throw httpError(429, "Too many requests, try again later");
};
