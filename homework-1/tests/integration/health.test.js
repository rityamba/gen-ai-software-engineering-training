"use strict";

const request = require("supertest");
const app = require("../../src/app");

describe("GET /health", () => {
  it('FR-8.1/D8 returns 200 with {"status":"ok"} as JSON', async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("§9 does not expose the x-powered-by header", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
