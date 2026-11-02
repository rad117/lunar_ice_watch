const route = require("./http");

const active = function () { return !process.env.MONGODB_URI; };
const data = function () { return require("./snapshot.json"); };

const mark = function (res) { res.setHeader("x-data-source", "snapshot"); };

const needsDb = function () { throw route.httpError(503, "Saving is turned off: no database is connected to this deployment (read-only demo data)."); };

module.exports = { active, data, mark, needsDb };
