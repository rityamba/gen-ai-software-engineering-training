"use strict";

const express = require("express");
const config = require("./config");
const createRequestLogger = require("./middleware/requestLogger");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const healthRouter = require("./routes/health");

/**
 * Builds the Express app. Does not listen — see server.js (§2, §4).
 */
function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(createRequestLogger());
  app.use(express.json({ limit: config.bodyLimit, strict: true }));

  app.use(healthRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp();
module.exports.createApp = createApp;
