"use strict";

/** Catch-all for unknown routes and methods (§6.7, FR-7.2). */
function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

module.exports = notFound;
