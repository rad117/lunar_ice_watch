const bcrypt = require("bcryptjs");
const db = require("../_lib/db");
const route = require("../_lib/http");
const { setSession, httpError } = require("../_lib/auth");

// Compared when the email is unknown, so response time does not reveal which emails exist
const DUMMY = bcrypt.hashSync("not-a-real-password", 10);

module.exports = route(["POST"], async function (req, res) {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  const user = await (await db()).collection("users").findOne({ email });
  const ok = await bcrypt.compare(String((req.body && req.body.password) || ""), user ? user.passwordHash : DUMMY);
  if (!user || !ok) throw httpError(401, "Wrong email or password");
  setSession(req, res, user);
  res.json({ email, role: user.role });
});
