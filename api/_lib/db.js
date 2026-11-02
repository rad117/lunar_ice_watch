// Cached MongoDB connection: serverless instances reuse the module between calls, so connect once.
const { MongoClient } = require("mongodb");

let client;

module.exports = async function db() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  // 8 s instead of the driver's 30 s default, so a database problem shows up before the page gives up waiting (js/data.js)
  if (!client) client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).connect().catch(function (e) { client = null; throw e; });
  return (await client).db(process.env.MONGODB_DB || "lunar_ice_watch");
};
