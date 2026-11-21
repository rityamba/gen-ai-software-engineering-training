"use strict";

const request = require("supertest");
const app = require("../../src/app");

/** Valid bodies for each type; override any field per test. */
const validBody = {
  deposit: (overrides = {}) => ({
    toAccount: "ACC-12345",
    amount: 100.5,
    currency: "USD",
    type: "deposit",
    ...overrides,
  }),
  withdrawal: (overrides = {}) => ({
    fromAccount: "ACC-12345",
    amount: 20,
    currency: "USD",
    type: "withdrawal",
    ...overrides,
  }),
  transfer: (overrides = {}) => ({
    fromAccount: "ACC-12345",
    toAccount: "ACC-67890",
    amount: 100.5,
    currency: "USD",
    type: "transfer",
    ...overrides,
  }),
};

/** POST /transactions with a JSON body. */
function postTransaction(body) {
  return request(app).post("/transactions").send(body);
}

module.exports = { app, validBody, postTransaction };
