const bcrypt = require("bcryptjs");
const db = require("../_lib/db");
const route = require("../_lib/http");
const { setSession, httpError } = require("../_lib/auth");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = route(["POST"], async function (req, res) {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");
  if (!EMAIL.test(email) || email.length > 200) throw httpError(400, "Enter a valid email");
  if (password.length < 8 || password.length > 72) throw httpError(400, "Password must be 8-72 characters"); // 72 = bcrypt limit
  const user = { email, passwordHash: await bcrypt.hash(password, 10), role: "user", createdAt: new Date() };
  try {
    user._id = (await (await db()).collection("users").insertOne(user)).insertedId;
  } catch (e) {
    if (e.code === 11000) throw httpError(409, "That email is already registered");
    throw e;
  }
  setSession(req, res, user);
  res.status(201).json({ email, role: user.role });
});
