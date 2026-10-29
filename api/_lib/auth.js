// JWT session in an httpOnly cookie. Needs JWT_SECRET.
const jwt = require("jsonwebtoken");

const COOKIE = "liw_session";
const MAX_AGE = 7 * 24 * 3600;

function secret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  return process.env.JWT_SECRET;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function setSession(req, res, user) {
  const token = jwt.sign({ sub: String(user._id), email: user.email, role: user.role }, secret(), { expiresIn: MAX_AGE });
  const local = /^(localhost|127\.0\.0\.1)/.test((req.headers && req.headers.host) || "");
  res.setHeader("Set-Cookie", COOKIE + "=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + MAX_AGE + (local ? "" : "; Secure"));
}

function clearSession(res) {
  res.setHeader("Set-Cookie", COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

// Returns { id, email, role } or null
function getUser(req) {
  const m = ((req.headers && req.headers.cookie) || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!m) return null;
  try {
    const p = jwt.verify(m[1], secret());
    return { id: p.sub, email: p.email, role: p.role };
  } catch (e) {
    return null;
  }
}

function requireUser(req) {
  const u = getUser(req);
  if (!u) throw httpError(401, "Sign in required");
  return u;
}

module.exports = { setSession, clearSession, getUser, requireUser, httpError };
