// Tiny wrapper: method check + JSON errors, so each route is just its handler body.
// POSTs must be application/json, which a cross-site <form> cannot send (CSRF guard on top of SameSite=Lax).
module.exports = function route(methods, fn) {
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
};
