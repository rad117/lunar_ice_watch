// Minimal CSV parse (no quoted commas): header row -> array of {column: value}
function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row");
  const head = lines.shift().split(",").map(function (h) { return h.trim(); });
  return lines.map(function (l) {
    const cells = l.split(",");
    const row = {};
    head.forEach(function (h, i) { row[h] = (cells[i] || "").trim(); });
    return row;
  });
}

module.exports = { parseCsv };
