"use strict";

const request = require("supertest");
const app = require("../../src/app");

describe("Error contract (§6.7)", () => {
  it('FR-7.2 unknown route gives 404 {"error":"Not found"}', async () => {
    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it('FR-7.2 unknown method on a known path gives 404 {"error":"Not found"}', async () => {
    const res = await request(app).delete("/health");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it('FR-7.2 malformed JSON gives 400 with field "body"', async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send('{"amount": 10,');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Validation failed",
      details: [{ field: "body", message: "Malformed JSON" }],
    });
  });

  it("FR-7.2 a JSON scalar body is rejected by the parser with 400", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send('"just a string"');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("§9 a JSON body over the 100kb limit gives 413, not 500", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ x: "a".repeat(200 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: "Validation failed",
      details: [
        { field: "body", message: "Request body must not exceed 100kb" },
      ],
    });
  });
});
