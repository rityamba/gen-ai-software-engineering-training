"use strict";

const config = require("../config");
const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");

/**
 * Maps errors to the contract in §6.7 / §10.1.
 * 500s are logged to stderr with the stack; the response never contains internals.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity 4
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: err.details });
  }

  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Validation failed",
      details: [{ field: "body", message: "Malformed JSON" }],
    });
  }

  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Validation failed",
      details: [
        {
          field: "body",
          message: `Request body must not exceed ${config.bodyLimit}`,
        },
      ],
    });
  }

  // The router rethrows decodeURIComponent failures as URIError with status 400 but no
  // `expose`, so they need their own branch to avoid falling through to 500.
  if (
    err instanceof URIError &&
    (err.status === 400 || err.statusCode === 400)
  ) {
    return res.status(400).json({
      error: "Validation failed",
      details: [
        { field: "path", message: "URL contains invalid percent-encoding" },
      ],
    });
  }

  // Other client errors from the body parser (unsupported charset/encoding, unreadable
  // stream). Fixed messages only: err.message is never sent to the client.
  const status = err && (err.status || err.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 500 && err.expose) {
    return res.status(status).json({
      error: "Validation failed",
      details: [
        {
          field: "body",
          message:
            status === 415
              ? "Unsupported Content-Encoding or charset; send UTF-8 JSON"
              : "Request body could not be read",
        },
      ],
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  console.error(
    `${req.method} ${req.originalUrl} 500\n${err && err.stack ? err.stack : String(err)}`,
  );
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = errorHandler;
