// Tiny wrapper: method check + JSON errors, so each route is just its handler body.
// POSTs must be application/json, which a cross-site <form> cannot send.
const crypto = require("crypto");

function route(methods, fn) {
  return async function (req, res) {
    if (!methods.includes(req.method)) {
      res.setHeader("Allow", methods.join(", "));
      return res.status(405).json({ error: "Method not allowed" });
    }
    if (req.method === "POST" && !/^application\/json/i.test((req.headers && req.headers["content-type"]) || "")) {
      return res.status(415).json({ error: "Content-Type must be application/json" });
    }
    try {
      await fn(req, res);
    } catch (e) {
      if (!e.status) console.error(e);
      res.status(e.status || 500).json({ error: e.status ? e.message : "Server error" });
    }
  };
}

route.httpError = function (status, message) {
  return Object.assign(new Error(message), { status });
};

// Keyed hash of the client IP, used only as a rate-limit key that expires within hours. HMAC with a server-side
// secret (IPv4 is too small a space for a plain hash). Falls back to MONGODB_URI as the key so no new env var is required.
route.clientId = function (req) {
  const h = req.headers || {};
  const ip = String(h["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  return crypto.createHmac("sha256", process.env.IP_HASH_KEY || process.env.MONGODB_URI || "dev").update(ip).digest("hex").slice(0, 16);
};

module.exports = route;
