const { MongoClient } = require("mongodb");

let client;

module.exports = async function db() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  if (!client) client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).connect().catch(function (e) { client = null; throw e; });
  return (await client).db(process.env.MONGODB_DB || "lunar_ice_watch");
};
