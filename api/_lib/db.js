// Cached MongoDB connection: serverless instances reuse the module between calls, so connect once.
const { MongoClient } = require("mongodb");

let client;

module.exports = async function db() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  if (!client) client = new MongoClient(process.env.MONGODB_URI).connect().catch(function (e) { client = null; throw e; });
  return (await client).db(process.env.MONGODB_DB || "lunar_ice_watch");
};
