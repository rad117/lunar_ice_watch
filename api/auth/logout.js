const route = require("../_lib/http");
const { clearSession } = require("../_lib/auth");

module.exports = route(["POST"], async function (req, res) {
  clearSession(res);
  res.json({ ok: true });
});
