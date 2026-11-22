"use strict";

/**
 * The only module that reads process.env (§12).
 */
const DEFAULT_PORT = 3000;

function parsePort(value) {
  if (value === undefined || value === "") return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

const nodeEnv = process.env.NODE_ENV || "development";

module.exports = Object.freeze({
  port: parsePort(process.env.PORT),
  nodeEnv,
  isTest: nodeEnv === "test",
  /** Max JSON request body size (§9). */
  bodyLimit: "100kb",
});
