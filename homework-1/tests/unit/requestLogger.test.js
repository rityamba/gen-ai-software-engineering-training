"use strict";

const express = require("express");
const request = require("supertest");
const createRequestLogger = require("../../src/middleware/requestLogger");

function buildApp(options) {
  const app = express();
  app.use(createRequestLogger(options));
  app.post("/echo", express.json(), (req, res) => res.status(201).json({}));
  return app;
}

describe("requestLogger (§10.2)", () => {
  afterEach(() => jest.restoreAllMocks());

  it('§10.2 logs "METHOD path status durationMs" once per request', async () => {
    const log = jest.fn();

    await request(buildApp({ enabled: true, log })).get("/missing?x=1");

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^GET \/missing\?x=1 404 \d+\.\dms$/);
  });

  it("R5 never logs the request body", async () => {
    const log = jest.fn();

    await request(buildApp({ enabled: true, log }))
      .post("/echo")
      .send({ fromAccount: "ACC-12345", amount: 999.99 });

    expect(log.mock.calls[0][0]).toMatch(/^POST \/echo 201 /);
    expect(log.mock.calls[0][0]).not.toMatch(/ACC-12345|999\.99/);
  });

  it("§10.2 is silent under NODE_ENV=test by default", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});

    await request(buildApp()).get("/missing");

    expect(spy).not.toHaveBeenCalled();
  });

  it("§10.2 writes to stdout via console.log when enabled without a custom sink", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});

    await request(buildApp({ enabled: true })).get("/missing");

    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/missing 404 /),
    );
  });
});
