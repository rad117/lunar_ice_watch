// Tiny wrapper: method check + JSON errors, so each route is just its handler body.
module.exports = function route(methods, fn) {
  return async function (req, res) {
    if (!methods.includes(req.method)) {
      res.setHeader("Allow", methods.join(", "));
      return res.status(405).json({ error: "Method not allowed" });
    }
    try {
      await fn(req, res);
    } catch (e) {
      console.error(e);
      res.status(e.status || 500).json({ error: e.status ? e.message : "Server error" });
    }
  };
};
