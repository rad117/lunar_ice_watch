// Vercel Blob upload; its own module so tests can swap it out. Needs BLOB_READ_WRITE_TOKEN.
const { put } = require("@vercel/blob");

module.exports = async function store(pathname, body, contentType) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw Object.assign(new Error("File storage is not configured"), { status: 503 });
  const blob = await put(pathname, body, { access: "public", addRandomSuffix: true, contentType });
  return blob.url;
};
