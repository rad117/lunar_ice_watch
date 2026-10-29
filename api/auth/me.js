const route = require("../_lib/http");
const { getUser } = require("../_lib/auth");

// 200 with the user, or 200 with null when signed out (so the nav can ask without a console 401)
module.exports = route(["GET"], async function (req, res) {
  res.json(getUser(req));
});
