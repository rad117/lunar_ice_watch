const db = require("../_lib/db");
const route = require("../_lib/http");
const { MOON_RADIUS_KM } = require("../_lib/siteDoc");

const rad = Math.PI / 180;
function distKm(a, b) {
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// GET /api/sites/near?lat=-85&lon=0&km=300 -> sites within km (default 200), nearest first.
// $centerSphere takes radians, so the Moon radius is used (the meters in $near assume Earth).
module.exports = route(["GET"], async function (req, res) {
  const lat = Number(req.query.lat), lon = Number(req.query.lon), km = req.query.km == null ? 200 : Number(req.query.km);
  if (![lat, lon, km].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || km <= 0 || km > 5000) {
    return res.status(400).json({ error: "lat (-90..90), lon (-180..180) and km (0..5000) are required numbers" });
  }
  const sites = await (await db()).collection("sites")
    .find({ location: { $geoWithin: { $centerSphere: [[lon, lat], km / MOON_RADIUS_KM] } } }).toArray();
  sites.forEach(function (s) { s.distanceKm = Math.round(distKm([lon, lat], s.location.coordinates) * 10) / 10; });
  res.json(sites.sort(function (a, b) { return a.distanceKm - b.distanceKm; }));
});
