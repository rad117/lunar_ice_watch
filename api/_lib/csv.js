// Small CSV parser: header row -> array of {column: value}. Handles a UTF-8 BOM, quoted fields, "" escapes and
// commas / newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const s = String(text).replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quote");
  row.push(cell); rows.push(row);
  const lines = rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row");
  const head = lines.shift().map(function (h) { return h.trim(); });
  return lines.map(function (cells) {
    const out = {};
    head.forEach(function (h, i) { out[h] = (cells[i] || "").trim(); });
    return out;
  });
}

module.exports = { parseCsv };
