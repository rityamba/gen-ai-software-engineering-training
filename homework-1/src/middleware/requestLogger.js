"use strict";

const config = require("../config");

/**
 * Builds a middleware that writes one line per request when the response
 * finishes: `METHOD path status durationMs` (§10.2). Request bodies are never logged.
 * @param {{enabled?: boolean, log?: (line: string) => void}} [options]
 */
function createRequestLogger({
  enabled = !config.isTest,
  log = (line) => console.log(line),
} = {}) {
  return function requestLogger(req, res, next) {
    if (!enabled) return next();
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
      );
    });
    return next();
  };
}

module.exports = createRequestLogger;
