// After a demo: `MONGODB_URI=... npm run reset-demo` removes everything uploaded and leaves the 7 original sites.
// `npm run demo` does not need this: its in-memory data is gone when it stops.
const KEEP = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];

async function resetDemo(db) {
  const notKept = { $nin: KEEP };
  const sites = await db.collection("sites").deleteMany({ _id: notKept });
  const observations = await db.collection("observations").deleteMany({ siteId: notKept });
  const routes = await db.collection("routes").deleteMany({ siteId: notKept });
  return { sites: sites.deletedCount, observations: observations.deletedCount, routes: routes.deletedCount };
}

module.exports = resetDemo;

if (require.main === module) (async function () {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI first (see .env.example)");
  const db = await require("../api/_lib/db")();
  console.log("removed", await resetDemo(db));
  console.log("sites left:", await db.collection("sites").countDocuments());
  process.exit(0);
})().catch(function (e) { console.error(e.message); process.exit(1); });
