// Read-only fallback when MONGODB_URI is not set (e.g. a Vercel project nobody has connected a database to yet):
// the API answers from api/_lib/snapshot.json, a saved copy of the seed sites + real pipeline results + routes.
// Anything that needs to write says so with a 503. If MONGODB_URI IS set and the database fails, that is a real error and is not hidden.
const route = require("./http");

const active = function () { return !process.env.MONGODB_URI; };
const data = function () { return require("./snapshot.json"); };

// Marks the response so the pages can say they are showing saved data.
const mark = function (res) { res.setHeader("x-data-source", "snapshot"); };

const needsDb = function () { throw route.httpError(503, "Saving is turned off: no database is connected to this deployment (read-only demo data)."); };

module.exports = { active, data, mark, needsDb };
