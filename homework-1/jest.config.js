"use strict";

module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"],
  coverageThreshold: {
    global: { lines: 80, branches: 80 },
  },
};
